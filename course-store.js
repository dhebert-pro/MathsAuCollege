(function () {
  "use strict";

  const firebaseMode = Boolean(window.FirebaseBackend?.configured);
  let courses = [];
  let subscriptions = [];
  const publishedContents = new Map();

  const sort = (items) => [...items].sort((a, b) => a.sortOrder - b.sortOrder || new Date(b.updatedAt) - new Date(a.updatedAt));

  function notify(detail = {}) {
    window.dispatchEvent(new CustomEvent("courses:changed", { detail }));
  }

  function slugify(value) {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }

  function normalize(input) {
    const now = new Date().toISOString();
    const existing = courses.find((course) => course.id === input.id);
    return {
      id: input.id || (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `course-${Date.now()}`),
      title: input.title.trim(),
      slug: slugify(input.title),
      level: String(input.level),
      category: input.category.trim() || "À définir",
      summary: input.summary.trim(),
      content: input.content.trim(),
      status: input.status === "published" ? "published" : "draft",
      sortOrder: Number(input.sortOrder) || 0,
      updatedAt: now,
      createdAt: existing?.createdAt || now,
    };
  }

  function replaceLevel(level, nextCourses, fromCache) {
    courses = sort([...courses.filter((course) => course.level !== String(level)), ...nextCourses]);
    notify({ source: fromCache ? "cache" : "server" });
  }

  window.CourseStore = {
    firebaseMode,
    all() {
      return sort(courses);
    },
    published(level) {
      return this.all().filter((course) => course.status === "published" && (!level || course.level === String(level)));
    },
    get(id) {
      return courses.find((course) => course.id === id) || null;
    },
    async getPublished(id) {
      if (publishedContents.has(id)) return publishedContents.get(id);
      if (!firebaseMode) return null;
      const course = await FirebaseBackend.getPublished(id);
      if (course) publishedContents.set(id, course);
      return course;
    },
    startPublic() {
      if (!firebaseMode || subscriptions.length) return;
      ["6", "4"].forEach((level) => {
        subscriptions.push(FirebaseBackend.subscribeCatalog(level, (items, fromCache) => replaceLevel(level, items, fromCache), () => notify({ source: "offline" })));
      });
    },
    startAdmin(onError) {
      this.stopSubscriptions();
      if (!firebaseMode) return;
      subscriptions.push(FirebaseBackend.subscribeAll((items, fromCache) => {
        courses = sort(items);
        notify({ source: fromCache ? "cache" : "server" });
      }, onError));
    },
    stopSubscriptions() {
      subscriptions.forEach((unsubscribe) => unsubscribe());
      subscriptions = [];
    },
    async save(input) {
      if (!firebaseMode) throw new Error("Firebase is not configured");
      const course = normalize(input);
      publishedContents.delete(course.id);
      return FirebaseBackend.save(course);
    },
    async duplicate(id) {
      const source = this.get(id);
      if (!source) return null;
      return this.save({ ...source, id: "", title: `${source.title} — copie`, status: "draft" });
    },
    async remove(id) {
      if (!firebaseMode) throw new Error("Firebase is not configured");
      publishedContents.delete(id);
      return FirebaseBackend.remove(id);
    },
    async toggleStatus(id) {
      const course = this.get(id);
      if (!course) return null;
      return this.save({ ...course, status: course.status === "published" ? "draft" : "published" });
    },
  };
})();
