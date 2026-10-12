use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::HashSet,
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
    sync::{Mutex, RwLock},
};
use tauri::{Emitter, Manager};
use tauri_plugin_dialog::DialogExt;

pub struct Packs {
    pub active: RwLock<Option<PathBuf>>,
    importing: Mutex<()>,
}
#[derive(Deserialize, Serialize)]
pub struct Entry {
    path: String,
    size: u64,
    sha256: String,
}
#[derive(Deserialize, Serialize)]
pub struct Manifest {
    format: u32,
    app: String,
    id: String,
    files: Vec<Entry>,
}
const MAX_BYTES: u64 = 16 * 1024 * 1024 * 1024;

fn valid_path(path: &str) -> bool {
    let roots: serde_json::Value =
        serde_json::from_str(include_str!("../../offline-resources.json")).unwrap();
    let allowed = roots["roots"].as_array().unwrap().iter().any(|r| {
        let root = r.as_str().unwrap();
        path == root || path.starts_with(&format!("{root}/"))
    });
    allowed
        && path.split('/').all(|part| {
            !part.is_empty()
                && part != "."
                && part != ".."
                && !part.ends_with(['.', ' '])
                && !part
                    .chars()
                    .any(|c| c.is_control() || "<>:\\|?*".contains(c))
                && ![
                    "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6",
                    "COM7", "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7",
                    "LPT8", "LPT9",
                ]
                .contains(
                    &part
                        .split('.')
                        .next()
                        .unwrap()
                        .to_ascii_uppercase()
                        .as_str(),
                )
        })
}
fn validate_manifest(m: &Manifest) -> Result<(), String> {
    if m.format != 1 || m.app != "splatoon-blender" || m.files.is_empty() || m.files.len() > 100_000
    {
        return Err("Unsupported resource pack. / 不支持的资源包。".into());
    }
    let mut seen = HashSet::new();
    let mut hash = Sha256::new();
    let mut total = 0u64;
    for f in &m.files {
        total = total.checked_add(f.size).ok_or("Invalid size")?;
        if total > MAX_BYTES
            || !valid_path(&f.path)
            || !seen.insert(f.path.to_lowercase())
            || f.sha256.len() != 64
            || !f
                .sha256
                .bytes()
                .all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase())
        {
            return Err("Invalid resource manifest. / 资源清单无效。".into());
        }
        hash.update(format!("{}\0{}\0{}\n", f.path, f.size, f.sha256));
    }
    if format!("{:x}", hash.finalize()) != m.id {
        return Err("Resource identity mismatch".into());
    }
    Ok(())
}
pub fn load(store: &Path) -> Option<PathBuf> {
    let id = fs::read_to_string(store.join("active"))
        .or_else(|_| fs::read_to_string(store.join("active.backup")))
        .ok()?;
    if id.len() != 64 || !id.bytes().all(|b| b.is_ascii_hexdigit()) {
        return None;
    }
    let root = store.join(id);
    let manifest: Manifest =
        serde_json::from_slice(&fs::read(root.join("manifest.json")).ok()?).ok()?;
    validate_manifest(&manifest).ok()?;
    if root.file_name()?.to_str()? != manifest.id {
        return None;
    }
    manifest
        .files
        .iter()
        .all(|f| {
            fs::metadata(root.join("web").join(&f.path))
                .is_ok_and(|meta| meta.is_file() && meta.len() == f.size)
        })
        .then(|| root.join("web"))
}
// Identifier changes must not make an already imported resource library disappear.
// New imports use the new application directory; legacy resources are reused in place.
pub fn load_compatible(data_dir: &Path) -> Option<PathBuf> {
    load(&data_dir.join("resource-packs")).or_else(|| {
        load(
            &data_dir
                .parent()?
                .join("com.coconutsxxs.splatoonblender/resource-packs"),
        )
    })
}

pub fn state(store: &Path) -> Packs {
    Packs {
        active: RwLock::new(load(store)),
        importing: Mutex::new(()),
    }
}

