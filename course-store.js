(function () {
  "use strict";

  const firebaseMode = Boolean(window.FirebaseBackend?.configured);
  let courses = [];
  let subscriptions = [];
  const publishedContents = new Map();
  const images = new Map();

  const sort = (items) => CourseContent.sortCourses(items);

  function notify(detail = {}) {
    window.dispatchEvent(new CustomEvent("courses:changed", { detail }));
  }

  function normalize(input) {
    const existing = courses.find((course) => course.id === input.id);
    return CourseContent.normalizeCourse({
      ...input,
      createdAt: existing?.createdAt || input.createdAt,
      updatedAt: new Date().toISOString(),
    });
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
    async getPrivate(id) {
      if (!firebaseMode) return null;
      return FirebaseBackend.getPrivate(id);
    },
    async getImage(id) {
      if (images.has(id)) return images.get(id);
      if (!firebaseMode) return null;
      const image = await FirebaseBackend.getCourseImage(id);
      if (image) images.set(id, image);
      return image;
    },
    async saveImage(image) {
      if (!firebaseMode) throw new Error("Firebase is not configured");
      const saved = await FirebaseBackend.saveImage(image);
      images.set(saved.id, saved);
      return saved;
    },
    async deleteImage(id) {
      if (!firebaseMode) return;
      images.delete(id);
      await FirebaseBackend.deleteCourseImage(id);
    },
    async listImages() {
      if (!firebaseMode) return [];
      const items = await FirebaseBackend.listCourseImages();
      items.forEach((image) => images.set(image.id, image));
      return items;
    },
    startPublic() {
      this.stopSubscriptions();
      if (!firebaseMode) return;
      CourseContent.LEVELS.forEach((level) => {
        subscriptions.push(FirebaseBackend.subscribeCatalog(level, (items, fromCache) => replaceLevel(level, items, fromCache), () => replaceLevel(level, [], false)));
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
      publishedContents.clear();
      return FirebaseBackend.save(course);
    },
    async duplicate(id) {
      const source = this.get(id);
      if (!source) return null;
      const nextId = CourseContent.id("course");
      const imageIds = [...new Set(source.blocks.flatMap((block) => block.imageIds))];
      const pairs = await Promise.all(imageIds.map(async (imageId) => {
        const image = await this.getImage(imageId);
        if (!image) return [imageId, ""];
        const copy = await this.saveImage({ ...image, id: CourseContent.id("image"), courseId: nextId, published: false, createdAt: new Date().toISOString() });
        return [imageId, copy.id];
      }));
      const mapping = new Map(pairs);
      return this.save({
        ...source,
        id: nextId,
        title: `${source.title} — copie`,
        chapterNumber: "",
        manualOrder: null,
        status: "draft",
        createdAt: new Date().toISOString(),
        blocks: source.blocks.map((block) => ({ ...block, id: CourseContent.id("block"), imageIds: block.imageIds.map((imageId) => mapping.get(imageId)).filter(Boolean) })),
      });
    },
    async remove(id) {
      if (!firebaseMode) throw new Error("Firebase is not configured");
      publishedContents.clear();
      return FirebaseBackend.remove(id);
    },
    async toggleStatus(id) {
      const course = this.get(id);
      if (!course) return null;
      return this.save({ ...course, status: course.status === "published" ? "draft" : "published" });
    },
    async move(id, direction) {
      const course = this.get(id);
      if (!course) return false;
      const levelCourses = this.all().filter((item) => item.level === course.level);
      const index = levelCourses.findIndex((item) => item.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= levelCourses.length) return false;
      [levelCourses[index], levelCourses[target]] = [levelCourses[target], levelCourses[index]];
      const updated = levelCourses.map((item, manualOrder) => normalize({ ...item, manualOrder }));
      await FirebaseBackend.updateOrder(updated);
      return true;
    },
    async resetOrder(level = "all") {
      const updated = this.all()
        .filter((course) => level === "all" || course.level === level)
        .map((course) => normalize({ ...course, manualOrder: null }));
      if (updated.length) await FirebaseBackend.updateOrder(updated);
    },
  };
})();
