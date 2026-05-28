import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          antd: ["antd", "@ant-design/icons"]
        }
      }
    }
  },
  server: {
    host: "127.0.0.1",
    port: 5101,
    strictPort: true
  },
  preview: {
    host: "127.0.0.1",
    port: 5103,
    strictPort: true
  }
});