// Never modify the current pack until the entire replacement has been verified.
fn extract(source: &Path, store: &Path, progress: impl Fn(u64, u64)) -> Result<PathBuf, String> {
    let mut archive = zip::ZipArchive::new(fs::File::open(source).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    let manifest_bytes = {
        let mut entry = archive
            .by_name("manifest.json")
            .map_err(|_| "Missing resource manifest")?;
        if entry.size() > 32 * 1024 * 1024 {
            return Err("Manifest too large".into());
        }
        let mut bytes = Vec::new();
        entry.read_to_end(&mut bytes).map_err(|e| e.to_string())?;
        bytes
    };
    let manifest: Manifest = serde_json::from_slice(&manifest_bytes).map_err(|e| e.to_string())?;
    validate_manifest(&manifest)?;
    if archive.len() != manifest.files.len() + 1 {
        return Err("Unexpected archive entries".into());
    }
    let mut names = HashSet::new();
    for i in 0..archive.len() {
        let file = archive.by_index(i).map_err(|e| e.to_string())?;
        if !names.insert(file.name().to_owned()) || file.is_dir() || file.is_symlink() {
            return Err("Invalid archive entry".into());
        }
    }
    fs::create_dir_all(store).map_err(|e| e.to_string())?;
    let staging = store.join("importing");
    if staging.exists() {
        fs::remove_dir_all(&staging).map_err(|e| e.to_string())?;
    }
    fs::create_dir(&staging).map_err(|e| e.to_string())?;
    let result = (|| {
        let total = manifest.files.iter().map(|f| f.size).sum();
        let mut done = 0;
        let mut buffer = vec![0u8; 1024 * 1024];
        for f in &manifest.files {
            let mut entry = archive
                .by_name(&format!("web/{}", f.path))
                .map_err(|e| e.to_string())?;
            if entry.size() != f.size {
                return Err("Resource size mismatch".into());
            }
            let destination = staging.join("web").join(&f.path);
            fs::create_dir_all(destination.parent().unwrap()).map_err(|e| e.to_string())?;
            let mut output = fs::File::create(destination).map_err(|e| e.to_string())?;
            let mut hash = Sha256::new();
            let mut written = 0;
            loop {
                let count = entry.read(&mut buffer).map_err(|e| e.to_string())?;
                if count == 0 {
                    break;
                }
                written += count as u64;
                if written > f.size {
                    return Err("Resource exceeds declared size".into());
                }
                hash.update(&buffer[..count]);
                output
                    .write_all(&buffer[..count])
                    .map_err(|e| e.to_string())?;
                done += count as u64;
            }
            if written != f.size || format!("{:x}", hash.finalize()) != f.sha256 {
                return Err("Resource checksum mismatch. / 资源损坏，请重新复制资源包。".into());
            }
            progress(done, total);
        }
        fs::write(staging.join("manifest.json"), manifest_bytes).map_err(|e| e.to_string())?;
        let destination = store.join(&manifest.id);
        // Keep earlier versions for rollback; replace a same-ID damaged installation only after validation.
        let previous = store.join(format!("{}.previous", manifest.id));
        if previous.exists() {
            fs::remove_dir_all(&previous).map_err(|e| e.to_string())?;
        }
        if destination.exists() {
            fs::rename(&destination, &previous).map_err(|e| e.to_string())?;
        }
        if let Err(error) = fs::rename(&staging, &destination) {
            let _ = fs::rename(&previous, &destination);
            return Err(error.to_string());
        }
        let _ = fs::remove_dir_all(previous);
        fs::write(store.join("active.new"), &manifest.id).map_err(|e| e.to_string())?;
        // Windows rename cannot replace an existing file. A backup protects the previous selection.
        let active = store.join("active");
        let backup = store.join("active.backup");
        if backup.exists() {
            fs::remove_file(&backup).map_err(|e| e.to_string())?;
        }
        if active.exists() {
            fs::rename(&active, &backup).map_err(|e| e.to_string())?;
        }
        if let Err(error) = fs::rename(store.join("active.new"), &active) {
            let _ = fs::rename(&backup, &active);
            return Err(error.to_string());
        }
        Ok(destination.join("web"))
    })();
    let _ = fs::remove_dir_all(staging);
    result
}
#[tauri::command]
pub async fn import_resources(app: tauri::AppHandle) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<Packs>();
        let _lock = state
            .importing
            .try_lock()
            .map_err(|_| "An import is already running")?;
        let mut dialog = app
            .dialog()
            .file()
            .set_title("Import resource pack / 导入资源包")
            .add_filter("Resource ZIP", &["zip"]);
        if let Some(window) = app.get_webview_window("main") {
            dialog = dialog.set_parent(&window);
        }
        let Some(file) = dialog.blocking_pick_file() else {
            return Ok(false);
        };
        let source = file.into_path().map_err(|e| e.to_string())?;
        let store = app
            .path()
            .app_local_data_dir()
            .map_err(|e| e.to_string())?
            .join("resource-packs");
        let root = extract(&source, &store, |done, total| {
            let _ = app.emit("resource-import-progress", (done, total));
        })?;
        *state.active.write().map_err(|e| e.to_string())? = Some(root);
        Ok(true)
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
pub fn resource_pack_status(app: tauri::AppHandle) -> bool {
    app.state::<Packs>().active.read().unwrap().is_some()
}

#[cfg(test)]
mod tests {
    use super::*;
    fn pack(path: &Path, content: &[u8], corrupt: bool, extra: bool) {
        let entry = Entry {
            path: "resources/test.bin".into(),
            size: content.len() as u64,
            sha256: format!("{:x}", Sha256::digest(content)),
        };
        let id = format!(
            "{:x}",
            Sha256::digest(format!(
                "{}\0{}\0{}\n",
                entry.path, entry.size, entry.sha256
            ))
        );
        let manifest = Manifest {
            format: 1,
            app: "splatoon-blender".into(),
            id,
            files: vec![entry],
        };
        let mut zip = zip::ZipWriter::new(fs::File::create(path).unwrap());
        let options = zip::write::SimpleFileOptions::default();
        zip.start_file("manifest.json", options).unwrap();
        zip.write_all(&serde_json::to_vec(&manifest).unwrap())
            .unwrap();
        zip.start_file("web/resources/test.bin", options).unwrap();
        zip.write_all(if corrupt { b"wrong" } else { content })
            .unwrap();
        if extra {
            zip.start_file("web/../../escape", options).unwrap();
            zip.write_all(b"bad").unwrap();
        }
        zip.finish().unwrap();
    }
    #[test]
    fn updates_validate_before_switch_and_reuse_across_program_versions() {
        let temp = std::env::temp_dir().join(format!("splatoon-pack-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&temp);
        fs::create_dir_all(&temp).unwrap();
        let zip = temp.join("test.zip");
        let store = temp.join("packs");
        pack(&zip, b"first", false, false);
        let original = extract(&zip, &store, |_, _| {}).unwrap();
        assert_eq!(load(&store), Some(original.clone()));
        pack(&zip, b"other", true, false);
        assert!(extract(&zip, &store, |_, _| {}).is_err());
        assert_eq!(load(&store), Some(original.clone()));
        pack(&zip, b"other", false, true);
        assert!(extract(&zip, &store, |_, _| {}).is_err());
        assert_eq!(
            fs::read(original.join("resources/test.bin")).unwrap(),
            b"first"
        );
        pack(&zip, b"other", false, false);
        let updated = extract(&zip, &store, |_, _| {}).unwrap();
        assert_ne!(updated, original);
        assert!(original.exists());
        assert_eq!(load(&store), Some(updated));
        fs::remove_dir_all(temp).unwrap();
    }
    #[test]
    fn identifier_change_reuses_legacy_pack_and_prefers_new_imports() {
        let temp =
            std::env::temp_dir().join(format!("splatoon-identifier-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&temp);
        fs::create_dir_all(&temp).unwrap();
        let zip = temp.join("test.zip");
        let legacy = temp.join("com.coconutsxxs.splatoonblender/resource-packs");
        let current = temp.join("ink.space4.splatoon3blender");
        pack(&zip, b"older", false, false);
        let old_root = extract(&zip, &legacy, |_, _| {}).unwrap();
        assert_eq!(load_compatible(&current), Some(old_root.clone()));
        pack(&zip, b"newer", false, false);
        let new_root = extract(&zip, &current.join("resource-packs"), |_, _| {}).unwrap();
        assert_eq!(load_compatible(&current), Some(new_root));
        assert!(old_root.exists(), "legacy resources must remain intact");
        fs::remove_dir_all(temp).unwrap();
    }

    #[test]
    fn archive_paths_are_portable_and_cannot_override_program() {
        for path in [
            "resources/../index.html",
            "resources/a\\b",
            "resources/CON.txt",
            "index.html",
            "resources/a:bad",
            "resources/a.",
            "/resources/a",
        ] {
            assert!(!valid_path(path), "{path}");
        }
        assert!(valid_path("resources/Head Image/模型.png"));
    }
}
