mod resource_pack;
use std::path::{Component, Path, PathBuf};

use tauri::http::{header, Request, Response, StatusCode};
use tauri::{Manager, UriSchemeResponder};
use tauri_plugin_dialog::DialogExt;

fn error_response(status: StatusCode, message: &'static str) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, "text/plain; charset=utf-8")
        .body(message.as_bytes().to_vec())
        .expect("static error response is valid")
}

fn relative_path(uri_path: &str) -> Option<PathBuf> {
    let decoded = percent_encoding::percent_decode_str(uri_path)
        .decode_utf8()
        .ok()?;
    let mut relative = PathBuf::new();

    for component in Path::new(decoded.trim_start_matches('/')).components() {
        match component {
            Component::Normal(part) => relative.push(part),
            Component::CurDir => {}
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => return None,
        }
    }

    if relative.as_os_str().is_empty() {
        relative.push("index.html");
    }

    Some(relative)
}

fn byte_range(value: &str, length: u64) -> Option<(u64, u64)> {
    let spec = value.strip_prefix("bytes=")?;
    if spec.contains(',') || length == 0 {
        return None;
    }

    let (start, end) = spec.split_once('-')?;
    if start.is_empty() {
        let suffix_length = end.parse::<u64>().ok()?.min(length);
        if suffix_length == 0 {
            return None;
        }
        return Some((length - suffix_length, length - 1));
    }

    let start = start.parse::<u64>().ok()?;
    if start >= length {
        return None;
    }
    let end = if end.is_empty() {
        length - 1
    } else {
        end.parse::<u64>().ok()?.min(length - 1)
    };
    (start <= end).then_some((start, end))
}

fn content_type(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|extension| extension.to_str())
        .map(str::to_ascii_lowercase)
        .as_deref()
    {
        Some("html") => "text/html; charset=utf-8",
        Some("css") => "text/css; charset=utf-8",
        Some("js" | "mjs") => "text/javascript; charset=utf-8",
        Some("json") => "application/json; charset=utf-8",
        Some("svg") => "image/svg+xml",
        Some("png") => "image/png",
        Some("jpg" | "jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("avif") => "image/avif",
        Some("mp4") => "video/mp4",
        Some("webm") => "video/webm",
        Some("otf") => "font/otf",
        Some("ttf") => "font/ttf",
        Some("woff") => "font/woff",
        Some("woff2") => "font/woff2",
        Some("zip") => "application/zip",
        Some("glb") => "model/gltf-binary",
        Some("dae" | "xml") => "model/vnd.collada+xml",
        _ => "application/octet-stream",
    }
}

fn serve_resource(
    app: &tauri::AppHandle,
    method: &tauri::http::Method,
    uri_path: &str,
    range_header: Option<&str>,
) -> Response<Vec<u8>> {
    let Some(relative) = relative_path(uri_path) else {
        return error_response(StatusCode::BAD_REQUEST, "Invalid resource path");
    };

    let resource_root = if cfg!(debug_assertions) {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap_or_else(|| Path::new("."))
            .to_path_buf()
    } else {
        match app.path().resource_dir() {
            Ok(path) => path,
            Err(_) => {
                return error_response(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Resource directory unavailable",
                )
            }
        }
    };

    let root = if cfg!(debug_assertions) {
        resource_root
    } else {
        resource_root.join("web")
    };
    let active = app
        .state::<resource_pack::Packs>()
        .active
        .read()
        .unwrap()
        .clone();
    if relative == Path::new("offline-resources.html")
        || (!cfg!(debug_assertions) && active.is_none() && relative == Path::new("index.html"))
    {
        return Response::builder()
            .header(header::CONTENT_TYPE, "text/html; charset=utf-8")
            .body(include_bytes!("resource-setup.html").to_vec())
            .unwrap();
    }
    let path = std::iter::once(root).chain(active).find_map(|root| {
        let root = root.canonicalize().ok()?;
        let path = root.join(&relative).canonicalize().ok()?;
        (path.starts_with(&root) && path.is_file()).then_some(path)
    });
    let Some(path) = path else {
        return error_response(StatusCode::NOT_FOUND, "Resource not found");
    };

    let Ok(bytes) = std::fs::read(&path) else {
        return error_response(StatusCode::NOT_FOUND, "Resource not found");
    };
    let length = bytes.len() as u64;
    let content_type = content_type(&path);

    let mut status = StatusCode::OK;
    let mut body = bytes;
    let mut content_range = None;

    if let Some(range_header) = range_header {
        let Some((start, end)) = byte_range(range_header, length) else {
            return Response::builder()
                .status(StatusCode::RANGE_NOT_SATISFIABLE)
                .header(header::CONTENT_RANGE, format!("bytes */{length}"))
                .body(Vec::new())
                .expect("range response is valid");
        };
        status = StatusCode::PARTIAL_CONTENT;
        body = body[start as usize..=end as usize].to_vec();
        content_range = Some(format!("bytes {start}-{end}/{length}"));
    }

    let content_length = if status == StatusCode::PARTIAL_CONTENT {
        body.len() as u64
    } else {
        length
    };
    if method == tauri::http::Method::HEAD {
        body.clear();
    }

    let mut response = Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, content_type)
        .header(header::CONTENT_LENGTH, content_length.to_string())
        .header(header::ACCEPT_RANGES, "bytes");
    if let Some(content_range) = content_range {
        response = response.header(header::CONTENT_RANGE, content_range);
    }
    response.body(body).expect("resource response is valid")
}

