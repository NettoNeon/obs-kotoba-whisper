import { defineConfig } from "vite";

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      external: ["onnxruntime-node", "sharp"],
    },
  },
  optimizeDeps: {
    exclude: ["onnxruntime-node", "sharp"],
  },
});
