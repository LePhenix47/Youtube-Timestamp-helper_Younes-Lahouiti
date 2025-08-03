import { defineConfig } from "vite";
import path from "path";
import autoprefixer from "autoprefixer";

export default defineConfig({
  server: {
    port: 5173, // Change the port to your preferred one
    host: "0.0.0.0", // Allows access to your local IP address
    open: true, // Optional: Opens the browser automatically
  },
  base: "/Vite-template/",
  css: {
    postcss: {
      plugins: [autoprefixer()],
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    minify: "terser",
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
      },
    },
  },
  resolve: {
    alias: {
      "@public": path.resolve(__dirname, "public"),
      "@assets": path.resolve(__dirname, "src/assets"),
      "@components": path.resolve(__dirname, "src/components"),
      "@pages": path.resolve(__dirname, "src/pages"),
      "@utils": path.resolve(__dirname, "src/utils"),
      "@sass": path.resolve(__dirname, "src/sass"),
    },
    extensions: [".ts", ".js"],
  },
});
