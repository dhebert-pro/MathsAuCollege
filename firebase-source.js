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
  doc,
  getDoc,
  getDocs,
  getDocsFromServer,
  initializeFirestore,
  memoryLocalCache,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  writeBatch,
} from "firebase/firestore";

const config = window.FIREBASE_CONFIG;
const configured = Boolean(config?.projectId && config?.apiKey);
let auth;
let db;

if (configured) {
  const app = initializeApp(config);
  auth = getAuth(app);
  const isBackOffice = window.location.pathname.endsWith("professeur.html");
  db = initializeFirestore(app, {
    localCache: isBackOffice
      ? memoryLocalCache()
      : persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
}

const normalizeCourse = (course) => ({
  id: String(course.id),
  title: String(course.title || "").slice(0, 120),
  slug: String(course.slug || ""),
  level: String(course.level),
  category: String(course.category || "À définir").slice(0, 60),
  summary: String(course.summary || "").slice(0, 300),
  content: String(course.content || "").slice(0, 200000),
  status: course.status === "published" ? "published" : "draft",
  sortOrder: Math.max(0, Math.min(999, Number(course.sortOrder) || 0)),
  createdAt: String(course.createdAt || new Date().toISOString()),
  updatedAt: String(course.updatedAt || new Date().toISOString()),
});

async function readAllCourses() {
  const snapshot = await getDocs(collection(db, "courses"));
  return snapshot.docs.map((item) => normalizeCourse({ id: item.id, ...item.data() }));
}

function catalogCourse(course) {
  const { content, ...metadata } = course;
  return metadata;
}

function rebuildCatalogs(batch, courses) {
  ["6", "4"].forEach((level) => {
    const published = courses
      .filter((course) => course.level === level && course.status === "published")
      .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, "fr"))
      .map(catalogCourse);
    batch.set(doc(db, "catalogs", level), {
      level,
      courses: published,
      updatedAt: new Date().toISOString(),
    });
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
  async save(course) {
    const normalized = normalizeCourse(course);
    const courses = await readAllCourses();
    const nextCourses = [...courses.filter((item) => item.id !== normalized.id), normalized];
    const batch = writeBatch(db);
    batch.set(doc(db, "courses", normalized.id), normalized);
    if (normalized.status === "published") batch.set(doc(db, "publishedCourses", normalized.id), normalized);
    else batch.delete(doc(db, "publishedCourses", normalized.id));
    rebuildCatalogs(batch, nextCourses);
    await batch.commit();
    return normalized;
  },
  async remove(id) {
    const courses = await readAllCourses();
    const batch = writeBatch(db);
    batch.delete(doc(db, "courses", id));
    batch.delete(doc(db, "publishedCourses", id));
    rebuildCatalogs(batch, courses.filter((course) => course.id !== id));
    await batch.commit();
  },
};
