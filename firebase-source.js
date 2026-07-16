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

async function readAllClasses() {
  const snapshot = await getDocs(collection(db, "classes"));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

function classCatalog(classroom, courses) {
  const assigned = CourseContent.sortCourses(courses)
    .filter((course) => course.status === "published" && course.level === classroom.level && course.classIds.includes(classroom.id));
  return {
    id: classroom.id,
    name: classroom.name,
    level: classroom.level,
    courses: assigned.map(CourseContent.catalogCourse),
    updatedAt: new Date().toISOString(),
  };
}

function rebuildClassCatalogs(batch, courses, classes) {
  classes.forEach((classroom) => batch.set(doc(db, "classSpaces", classroom.id), classCatalog(classroom, courses)));
}

function syncCourseInClassSpaces(batch, course, classes) {
  classes.forEach((classroom) => {
    const reference = doc(db, "classSpaces", classroom.id, "courses", course.id);
    if (course.status === "published" && course.level === classroom.level && course.classIds.includes(classroom.id)) {
      batch.set(reference, CourseContent.publicCourse(course));
    } else {
      batch.delete(reference);
    }
  });
}

function rebuildCatalogs(batch, courses) {
  ["6", "4"].forEach((level) => {
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
  subscribeClasses(onData, onError) {
    return onSnapshot(collection(db, "classes"), { includeMetadataChanges: true }, (snapshot) => {
      onData(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })), snapshot.metadata.fromCache);
    }, onError);
  },
  async getClassSpace(accessCode) {
    const snapshot = await getDoc(doc(db, "classSpaces", String(accessCode || "").toUpperCase()));
    return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
  },
  async getPublished(id, accessCode = "") {
    const reference = accessCode
      ? doc(db, "classSpaces", String(accessCode).toUpperCase(), "courses", id)
      : doc(db, "publishedCourses", id);
    const snapshot = await getDoc(reference);
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
  async deleteCourseImage(id) {
    await deleteDoc(doc(db, "courseImages", id));
  },
  async save(course) {
    const normalized = normalizeCourse(course);
    const [courses, images, classes] = await Promise.all([readAllCourses(), readCourseImages(normalized.id), readAllClasses()]);
    const nextCourses = [...courses.filter((item) => item.id !== normalized.id), normalized];
    const referencedIds = normalized.blocks.flatMap((block) => block.imageIds);
    const batch = writeBatch(db);
    batch.set(doc(db, "courses", normalized.id), normalized);
    if (normalized.status === "published") batch.set(doc(db, "publishedCourses", normalized.id), normalized);
    else batch.delete(doc(db, "publishedCourses", normalized.id));
    syncImages(batch, images, referencedIds, normalized.status === "published");
    rebuildCatalogs(batch, nextCourses);
    syncCourseInClassSpaces(batch, normalized, classes);
    rebuildClassCatalogs(batch, nextCourses, classes);
    await batch.commit();
    return normalized;
  },
  async updateOrder(updatedCourses) {
    const [courses, classes] = await Promise.all([readAllCourses(), readAllClasses()]);
    const updates = new Map(updatedCourses.map((course) => [course.id, normalizeCourse(course)]));
    const nextCourses = courses.map((course) => updates.get(course.id) || course);
    const batch = writeBatch(db);
    updates.forEach((course) => {
      batch.set(doc(db, "courses", course.id), course);
      if (course.status === "published") batch.set(doc(db, "publishedCourses", course.id), course);
      syncCourseInClassSpaces(batch, course, classes);
    });
    rebuildCatalogs(batch, nextCourses);
    rebuildClassCatalogs(batch, nextCourses, classes);
    await batch.commit();
  },
  async remove(id) {
    const [courses, images, classes] = await Promise.all([readAllCourses(), readCourseImages(id), readAllClasses()]);
    const batch = writeBatch(db);
    batch.delete(doc(db, "courses", id));
    batch.delete(doc(db, "publishedCourses", id));
    images.forEach((image) => batch.delete(doc(db, "courseImages", image.id)));
    classes.forEach((classroom) => batch.delete(doc(db, "classSpaces", classroom.id, "courses", id)));
    rebuildCatalogs(batch, courses.filter((course) => course.id !== id));
    rebuildClassCatalogs(batch, courses.filter((course) => course.id !== id), classes);
    await batch.commit();
  },
  async saveClass(classroom) {
    const [courses, classes] = await Promise.all([readAllCourses(), readAllClasses()]);
    const normalized = {
      id: String(classroom.id).toUpperCase(),
      name: String(classroom.name || "").trim().slice(0, 60),
      level: ["6", "4"].includes(String(classroom.level)) ? String(classroom.level) : "6",
      createdAt: String(classroom.createdAt || new Date().toISOString()),
      updatedAt: new Date().toISOString(),
    };
    const nextClasses = [...classes.filter((item) => item.id !== normalized.id), normalized];
    const batch = writeBatch(db);
    batch.set(doc(db, "classes", normalized.id), normalized);
    courses.forEach((course) => {
      if (course.status === "published" && course.level === normalized.level && course.classIds.includes(normalized.id)) {
        batch.set(doc(db, "classSpaces", normalized.id, "courses", course.id), CourseContent.publicCourse(course));
      }
    });
    rebuildClassCatalogs(batch, courses, nextClasses);
    await batch.commit();
    return normalized;
  },
  async removeClass(id) {
    const [courses, classes] = await Promise.all([readAllCourses(), readAllClasses()]);
    const nextClasses = classes.filter((item) => item.id !== id);
    const batch = writeBatch(db);
    batch.delete(doc(db, "classes", id));
    batch.delete(doc(db, "classSpaces", id));
    courses.forEach((course) => {
      batch.delete(doc(db, "classSpaces", id, "courses", course.id));
      if (!course.classIds.includes(id)) return;
      const updated = normalizeCourse({ ...course, classIds: course.classIds.filter((classId) => classId !== id) });
      batch.set(doc(db, "courses", updated.id), updated);
      if (updated.status === "published") batch.set(doc(db, "publishedCourses", updated.id), updated);
      syncCourseInClassSpaces(batch, updated, nextClasses);
    });
    rebuildClassCatalogs(batch, courses.map((course) => course.classIds.includes(id) ? normalizeCourse({ ...course, classIds: course.classIds.filter((classId) => classId !== id) }) : course), nextClasses);
    await batch.commit();
  },
};
