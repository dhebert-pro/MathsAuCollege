(function () {
  "use strict";

  const STORAGE_KEY = "maths-college-demo-courses-v1";
  const demoCourses = [
    {
      id: "demo-6",
      title: "Cours de démonstration 6e",
      slug: "cours-demonstration-6e",
      level: "6",
      category: "Démonstration",
      summary: "Un contenu fictif pour prévisualiser l’espace élève.",
      content: "Ceci est un exemple temporaire.\n\nLe format et les outils de création du cours seront définis ultérieurement avec le professeur.",
      status: "published",
      sortOrder: 10,
      updatedAt: "2026-07-15T08:00:00.000Z",
      createdAt: "2026-07-15T08:00:00.000Z",
    },
    {
      id: "demo-4",
      title: "Cours de démonstration 4e",
      slug: "cours-demonstration-4e",
      level: "4",
      category: "Démonstration",
      summary: "Un second contenu fictif pour tester le classement.",
      content: "Ce cours ne contient aucune progression pédagogique définitive.\n\nIl sert uniquement à tester la publication et l’export PDF.",
      status: "draft",
      sortOrder: 20,
      updatedAt: "2026-07-14T08:00:00.000Z",
      createdAt: "2026-07-14T08:00:00.000Z",
    },
  ];

  const cloneDemoCourses = () => JSON.parse(JSON.stringify(demoCourses));

  function read() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return Array.isArray(stored) ? stored : cloneDemoCourses();
    } catch {
      return cloneDemoCourses();
    }
  }

  function write(courses) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
    window.dispatchEvent(new CustomEvent("courses:changed"));
  }

  function slugify(value) {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }

  window.CourseStore = {
    all() {
      return read().sort((a, b) => a.sortOrder - b.sortOrder || new Date(b.updatedAt) - new Date(a.updatedAt));
    },
    published(level) {
      return this.all().filter((course) => course.status === "published" && (!level || course.level === String(level)));
    },
    get(id) {
      return read().find((course) => course.id === id) || null;
    },
    save(input) {
      const courses = read();
      const now = new Date().toISOString();
      const existingIndex = courses.findIndex((course) => course.id === input.id);
      const course = {
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
        createdAt: existingIndex >= 0 ? courses[existingIndex].createdAt : now,
      };
      if (existingIndex >= 0) courses[existingIndex] = course;
      else courses.push(course);
      write(courses);
      return course;
    },
    duplicate(id) {
      const source = this.get(id);
      if (!source) return null;
      return this.save({ ...source, id: "", title: `${source.title} — copie`, status: "draft" });
    },
    remove(id) {
      write(read().filter((course) => course.id !== id));
    },
    toggleStatus(id) {
      const course = this.get(id);
      if (!course) return null;
      return this.save({ ...course, status: course.status === "published" ? "draft" : "published" });
    },
    reset() {
      write(cloneDemoCourses());
    },
  };
})();
