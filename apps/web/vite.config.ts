import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? "/eternal-realm/" : "/",
  plugins: [react()],
  publicDir: "../../assets",
  server: {
    port: 5173
  },
  preview: {
    port: 5173
  }
});
