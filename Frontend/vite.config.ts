import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 3000, open: true },
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        // A ritkán változó third-party kód külön, jól cache-elhető chunkokba.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("react-router")) return "router";
          if (
            id.includes("react-dom") ||
            id.includes("/react/") ||
            id.includes("/scheduler/")
          )
            return "react-vendor";
        },
      },
    },
  },
});