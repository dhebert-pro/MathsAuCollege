import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";

const calls = [];
let stored = null;
const context = {
  window: { FIREBASE_CONFIG: { projectId: "test-project" } },
  fetch: async (url, options) => {
    calls.push({ url, options });
    if (options.method === "PATCH") {
      stored = JSON.parse(options.body);
      return { ok: true, status: 200, json: async () => stored };
    }
    if (url.endsWith("/courses/test-course")) return { ok: true, status: 200, json: async () => stored };
    return { ok: true, status: 200, json: async () => ({ documents: [stored] }) };
  },
};
runInNewContext(readFileSync(resolve("class-journal.js"), "utf8"), context);
const journal = context.window.ClassJournal;
journal.setUser({ getIdToken: async () => "test-token" });

assert.equal(journal.dayKey(new Date("2026-09-19T22:30:00Z")), "2026-09-20");
const record = {
  classId: "test-class", date: "2026-09-20", courseId: "test-course",
  title: "Cercles", chapterNumber: "1", level: "6",
  blocks: [{ id: "b1", label: "Définition", text: "Un cercle…" }],
  exercises: ["ex-1", "complex"], startedAt: "2026-09-20T08:00:00Z", updatedAt: "2026-09-20T09:00:00Z",
};
await journal.saveCourse("test-class", "2026-09-20", "test-course", record);
assert.equal(stored.fields.blocks.arrayValue.values[0].mapValue.fields.label.stringValue, "Définition");
assert.equal(calls[0].options.headers.Authorization, "Bearer test-token");
assert.deepEqual(JSON.parse(JSON.stringify(await journal.getCourse("test-class", "2026-09-20", "test-course"))), record);
assert.equal((await journal.listCourses("test-class", "2026-09-20")).length, 1);
assert.match(journal.formatCourses([record]), /Chapitre 1 — Cercles/);
assert.match(journal.formatCourses([record]), /Définition : Un cercle/);
assert.match(journal.formatCourses([record]), /Exercices faits : n° 1\./);
assert.match(journal.formatCourses([record]), /Tâche complexe réalisée/);
assert.equal(journal.coursesForLevel([record], "4").length, 0);
assert.equal(journal.coursesForLevel([record], "6").length, 1);
await journal.updateClassLevel("test-class", "6");
assert.match(calls.at(-1).url, /updateMask\.fieldPaths=level/);
assert.equal(stored.fields.level.stringValue, "6");
console.log("Class journal tests passed");
