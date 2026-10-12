# Splatoon Blender

Splatoon Blender 是基于 Vite 的网页应用。网页仓库保留浏览器界面、网页资源、插件和模型资源；桌面安装包与 Tauri/Rust 原生层由 [Splatoon-Blender-Desktop](https://github.com/space4yyy/Splatoon-Blender-Desktop) 维护。

## 网页开发

安装 Node.js 22+，然后运行：

```sh
npm ci
npm run dev
```

运行 `npm run build` 会将静态网站生成到 `dist/`，可部署到静态网站托管服务。浏览器版使用浏览器自带的下载流程。
