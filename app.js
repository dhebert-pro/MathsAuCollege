(function () {
  "use strict";

  const escapeHtml = (value) => String(value || "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
  const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  function renderCourses(query = "") {
    const classroom = CourseStore.currentClass();
    if (!classroom) return;
    const all = CourseStore.published(classroom.level);
    const filtered = all.filter((course) => normalize(`${course.chapterNumber} ${course.title}`).includes(normalize(query)));
    const container = document.querySelector("#class-course-grid");
    const empty = document.querySelector("#class-course-empty");
    document.querySelector("#class-course-count").textContent = `${all.length} cours`;
    container.innerHTML = filtered.map((course) => `
      <article class="student-course-card">
        <div class="course-card-top"><span class="course-level">${course.level}e</span><span class="course-category">${course.chapterNumber ? `Chapitre ${escapeHtml(course.chapterNumber)}` : "Cours"}</span></div>
        <h2>${escapeHtml(CourseContent.displayTitle(course))}</h2>
        <p>${course.slideCount} partie${course.slideCount > 1 ? "s" : ""} · Lecture et PDF</p>
        <div class="course-card-actions">
          <button type="button" class="text-button" data-read-course="${course.id}">Consulter</button>
          <button class="pdf-button" type="button" data-pdf-course="${course.id}"><span aria-hidden="true">↓</span> PDF</button>
        </div>
      </article>
    `).join("");
    empty.hidden = filtered.length > 0;
  }

  function renderAllCourses() {
    renderCourses(document.querySelector("#class-course-search").value);
  }

  function showClassroom(classroom) {
    document.querySelector("#class-name").textContent = classroom.name;
    document.querySelector("#class-level-label").textContent = `Mathématiques · ${classroom.level}e`;
    document.querySelector("#class-level-mark").innerHTML = `${classroom.level}<sup>e</sup>`;
    document.querySelector("[data-class-navigation]").hidden = false;
    renderAllCourses();
  }

  async function openClassroom(value, navigate = true) {
    const code = String(value || "").trim().toUpperCase().replace(/\s+/g, "");
    const message = document.querySelector("#class-access-message");
    if (!code) return false;
    message.textContent = "Ouverture de la classe…";
    try {
      const classroom = await CourseStore.openClass(code);
      if (!classroom) {
        message.textContent = "Ce code de classe n’est pas reconnu.";
        return false;
      }
      localStorage.setItem("maths-class-code", classroom.id);
      const url = new URL(window.location.href);
      url.searchParams.set("classe", classroom.id);
      history.replaceState(null, "", `${url.pathname}${url.search}${navigate ? "#classe" : url.hash}`);
      message.textContent = "";
      showClassroom(classroom);
      if (navigate) showPage();
      return true;
    } catch {
      message.textContent = navigator.onLine ? "Impossible d’ouvrir la classe pour le moment." : "Connexion absente. Réessayez lorsque le réseau revient.";
      return false;
    }
  }

  function showPage() {
    const route = window.location.hash.slice(1) || "accueil";
    const requestedRoute = route === "classe" && !CourseStore.currentClass() ? "accueil" : route;
    const validRoute = document.querySelector(`[data-page="${requestedRoute}"]`) ? requestedRoute : "accueil";
    document.querySelectorAll("[data-page]").forEach((page) => {
      const active = page.dataset.page === validRoute;
      page.hidden = !active;
      page.classList.toggle("active", active);
    });
    document.querySelectorAll("[data-route]").forEach((link) => {
      const active = link.dataset.route === validRoute;
      link.classList.toggle("active", active);
      active ? link.setAttribute("aria-current", "page") : link.removeAttribute("aria-current");
    });
    document.querySelector(".navigation").classList.remove("open");
    document.querySelector(".menu-button").setAttribute("aria-expanded", "false");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  document.querySelector(".menu-button").addEventListener("click", (event) => {
    const open = document.querySelector(".navigation").classList.toggle("open");
    event.currentTarget.setAttribute("aria-expanded", String(open));
  });
  document.querySelector("#class-course-search").addEventListener("input", renderAllCourses);
  document.querySelector("#class-access-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    await openClassroom(event.currentTarget.elements.classCode.value);
  });
  document.addEventListener("click", async (event) => {
    const readButton = event.target.closest("[data-read-course]");
    const pdfButton = event.target.closest("[data-pdf-course]");
    const accessCode = CourseStore.currentClass()?.id || "";
    if (readButton) window.location.href = `presentation.html?course=${encodeURIComponent(readButton.dataset.readCourse)}&classe=${encodeURIComponent(accessCode)}`;
    if (pdfButton) {
      pdfButton.disabled = true;
      try {
        const course = await CourseStore.getPublished(pdfButton.dataset.pdfCourse, accessCode);
        if (course) await CoursePdf.download(course);
      } finally {
        pdfButton.disabled = false;
      }
    }
  });

  function updateNetworkStatus() {
    const online = navigator.onLine;
    document.querySelector("#network-label").textContent = online ? "En ligne" : "Hors connexion";
    document.querySelector("#network-status").classList.toggle("offline", !online);
  }
  window.addEventListener("hashchange", showPage);
  window.addEventListener("online", updateNetworkStatus);
  window.addEventListener("offline", updateNetworkStatus);
  window.addEventListener("courses:changed", renderAllCourses);
  CourseStore.startPublic();
  const initialCode = new URLSearchParams(window.location.search).get("classe") || localStorage.getItem("maths-class-code") || "";
  if (initialCode) {
    document.querySelector("#class-code").value = initialCode;
    openClassroom(initialCode, window.location.hash === "#classe").finally(showPage);
  } else {
    showPage();
  }
  updateNetworkStatus();
  if ("serviceWorker" in navigator) {
    const refreshKey = "sw-refreshed-0.7.0";
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (sessionStorage.getItem(refreshKey)) return;
      sessionStorage.setItem(refreshKey, "true");
      window.location.reload();
    });
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" }).then((registration) => registration.update()).catch(() => {});
    });
  }
})();
