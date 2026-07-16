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

async function readAllCourses() {
  const snapshot = await getDocs(collection(db, "courses"));
  return snapshot.docs.map((item) => normalizeCourse({ id: item.id, ...item.data() }));
}

async function readCourseImages(courseId) {
  const snapshot = await getDocs(query(collection(db, "courseImages"), where("courseId", "==", courseId)));
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

function syncImages(batch, images, referencedIds, published) {
  const references = new Set(referencedIds);
  images.forEach((image) => {
    const reference = doc(db, "courseImages", image.id);
    if (!references.has(image.id)) batch.delete(reference);
    else batch.update(reference, { published });
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
  async save(course) {
    const normalized = normalizeCourse(course);
    const [courses, images] = await Promise.all([readAllCourses(), readCourseImages(normalized.id)]);
    const nextCourses = [...courses.filter((item) => item.id !== normalized.id), normalized];
    const referencedIds = normalized.blocks.flatMap((block) => block.imageIds);
    const batch = writeBatch(db);
    batch.set(doc(db, "courses", normalized.id), normalized);
    if (normalized.status === "published") batch.set(doc(db, "publishedCourses", normalized.id), CourseContent.publicCourse(normalized));
    else batch.delete(doc(db, "publishedCourses", normalized.id));
    syncImages(batch, images, referencedIds, normalized.status === "published");
    rebuildCatalogs(batch, nextCourses);
    await batch.commit();
    return normalized;
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
    const [courses, images] = await Promise.all([readAllCourses(), readCourseImages(id)]);
    const batch = writeBatch(db);
    batch.delete(doc(db, "courses", id));
    batch.delete(doc(db, "publishedCourses", id));
    images.forEach((image) => batch.delete(doc(db, "courseImages", image.id)));
    rebuildCatalogs(batch, courses.filter((course) => course.id !== id));
    await batch.commit();
  },
};
