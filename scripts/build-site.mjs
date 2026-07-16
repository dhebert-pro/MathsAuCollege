import { cp, mkdir, rm } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const destination = resolve(root, "dist");
if (basename(destination) !== "dist" || dirname(destination) !== root) throw new Error("Invalid build destination");

const files = [
  "index.html",
  "professeur.html",
  "presentation.html",
  "styles.css",
  "professeur.css",
  "presentation.css",
  "app.js",
  "professeur.js",
  "presentation.js",
  "course-content.js",
  "course-store.js",
  "pdf-export.js",
  "firebase-config.js",
  "firebase-bundle.js",
  "sw.js",
  "manifest.webmanifest",
  ".nojekyll",
];

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await Promise.all(files.map((file) => cp(resolve(root, file), resolve(destination, file))));
await Promise.all(["assets", "animations", "vendor"].map((directory) => cp(resolve(root, directory), resolve(destination, directory), { recursive: true })));
