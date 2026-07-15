(function () {
  "use strict";

  const escapeHtml = (value) => String(value || "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
  const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const dialog = document.querySelector("#course-dialog");
  let currentCourse = null;
  let pdfUrls = [];

  function renderCourses(level, query = "") {
    const all = CourseStore.published(level);
    const filtered = all.filter((course) => normalize(`${course.title} ${course.category} ${course.summary}`).includes(normalize(query)));
    const container = document.querySelector(`[data-student-courses="${level}"]`);
    const empty = document.querySelector(`[data-student-empty="${level}"]`);
    document.querySelector(`#count-${level}`).textContent = `${all.length} cours`;
    container.innerHTML = filtered.map((course) => `
      <article class="student-course-card">
        <div class="course-card-top"><span class="course-level">${course.level}e</span><span class="course-category">${escapeHtml(course.category)}</span></div>
        <h2>${escapeHtml(course.title)}</h2>
        <p>${escapeHtml(course.summary || "Ressource publiée par le professeur.")}</p>
        <div class="course-card-actions">
          <button type="button" class="text-button" data-read-course="${course.id}">Consulter</button>
          <a class="pdf-button" data-pdf-link="${course.id}" href="#"><span aria-hidden="true">↓</span> PDF</a>
        </div>
      </article>
    `).join("");
    container.querySelectorAll("[data-pdf-link]").forEach((link) => {
      try {
        const download = CoursePdf.createDownload(CourseStore.get(link.dataset.pdfLink));
        pdfUrls.push(download.url);
        link.href = download.url;
        link.download = download.filename;
      } catch {
        link.hidden = true;
      }
    });
    empty.hidden = filtered.length > 0;
  }

  function renderAllCourses() {
    pdfUrls.forEach((url) => URL.revokeObjectURL(url));
    pdfUrls = [];
    document.querySelectorAll("[data-course-search]").forEach((input) => renderCourses(input.dataset.courseSearch, input.value));
  }

  function showPage() {
    const route = window.location.hash.slice(1) || "accueil";
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

  function openCourse(id) {
    currentCourse = CourseStore.get(id);
    if (!currentCourse) return;
    document.querySelector("#dialog-meta").textContent = `${currentCourse.level}e · ${currentCourse.category}`;
    document.querySelector("#dialog-title").textContent = currentCourse.title;
    document.querySelector("#dialog-summary").textContent = currentCourse.summary;
    document.querySelector("#dialog-content").innerHTML = escapeHtml(currentCourse.content).replace(/\n/g, "<br>");
    dialog.showModal();
  }

  document.querySelector(".menu-button").addEventListener("click", (event) => {
    const open = document.querySelector(".navigation").classList.toggle("open");
    event.currentTarget.setAttribute("aria-expanded", String(open));
  });
  document.querySelectorAll("[data-course-search]").forEach((input) => input.addEventListener("input", () => renderCourses(input.dataset.courseSearch, input.value)));
  document.addEventListener("click", (event) => {
    const readButton = event.target.closest("[data-read-course]");
    if (readButton) openCourse(readButton.dataset.readCourse);
  });
  document.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
  document.querySelector("#dialog-pdf").addEventListener("click", () => currentCourse && CoursePdf.download(currentCourse));
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });

  function updateNetworkStatus() {
    const online = navigator.onLine;
    document.querySelector("#network-label").textContent = online ? "En ligne" : "Hors connexion";
    document.querySelector("#network-status").classList.toggle("offline", !online);
  }
  window.addEventListener("hashchange", showPage);
  window.addEventListener("online", updateNetworkStatus);
  window.addEventListener("offline", updateNetworkStatus);
  window.addEventListener("courses:changed", renderAllCourses);
  renderAllCourses();
  showPage();
  updateNetworkStatus();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (sessionStorage.getItem("sw-refreshed")) return;
      sessionStorage.setItem("sw-refreshed", "true");
      window.location.reload();
    });
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
  }
})();
