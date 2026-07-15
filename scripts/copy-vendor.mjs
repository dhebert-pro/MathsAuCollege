import { copyFile, mkdir } from "node:fs/promises";

await mkdir(new URL("../vendor", import.meta.url), { recursive: true });
await copyFile(
  new URL("../node_modules/jspdf/dist/jspdf.umd.min.js", import.meta.url),
  new URL("../vendor/jspdf.umd.min.js", import.meta.url),
);
