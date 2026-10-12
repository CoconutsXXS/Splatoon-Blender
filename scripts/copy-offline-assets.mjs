import { copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const dist = resolve(root, "dist");
const zipHelper = resolve(root, "Zip.js");

if (!existsSync(dist)) throw new Error("The Vite build output is missing: dist");
if (!existsSync(zipHelper)) throw new Error("Required offline asset is missing: Zip.js");

// This legacy helper is loaded as a classic script from HTML, so Vite leaves it
// in place instead of bundling it. Keep the helper and scroll restoration script beside the built pages.
copyFileSync(zipHelper, resolve(dist, "Zip.js"));

// Keep scroll restoration independent of the asynchronous 3D module bundle.
copyFileSync(resolve(root, "home-scroll.js"), resolve(dist, "home-scroll.js"));
