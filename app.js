(function () {
  "use strict";

  const escapeHtml = (value) => String(value || "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
  const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  function renderCourses(level) {
    const search = document.querySelector(`[data-course-search="${level}"]`);
    const all = CourseStore.published(level);
    const filtered = all.filter((course) => normalize(`${course.chapterNumber} ${course.title}`).includes(normalize(search.value)));
    const container = document.querySelector(`#course-grid-${level}`);
    const empty = document.querySelector(`#course-empty-${level}`);
    document.querySelector(`#course-count-${level}`).textContent = `${all.length} cours`;
    container.innerHTML = filtered.map((course) => `
      <article class="student-course-card">
        <div class="course-card-top"><span class="course-level">${course.level}e</span><span class="course-category">${course.chapterNumber ? `Chapitre ${escapeHtml(course.chapterNumber)}` : "Cours"}</span></div>
        <h2>${escapeHtml(CourseContent.displayTitle(course))}</h2>
        <p>${course.slideCount} partie${course.slideCount > 1 ? "s" : ""} · Lecture et PDF</p>
        <div class="course-card-actions">
          <button type="button" class="read-course-button" data-read-course="${course.id}">Consulter le cours <span aria-hidden="true">→</span></button>
          <button class="pdf-button" type="button" data-pdf-course="${course.id}"><span aria-hidden="true">↓</span> Télécharger le PDF</button>
        </div>
      </article>
    `).join("");
    empty.hidden = filtered.length > 0;
  }

  function renderAllCourses() {
    CourseContent.LEVELS.forEach(renderCourses);
  }

  function showPage() {
    const directPath = window.location.pathname.replace(/\/+$/, "");
    const levelMatch = directPath.match(/\/([3-6])e$/);
    const pathRoute = levelMatch && CourseContent.LEVELS.includes(levelMatch[1]) ? `niveau-${levelMatch[1]}` : "";
    const legacyRoutes = { sixieme: "niveau-6", quatrieme: "niveau-4" };
    const hashRoute = window.location.hash.slice(1);
    const route = legacyRoutes[hashRoute] || hashRoute || pathRoute || "accueil";
    const validRoute = document.querySelector(`[data-page="${route}"]`) ? route : "accueil";
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
  document.querySelectorAll("[data-course-search]").forEach((input) => input.addEventListener("input", () => renderCourses(input.dataset.courseSearch)));
  document.addEventListener("click", async (event) => {
    const readButton = event.target.closest("[data-read-course]");
    const pdfButton = event.target.closest("[data-pdf-course]");
    if (readButton) window.location.href = `presentation.html?course=${encodeURIComponent(readButton.dataset.readCourse)}`;
    if (pdfButton) {
      pdfButton.disabled = true;
      try {
        const course = await CourseStore.getPublished(pdfButton.dataset.pdfCourse);
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
  showPage();
  updateNetworkStatus();
  if ("serviceWorker" in navigator) {
    const refreshKey = "sw-refreshed-0.20.0";
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
