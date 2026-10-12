import { createReadStream } from 'node:fs';
import { copyFile, mkdir, readdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, basename } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const { version } = JSON.parse(await readFile(resolve(root, 'src-tauri/tauri.conf.json'), 'utf8'));
const output = resolve(root, 'offline-release');
await mkdir(output, { recursive: true });
for (const path of [
  `src-tauri/target/universal-apple-darwin/release/bundle/dmg/Splatoon Blender_${version}_universal.dmg`,
  `src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/Splatoon Blender_${version}_x64-setup.exe`,
]) await copyFile(resolve(root, path), resolve(output, basename(path)));
const hashes = [];
for (const name of (await readdir(output)).sort().filter(name => /\.(zip|dmg|exe)$/.test(name))) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(resolve(output, name))) hash.update(chunk);
  hashes.push(`${hash.digest('hex')}  ${name}`);
}
await writeFile(resolve(output, 'SHA256SUMS.txt'), `${hashes.join('\n')}\n`);
await writeFile(resolve(output, '使用说明.txt'), `Splatoon Blender ${version} 离线版\n\n首次使用：\n1. 安装对应平台程序：macOS 使用 DMG，Windows 使用 setup.exe。\n2. 打开应用，点击“导入资源包”，选择同目录中的 Resources-v1 ZIP，无需自行解压。\n3. 导入完成后点击“返回首页”。\n\n程序更新复用已导入的 v1 资源，不必重复下载资源 ZIP。\n资源更新：从应用菜单 Resources / 资源 → Offline resources / 离线资源 导入新的完整 ZIP。\n取消或导入失败不会切换当前资源；旧资源保留，可导入旧 ZIP 切回。\nWindows 安装包包含 WebView2 离线运行环境。程序未签名或 Apple 公证。\nmacOS 通用版支持 Apple Silicon 和 Intel；Windows 版为 x64。\n`);
console.log(`Offline distribution ready: ${output}`);
