import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const buildVersion = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);

export default defineConfig({
  plugins: [react(), { name: "daitora-build-version", transformIndexHtml(html) { return html.replace("<meta charset=\"UTF-8\" />", `<meta charset=\"UTF-8\" /><meta name=\"daitora-build\" content=\"${buildVersion}\" />`); } }],
  build: { outDir: "dist", emptyOutDir: true },
});
