import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In development, /api is forwarded to the Flask server so no CORS setup is needed.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:5000",
      // Google sign-in redirects the browser to /auth/google/callback on the app origin,
      // so in development that path has to reach the Flask server too.
      "/auth": "http://localhost:5000",
    },
  },
});
