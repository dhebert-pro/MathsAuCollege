import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getDocsFromServer,
  initializeFirestore,
  memoryLocalCache,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  query,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";

const config = window.FIREBASE_CONFIG;
const configured = Boolean(config?.projectId && config?.apiKey && window.CourseContent);
let auth;
let db;

if (configured) {
  const app = initializeApp(config);
  auth = getAuth(app);
  const parameters = new URLSearchParams(window.location.search);
  const privatePage = window.location.pathname.endsWith("professeur.html") ||
    (window.location.pathname.endsWith("presentation.html") && parameters.get("mode") === "teacher");
  db = initializeFirestore(app, {
    localCache: privatePage
      ? memoryLocalCache()
      : persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
}

const normalizeCourse = (course) => CourseContent.normalizeCourse(course);
const replacementBackupReference = () => doc(db, "courseBackups", "lastReplacement");

async function readReplacementBackup() {
  const snapshot = await getDoc(replacementBackupReference());
  if (!snapshot.exists()) return null;
  const value = snapshot.data();
  return value?.course ? { course: normalizeCourse(value.course), createdAt: String(value.createdAt || "") } : null;
}

function referencedImageIds(course) {
  return new Set(course?.blocks?.flatMap((block) => block.imageIds) || []);
}

async function readAllCourses() {
  const snapshot = await getDocs(collection(db, "courses"));
  return snapshot.docs.map((item) => normalizeCourse({ id: item.id, ...item.data() }));
}

async function readCourseImages(courseId) {
  const snapshot = await getDocs(query(collection(db, "courseImages"), where("courseId", "==", courseId)));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

async function readCourseFiles(courseId) {
  const snapshot = await getDocs(query(collection(db, "courseFiles"), where("courseId", "==", courseId)));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

function rebuildCatalogs(batch, courses) {
  CourseContent.LEVELS.forEach((level) => {
    const published = CourseContent.sortCourses(courses)
      .filter((course) => course.level === level && course.status === "published")
      .map(CourseContent.catalogCourse);
    batch.set(doc(db, "catalogs", level), {
      level,
      courses: published,
      updatedAt: new Date().toISOString(),
    });
  });
}

function syncImages(batch, images, referencedIds, published, preservedIds = []) {
  const references = new Set(referencedIds);
  const preserved = new Set(preservedIds);
  images.forEach((image) => {
    const reference = doc(db, "courseImages", image.id);
    if (references.has(image.id)) batch.update(reference, { published });
    else if (preserved.has(image.id)) batch.update(reference, { published: false });
    else batch.delete(reference);
  });
}

function syncFiles(batch, files, referencedId, published, preservedId = "") {
  files.forEach((file) => {
    const reference = doc(db, "courseFiles", file.id);
    if (file.id === referencedId) batch.update(reference, { published });
    else if (preservedId && file.id === preservedId) batch.update(reference, { published: false });
    else batch.delete(reference);
  });
}

window.FirebaseBackend = {
  configured,
  onAuth(callback) {
    if (!configured) return () => {};
    return onAuthStateChanged(auth, callback);
  },
  async signIn() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    return signInWithPopup(auth, provider);
  },
  async signOut() {
    return signOut(auth);
  },
  async verifyProfessor() {
    await getDocsFromServer(collection(db, "courses"));
    return true;
  },
  subscribeCatalog(level, onData, onError) {
    return onSnapshot(doc(db, "catalogs", String(level)), { includeMetadataChanges: true }, (snapshot) => {
      const value = snapshot.exists() ? snapshot.data() : { courses: [] };
      onData((value.courses || []).map(normalizeCourse), snapshot.metadata.fromCache);
    }, onError);
  },
  subscribeAll(onData, onError) {
    return onSnapshot(collection(db, "courses"), { includeMetadataChanges: true }, (snapshot) => {
      onData(snapshot.docs.map((item) => normalizeCourse({ id: item.id, ...item.data() })), snapshot.metadata.fromCache);
    }, onError);
  },
  async getPublished(id) {
    const snapshot = await getDoc(doc(db, "publishedCourses", id));
    return snapshot.exists() ? normalizeCourse({ id: snapshot.id, ...snapshot.data() }) : null;
  },
  async getPrivate(id) {
    const snapshot = await getDoc(doc(db, "courses", id));
    return snapshot.exists() ? normalizeCourse({ id: snapshot.id, ...snapshot.data() }) : null;
  },
  async saveImage(image) {
    const normalized = {
      id: String(image.id || CourseContent.id("image")),
      courseId: String(image.courseId),
      dataUrl: String(image.dataUrl),
      alt: String(image.alt || "Illustration du cours").trim().slice(0, 160),
      published: Boolean(image.published),
      createdAt: String(image.createdAt || new Date().toISOString()),
    };
    await setDoc(doc(db, "courseImages", normalized.id), normalized);
    return normalized;
  },
  async getCourseImage(id) {
    const snapshot = await getDoc(doc(db, "courseImages", id));
    return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
  },
  async listCourseImages() {
    const snapshot = await getDocs(collection(db, "courseImages"));
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  },
  async deleteCourseImage(id) {
    await deleteDoc(doc(db, "courseImages", id));
  },
  async saveFile(file) {
    const normalized = {
      id: String(file.id || CourseContent.id("file")),
      courseId: String(file.courseId),
      dataUrl: String(file.dataUrl),
      name: String(file.name || "fiche-exercices.pdf").trim().slice(0, 160),
      published: Boolean(file.published),
      createdAt: String(file.createdAt || new Date().toISOString()),
    };
    await setDoc(doc(db, "courseFiles", normalized.id), normalized);
    return normalized;
  },
  async getCourseFile(id) {
    const snapshot = await getDoc(doc(db, "courseFiles", id));
    return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
  },
  async deleteCourseFile(id) {
    await deleteDoc(doc(db, "courseFiles", id));
  },
  async save(course) {
    const normalized = normalizeCourse(course);
    const [courses, images, files, backup] = await Promise.all([readAllCourses(), readCourseImages(normalized.id), readCourseFiles(normalized.id), readReplacementBackup()]);
    const nextCourses = [...courses.filter((item) => item.id !== normalized.id), normalized];
    const referencedIds = normalized.blocks.flatMap((block) => block.imageIds);
    const preservedCourse = backup?.course?.id === normalized.id ? backup.course : null;
    const batch = writeBatch(db);
    batch.set(doc(db, "courses", normalized.id), normalized);
    if (normalized.status === "published") batch.set(doc(db, "publishedCourses", normalized.id), CourseContent.publicCourse(normalized));
    else batch.delete(doc(db, "publishedCourses", normalized.id));
    syncImages(batch, images, referencedIds, normalized.status === "published", referencedImageIds(preservedCourse));
    syncFiles(batch, files, normalized.exerciseFileId, normalized.status === "published", preservedCourse?.exerciseFileId);
    rebuildCatalogs(batch, nextCourses);
    await batch.commit();
    return normalized;
  },
  async getReplacementBackup() {
    return readReplacementBackup();
  },
  async replaceWithBackup(course) {
    const normalized = normalizeCourse(course);
    const [courses, images, files, previousBackup] = await Promise.all([
      readAllCourses(),
      readCourseImages(normalized.id),
      readCourseFiles(normalized.id),
      readReplacementBackup(),
    ]);
    const current = courses.find((item) => item.id === normalized.id);
    if (!current) throw new Error("Course to replace not found");
    const previousBackupImages = previousBackup?.course?.id && previousBackup.course.id !== normalized.id
      ? await readCourseImages(previousBackup.course.id)
      : [];
    const previousBackupFiles = previousBackup?.course?.id && previousBackup.course.id !== normalized.id
      ? await readCourseFiles(previousBackup.course.id)
      : [];
    const nextCourses = [...courses.filter((item) => item.id !== normalized.id), normalized];
    const batch = writeBatch(db);
    batch.set(replacementBackupReference(), { course: current, createdAt: new Date().toISOString() });
    batch.set(doc(db, "courses", normalized.id), normalized);
    if (normalized.status === "published") batch.set(doc(db, "publishedCourses", normalized.id), CourseContent.publicCourse(normalized));
    else batch.delete(doc(db, "publishedCourses", normalized.id));
    syncImages(batch, images, referencedImageIds(normalized), normalized.status === "published", referencedImageIds(current));
    syncFiles(batch, files, normalized.exerciseFileId, normalized.status === "published", current.exerciseFileId);
    if (previousBackup?.course?.id !== normalized.id) {
      const staleImages = referencedImageIds(previousBackup?.course);
      previousBackupImages.forEach((image) => { if (staleImages.has(image.id)) batch.delete(doc(db, "courseImages", image.id)); });
      if (previousBackup?.course?.exerciseFileId) {
        previousBackupFiles.forEach((file) => { if (file.id === previousBackup.course.exerciseFileId) batch.delete(doc(db, "courseFiles", file.id)); });
      }
    }
    rebuildCatalogs(batch, nextCourses);
    await batch.commit();
    return normalized;
  },
  async rollbackReplacement() {
    const backup = await readReplacementBackup();
    if (!backup?.course) return null;
    const [courses, images, files] = await Promise.all([
      readAllCourses(),
      readCourseImages(backup.course.id),
      readCourseFiles(backup.course.id),
    ]);
    const restored = normalizeCourse({ ...backup.course, updatedAt: new Date().toISOString() });
    const nextCourses = [...courses.filter((item) => item.id !== restored.id), restored];
    const batch = writeBatch(db);
    batch.set(doc(db, "courses", restored.id), restored);
    if (restored.status === "published") batch.set(doc(db, "publishedCourses", restored.id), CourseContent.publicCourse(restored));
    else batch.delete(doc(db, "publishedCourses", restored.id));
    syncImages(batch, images, referencedImageIds(restored), restored.status === "published");
    syncFiles(batch, files, restored.exerciseFileId, restored.status === "published");
    batch.delete(replacementBackupReference());
    rebuildCatalogs(batch, nextCourses);
    await batch.commit();
    return restored;
  },
  async updateOrder(updatedCourses) {
    const courses = await readAllCourses();
    const updates = new Map(updatedCourses.map((course) => [course.id, normalizeCourse(course)]));
    const nextCourses = courses.map((course) => updates.get(course.id) || course);
    const batch = writeBatch(db);
    updates.forEach((course) => {
      batch.set(doc(db, "courses", course.id), course);
      if (course.status === "published") batch.set(doc(db, "publishedCourses", course.id), CourseContent.publicCourse(course));
    });
    rebuildCatalogs(batch, nextCourses);
    await batch.commit();
  },
  async remove(id) {
    const [courses, images, files, backup] = await Promise.all([readAllCourses(), readCourseImages(id), readCourseFiles(id), readReplacementBackup()]);
    const batch = writeBatch(db);
    batch.delete(doc(db, "courses", id));
    batch.delete(doc(db, "publishedCourses", id));
    images.forEach((image) => batch.delete(doc(db, "courseImages", image.id)));
    files.forEach((file) => batch.delete(doc(db, "courseFiles", file.id)));
    if (backup?.course?.id === id) batch.delete(replacementBackupReference());
    rebuildCatalogs(batch, courses.filter((course) => course.id !== id));
    await batch.commit();
  },
};
