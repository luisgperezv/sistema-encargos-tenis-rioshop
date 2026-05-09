import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  preview: {
    allowedHosts: [
      "merry-appreciation-production-135b.up.railway.app",
    ],
  },
});