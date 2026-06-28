import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        legal: resolve(__dirname, "legal.html"),
        contact: resolve(__dirname, "contact.html")
      }
    },
    target: "es2022",
    sourcemap: true
  }
});
