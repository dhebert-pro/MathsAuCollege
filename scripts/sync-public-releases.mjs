import { GoogleAuth } from "google-auth-library";
import { releasePlan } from "../course-release.mjs";

const projectId = process.env.FIREBASE_PROJECT_ID;
if (!projectId) throw new Error("FIREBASE_PROJECT_ID is required");
const client = await new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/datastore"] }).getClient();
const base = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents`;

function decode(value) {
  if ("nullValue" in value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("booleanValue" in value) return value.booleanValue;
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(decode);
  if ("mapValue" in value) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, item]) => [key, decode(item)]));
  throw new Error("Unexpected Firestore field type");
}

function encode(value) {
  if (value === null) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "number") return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  if (value && typeof value === "object") return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)])) } };
  throw new Error("Unexpected course field type");
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

async function list(path) {
  const documents = [];
  let pageToken = "";
  do {
    const params = new URLSearchParams({ pageSize: "100" });
    if (pageToken) params.set("pageToken", pageToken);
    const response = await client.request({ url: `${base}/${path}?${params}` });
    documents.push(...(response.data.documents || []).map((document) => ({
      id: decodeURIComponent(document.name.split("/").pop()),
      ...Object.fromEntries(Object.entries(document.fields || {}).map(([key, value]) => [key, decode(value)])),
    })));
    pageToken = response.data.nextPageToken || "";
  } while (pageToken);
  return documents;
}

const [courses, classes, published] = await Promise.all([
  list("courses"), list("teacherClasses"), list("publishedCourses"),
]);
const progress = (await Promise.all(classes.map(async (item) =>
  (await list(`teacherClasses/${encodeURIComponent(item.id)}/progress`)).map((record) => ({ ...record, classId: item.id, courseId: record.id }))
))).flat();
const active = courses.filter((course) => course.status === "published");
if (active.some((course) => !Array.isArray(course.blocks))) throw new Error("A published course has no block list");
const plan = releasePlan(active, classes, progress);
const current = new Map(published.map((course) => [course.id, course]));
let changed = 0;
for (const [id, course] of plan) {
  if (stableStringify(current.get(id)) === stableStringify(course)) continue;
  await client.request({
    url: `${base}/publishedCourses/${encodeURIComponent(id)}`,
    method: "PATCH",
    data: { fields: Object.fromEntries(Object.entries(course).map(([key, value]) => [key, encode(value)])) },
  });
  changed += 1;
}
console.log(`Public course releases synchronized: ${changed} updated, ${plan.size} published`);
