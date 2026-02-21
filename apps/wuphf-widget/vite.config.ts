import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/main.ts"),
      name: "DunderWuphfWidget",
      formats: ["iife"],
      fileName: () => "wuphf-widget.js"
    },
    emptyOutDir: true,
    sourcemap: true
  }
});
