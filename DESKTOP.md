# 离线桌面版

离线发行由两个文件组成：对应系统的 **1.1.2 程序安装包**，以及 Windows、macOS 共用的 **v1 资源 ZIP**。首次打开程序会提示导入资源 ZIP，导入完成后点击“返回首页”即可使用，不需要启动服务器或联网。

## 资源复用与更新

程序版本和资源格式版本独立。1.1.x 程序支持所有格式 v1 的资源包，升级程序不会删除资源，也不会要求重新导入。今后更改资源格式时，应保留 v1 读取兼容，或明确说明迁移要求。

资源 ZIP 使用文件内容生成标识；内容不变时重复构建复用同一个文件。图片、模型、贴图和资源名称数据放在资源包；页面、脚本、字体及插件代码随程序更新。

资源有更新时，下载或复制新的 ZIP，然后从应用菜单 **Resources / 资源 → Offline resources / 离线资源** 导入。当前版本采用完整资源包更新，不自动联网，也不提供增量下载。导入会显示进度，并逐文件检查大小与 SHA-256；完整校验成功后才切换，取消或资源损坏会保留当前选择。旧资源目录保留，导入旧 ZIP 可以切回旧版本。保留多份资源会占用磁盘空间。

资源保存在 Tauri 的应用本地数据目录中，子目录为 `resource-packs`，不在应用安装目录中。macOS 通常为 `~/Library/Application Support/ink.space4.splatoon3blender/resource-packs`；Windows 通常为 `%LOCALAPPDATA%\ink.space4.splatoon3blender\resource-packs`。导入需要临时解压空间，首次安装建议预留至少 5 GB；更新时还需要容纳新旧两份资源。

应用标识从 1.1.2 起改为 `ink.space4.splatoon3blender`。如果新目录没有可用资源，程序自动复用旧标识 `com.coconutsxxs.splatoonblender` 目录中的已导入资源，无需复制或重新导入；以后导入新版会写入新目录。

ZIP 的校验用于检测损坏，不是发行者签名，请使用可信来源的资源包。旧的 1.0.0 完整安装包没有独立资源存储，需要在升级到 1.1.0 后首次导入一次。

## 构建

安装 Node.js 22+、Python 3.11+、Rust stable 和平台开发工具，然后执行 `npm ci`。

1. `npm run desktop:pack:resources`：生成唯一的共用资源 ZIP、清单和 SHA-256 校验文件，输出到 `offline-release/`。两个平台只需生成一次。
2. macOS 通用程序包：安装 Xcode，添加 `aarch64-apple-darwin`、`x86_64-apple-darwin` Rust 目标，执行 `npm run desktop:build:macos -- --bundles app,dmg --ci`。
3. Windows x64 程序包：安装 Visual Studio C++ Build Tools 和 Rust MSVC 工具链，执行 `npm run desktop:build:windows -- --ci`。

Apple Silicon Mac 上交叉构建 Windows：安装 rustup、LLVM、LLD、NSIS，添加 `x86_64-pc-windows-msvc` 目标并安装 `cargo-xwin` 到 `.build-tools`，再执行相同 Windows 命令。脚本自动选择交叉构建工具。

下载构建依赖需要联网。Windows NSIS 安装包内置完整 WebView2 离线安装器，因此程序包仍包含该运行环境的体积；安装和使用无需联网。安装器采用逐文件压缩。

macOS 输出位于 `src-tauri/target/universal-apple-darwin/release/bundle/dmg/`；Windows 输出位于 `src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/`。资源配置来源为根目录 `offline-resources.json`，格式 v1 包含 `manifest.json` 与 `web/` 下的资源。

构建两个平台后执行 `npm run desktop:release:collect`，可将安装包、共用资源包、校验文件和使用说明集中到 `offline-release/`。

只发布程序更新时无需重新上传资源 ZIP；发布资源更新时复用原程序安装包。首次用户需要程序安装包和资源 ZIP 两者。本次拆分不修改 GitHub workflow，仓库中已单独禁用的 Pages workflow 保持禁用，上游及其他 fork 不受影响。

## 验证与限制

执行 `npm run build:desktop`、`npm test`、`python3 scripts/pack-resources.test.py` 和 `cargo test --manifest-path src-tauri/Cargo.toml --lib`。测试覆盖离线页面、原生下载、语言切换、资源复用、损坏包、非法路径和资源更新失败时保留原选择。发行前还应在目标系统检查首次导入、重启复用、三维预览、语言切换、模型下载及墨水工具。

下载插件、模型 ZIP 或自定义贴图时使用系统保存窗口。Character Creator 的原下载地址已失效，仓库缺少 `add-ons/character.zip`，该下载暂不可用。Discord 和外部文档入口在离线版不可用。当前程序未签名或 Apple 公证。
