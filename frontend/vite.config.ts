import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: [
      "encargos.tenisrioshop.com",
    ],
  },

  preview: {
    allowedHosts: [
      "merry-appreciation-production-135b.up.railway.app",
      "encargos.tenisrioshop.com",
    ],
  },
});