fn download_extension(filename: &str) -> Result<&str, String> {
    if filename.contains(['/', '\\', ':', '\0'])
        || filename.trim() != filename
        || filename.len() > 200
    {
        return Err("Invalid download filename".to_owned());
    }
    match Path::new(filename)
        .extension()
        .and_then(|value| value.to_str())
    {
        Some(extension @ ("zip" | "png")) => Ok(extension),
        _ => Err("Unsupported download type".to_owned()),
    }
}

fn choose_and_save(
    app: &tauri::AppHandle,
    filename: &str,
    bytes: &[u8],
) -> Result<Option<String>, String> {
    let extension = download_extension(filename)?;
    let mut dialog = app
        .dialog()
        .file()
        .set_title("选择保存位置")
        .set_file_name(filename)
        .add_filter(
            if extension == "zip" {
                "ZIP 压缩包"
            } else {
                "PNG 图片"
            },
            &[extension],
        );
    if let Ok(directory) = app.path().download_dir() {
        dialog = dialog.set_directory(directory);
    }
    if let Some(window) = app.get_webview_window("main") {
        dialog = dialog.set_parent(&window);
    }
    let Some(destination) = dialog.blocking_save_file() else {
        return Ok(None);
    };
    let path = destination.into_path().map_err(|error| error.to_string())?;
    // The native save panel confirms replacement before returning an existing path.
    std::fs::write(&path, bytes).map_err(|error| error.to_string())?;
    Ok(Some(path.to_string_lossy().into_owned()))
}

#[tauri::command]
async fn save_archive(
    filename: String,
    bytes: Vec<u8>,
    app: tauri::AppHandle,
) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || choose_and_save(&app, &filename, &bytes))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn save_addon(filename: String, app: tauri::AppHandle) -> Result<Option<String>, String> {
    if !["cloth.zip", "ink.zip", "model.zip", "character.zip"].contains(&filename.as_str()) {
        return Err("This add-on is not part of the offline package.".to_owned());
    }

    let add_ons = if cfg!(debug_assertions) {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap_or_else(|| Path::new("."))
            .join("add-ons")
    } else {
        app.path()
            .resource_dir()
            .map_err(|error| error.to_string())?
            .join("web/add-ons")
    };
    let source = add_ons.join(&filename);
    if !source.is_file() {
        return Err("This add-on archive is not included in the offline package.".to_owned());
    }

    tauri::async_runtime::spawn_blocking(move || {
        let bytes = std::fs::read(&source).map_err(|error| error.to_string())?;
        choose_and_save(&app, &filename, &bytes)
    })
    .await
    .map_err(|error| error.to_string())?
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(resource_pack::state(Path::new(
            "/nonexistent-resource-pack",
        )))
        .setup(|app| {
            let data_dir = app.path().app_local_data_dir()?;
            *app.state::<resource_pack::Packs>().active.write().unwrap() =
                resource_pack::load_compatible(&data_dir);
            let menu = tauri::menu::Menu::default(app.handle())?;
            let resources = tauri::menu::SubmenuBuilder::new(app, "Resources / 资源")
                .text("offline-resources", "Offline resources / 离线资源")
                .build()?;
            menu.append(&resources)?;
            app.set_menu(menu)?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            if event.id().as_ref() == "offline-resources" {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.eval("location.href = '/offline-resources.html'");
                }
            }
        })
        .register_asynchronous_uri_scheme_protocol(
            "splatoon",
            |context, request: Request<Vec<u8>>, responder: UriSchemeResponder| {
                let app = context.app_handle().clone();
                let method = request.method().clone();
                let uri_path = request.uri().path().to_owned();
                let range_header = request
                    .headers()
                    .get(header::RANGE)
                    .and_then(|value| value.to_str().ok())
                    .map(str::to_owned);

                std::thread::spawn(move || {
                    let response =
                        serve_resource(&app, &method, &uri_path, range_header.as_deref());
                    responder.respond(response);
                });
            },
        )
        .invoke_handler(tauri::generate_handler![
            save_addon,
            save_archive,
            resource_pack::import_resources,
            resource_pack::resource_pack_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resource_paths_and_video_ranges() {
        assert_eq!(
            relative_path("/resources/Head%20Image/a.png"),
            Some(PathBuf::from("resources/Head Image/a.png"))
        );
        assert_eq!(relative_path("/%2e%2e/secret"), None);
        assert_eq!(relative_path("/"), Some(PathBuf::from("index.html")));
        assert_eq!(byte_range("bytes=2-5", 10), Some((2, 5)));
        assert_eq!(byte_range("bytes=-3", 10), Some((7, 9)));
        assert_eq!(byte_range("bytes=8-", 10), Some((8, 9)));
        assert_eq!(byte_range("bytes=10-", 10), None);
        assert_eq!(byte_range("bytes=2-1", 10), None);
    }

    #[test]
    fn download_filenames_are_validated() {
        assert_eq!(download_extension("model.zip").unwrap(), "zip");
        assert_eq!(
            download_extension("Custom_Splatfest_Tee_Alb.png").unwrap(),
            "png"
        );
        assert_eq!(download_extension("原声吉他.zip").unwrap(), "zip");
        for name in [
            "../model.zip",
            "a\\model.zip",
            "C:model.zip",
            "model.exe",
            " model.zip",
        ] {
            assert!(download_extension(name).is_err());
        }
    }
}
