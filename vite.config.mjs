import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  base: "./",
  publicDir: false,
  define: {
    __DESKTOP_OFFLINE__: JSON.stringify(false),
    __CHARACTER_CREATOR_BUNDLED__: JSON.stringify(false),
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(projectRoot, "index.html"),
        resources: resolve(projectRoot, "resources.html"),
        inkColors: resolve(projectRoot, "ink-colors.html"),
        documentation: resolve(projectRoot, "documentation/index.html"),
      },
    },
  },
});
