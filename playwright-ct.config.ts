import { defineConfig } from "@playwright/experimental-ct-react";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  timeout: 30_000,
  use: {
    ctPort: 3100,
    ctViteConfig: {
      plugins: [react()],
      resolve: {
        alias: {
          "@": path.resolve(__dirname, "."),
        },
      },
    },
  },
});
