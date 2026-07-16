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
const coursePath = path.join(root, "content", "6e-chapitre-1-distances-et-cercles.json");
const course = JSON.parse(await fs.readFile(coursePath, "utf8"));
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
  if ("timestampValue" in value) return value.timestampValue;
  if (value.arrayValue) return (value.arrayValue.values || []).map(fromValue);
  if (value.mapValue) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, item]) => [key, fromValue(item)]));
  return undefined;
}

function fromDocument(document) {
  return Object.fromEntries(Object.entries(document.fields || {}).map(([key, value]) => [key, fromValue(value)]));
}

async function request(url, options = {}, allowMissing = false) {
  const response = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${tokens.access_token}`, "Content-Type": "application/json", ...(options.headers || {}) },
  });
  if (allowMissing && response.status === 404) return null;
  if (!response.ok) throw new Error(`Firestore ${response.status}: ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}

const now = new Date().toISOString();
course.createdAt ||= now;
course.updatedAt = now;
course.slideCount = course.blocks.filter((block, index) => index === 0 || block.slideBreakBefore).length;
course.blocks = course.blocks.map((block) => ({
  admitted: false,
  imageIds: [],
  teacherLabel: "",
  teacherUrl: "",
  ...block,
}));

const existing = await request(`${base}/courses/${encodeURIComponent(course.id)}`, {}, true);
let seeded = false;
if (!existing) {
  await request(`${base}/courses/${encodeURIComponent(course.id)}`, {
    method: "PATCH",
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(course).map(([key, value]) => [key, toValue(value)])) }),
  });
  seeded = true;
}

const privateList = await request(`${base}/courses?pageSize=300`);
let migrated = 0;
for (const document of privateList.documents || []) {
  const privateCourse = fromDocument(document);
  if (privateCourse.status !== "published" || !privateCourse.blocks?.some((block) => block.teacherUrl)) continue;
  const publicDocument = await request(`${base}/publishedCourses/${encodeURIComponent(privateCourse.id)}`, {}, true);
  if (!publicDocument) continue;
  await request(`${base}/publishedCourses/${encodeURIComponent(privateCourse.id)}?updateMask.fieldPaths=blocks`, {
    method: "PATCH",
    body: JSON.stringify({ fields: { blocks: toValue(privateCourse.blocks) } }),
  });
  migrated += 1;
}

console.log(`Compte Firebase : ${account.user.email}`);
console.log(seeded ? "Brouillon créé : 1 — Distances et cercles" : "Brouillon déjà présent : aucune modification");
console.log(`Cours publiés remis à niveau pour les liens : ${migrated}`);
