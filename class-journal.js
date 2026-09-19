(function () {
  "use strict";

  let user = null;
  const base = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(window.FIREBASE_CONFIG.projectId)}/databases/(default)/documents/`;
  const segment = (value) => encodeURIComponent(String(value));

  function dayKey(date = new Date()) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(date).map((part) => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function encode(value) {
    if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
    if (value && typeof value === "object") {
      return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)])) } };
    }
    if (typeof value === "number") return { integerValue: String(value) };
    if (typeof value === "boolean") return { booleanValue: value };
    return { stringValue: String(value ?? "") };
  }

  function decode(value) {
    if ("arrayValue" in value) return (value.arrayValue.values || []).map(decode);
    if ("mapValue" in value) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, item]) => [key, decode(item)]));
    if ("integerValue" in value) return Number(value.integerValue);
    if ("booleanValue" in value) return value.booleanValue;
    return value.stringValue ?? "";
  }

  function documentData(document) {
    if (!document) return null;
    return Object.fromEntries(Object.entries(document.fields || {}).map(([key, value]) => [key, decode(value)]));
  }

  async function request(path, options = {}) {
    if (!user) throw new Error("Compte professeur non vérifié");
    const token = await user.getIdToken();
    const response = await fetch(base + path, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      cache: "no-store",
    });
    if (response.status === 404 && !options.method) return null;
    if (!response.ok) {
      const error = new Error(`Firestore ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return response.json();
  }

  function coursePath(classId, date, courseId) {
    return `teacherClasses/${segment(classId)}/journal/${segment(date)}/courses/${segment(courseId)}`;
  }

  async function list(path) {
    const documents = [];
    let pageToken = "";
    do {
      const suffix = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "";
      const result = await request(`${path}?pageSize=100${suffix}`);
      documents.push(...(result?.documents || []).map(documentData));
      pageToken = result?.nextPageToken || "";
    } while (pageToken);
    return documents;
  }

  async function save(path, value) {
    return request(path, {
      method: "PATCH",
      body: JSON.stringify({ fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)])) }),
    });
  }

  function formatCourses(courses) {
    return [...courses].sort((a, b) => String(a.startedAt || "").localeCompare(String(b.startedAt || ""))).map((item) => {
      const lines = [`${item.chapterNumber ? `Chapitre ${item.chapterNumber} — ` : ""}${item.title}`];
      const blocks = Array.isArray(item.blocks) ? item.blocks : [];
      if (blocks.length) {
        lines.push("Cours :");
        blocks.forEach((block) => {
          const snippet = String(block.text || "").replace(/\s+/g, " ").trim();
          const short = snippet.length > 220 ? `${snippet.slice(0, 217).trimEnd()}…` : snippet;
          lines.push(`- ${block.label || "Cours"}${short ? ` : ${short}` : ""}`);
        });
      }
      const exercises = Array.isArray(item.exercises) ? [...new Set(item.exercises)] : [];
      const numbered = exercises.filter((value) => /^ex-\d+$/.test(value)).map((value) => Number(value.slice(3))).sort((a, b) => a - b);
      if (numbered.length) lines.push(`Exercices faits : ${numbered.map((number) => `n° ${number}`).join(", ")}.`);
      if (exercises.includes("complex")) lines.push("Tâche complexe réalisée.");
      return lines.join("\n");
    }).join("\n\n");
  }

  window.ClassJournal = {
    dayKey,
    formatCourses,
    setUser(value) { user = value; },
    listClasses() { return list("teacherClasses"); },
    async getCourse(classId, date, courseId) { return documentData(await request(coursePath(classId, date, courseId))); },
    saveCourse(classId, date, courseId, value) { return save(coursePath(classId, date, courseId), value); },
    listCourses(classId, date) { return list(`teacherClasses/${segment(classId)}/journal/${segment(date)}/courses`); },
    async getDraft(classId, date) { return documentData(await request(`teacherClasses/${segment(classId)}/journal/${segment(date)}`)); },
    saveDraft(classId, date, value) { return save(`teacherClasses/${segment(classId)}/journal/${segment(date)}`, value); },
  };
})();
