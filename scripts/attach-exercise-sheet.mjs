import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const auth = require("firebase-tools/lib/auth");
const scopes = require("firebase-tools/lib/scopes");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectConfig = JSON.parse(await fs.readFile(path.join(root, ".firebaserc"), "utf8"));
const projectId = projectConfig.projects.default;
const courseId = "6e-chapitre-1-distances-et-cercles";
const fileId = "exercises-6e-chapitre-1-distances-et-cercles";
const fileName = "fiche-exercices-chapitre-1-distances-cercles.pdf";
const pdfPath = path.join(root, "output", "pdf", fileName);
const account = auth.getProjectDefaultAccount(root);

if (!account?.tokens?.refresh_token) throw new Error("Aucun compte Firebase actif pour ce projet.");
const tokens = await auth.getAccessToken(account.tokens.refresh_token, [scopes.CLOUD_PLATFORM, scopes.FIREBASE_PLATFORM]);
const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

function toValue(value) {
  if (value === null) return { nullValue: null };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toValue) } };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (typeof value === "string") return { stringValue: value };
  return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toValue(item)])) } };
}

function fromValue(value = {}) {
  if ("nullValue" in value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("booleanValue" in value) return value.booleanValue;
  if (value.arrayValue) return (value.arrayValue.values || []).map(fromValue);
  if (value.mapValue) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, item]) => [key, fromValue(item)]));
  return undefined;
}

function fromDocument(document) {
  return Object.fromEntries(Object.entries(document.fields || {}).map(([key, value]) => [key, fromValue(value)]));
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${tokens.access_token}`, "Content-Type": "application/json", ...(options.headers || {}) },
  });
  if (!response.ok) throw new Error(`Firestore ${response.status}: ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}

const bytes = await fs.readFile(pdfPath);
if (bytes.length > 650000) throw new Error("Le PDF dépasse 650 Ko.");
const dataUrl = `data:application/pdf;base64,${bytes.toString("base64")}`;
const now = new Date().toISOString();

const file = { id: fileId, courseId, dataUrl, name: fileName, published: true, createdAt: now };
await request(`${base}/courseFiles/${encodeURIComponent(fileId)}`, {
  method: "PATCH",
  body: JSON.stringify({ fields: Object.fromEntries(Object.entries(file).map(([key, value]) => [key, toValue(value)])) }),
});

const updateFields = { exerciseFileId: fileId, exerciseFileName: fileName, updatedAt: now };
const updateMask = Object.keys(updateFields).map((field) => `updateMask.fieldPaths=${encodeURIComponent(field)}`).join("&");
for (const collection of ["courses", "publishedCourses"]) {
  await request(`${base}/${collection}/${encodeURIComponent(courseId)}?${updateMask}`, {
    method: "PATCH",
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(updateFields).map(([key, value]) => [key, toValue(value)])) }),
  });
}

const catalogDocument = await request(`${base}/catalogs/6`);
const catalog = fromDocument(catalogDocument);
catalog.courses = (catalog.courses || []).map((course) => course.id === courseId ? { ...course, ...updateFields } : course);
catalog.updatedAt = now;
await request(`${base}/catalogs/6?updateMask.fieldPaths=courses&updateMask.fieldPaths=updatedAt`, {
  method: "PATCH",
  body: JSON.stringify({ fields: { courses: toValue(catalog.courses), updatedAt: toValue(now) } }),
});

console.log(`Fiche attachée au cours ${courseId} : ${bytes.length} octets.`);
