import { defineConfig } from "vite";

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      external: ["onnxruntime-node", "tokenizers"],
    },
  },
  optimizeDeps: {
    exclude: ["onnxruntime-node", "tokenizers"],
  },
});
