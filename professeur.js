(function () {
  "use strict";

  const loginView = document.querySelector("#login-view");
  const adminApp = document.querySelector("#admin-app");
  const courseForm = document.querySelector("#course-form");
  const escapeHtml = (value) => String(value || "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
  const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const formatDate = (value) => new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));

  function toast(message) {
    const element = document.querySelector("#toast");
    element.textContent = message;
    element.classList.add("visible");
    window.setTimeout(() => element.classList.remove("visible"), 2600);
  }

  function showAdmin() {
    loginView.hidden = true;
    adminApp.hidden = false;
    renderAll();
  }

  function showView(name) {
    document.querySelectorAll("[data-admin-page]").forEach((page) => {
      const active = page.dataset.adminPage === name;
      page.hidden = !active;
      page.classList.toggle("active", active);
    });
    document.querySelectorAll("[data-admin-view]").forEach((button) => button.classList.toggle("active", button.dataset.adminView === name));
    document.querySelector(".admin-sidebar").classList.remove("open");
    if (name === "courses") renderTable();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderStats() {
    const courses = CourseStore.all();
    document.querySelector("#stat-total").textContent = courses.length;
    document.querySelector("#stat-published").textContent = courses.filter((course) => course.status === "published").length;
    document.querySelector("#stat-drafts").textContent = courses.filter((course) => course.status === "draft").length;
    document.querySelector("#stat-levels").textContent = new Set(courses.map((course) => course.level)).size;
    const recent = [...courses].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 5);
    document.querySelector("#recent-courses").innerHTML = recent.map((course) => `
      <button type="button" class="recent-item" data-edit-course="${course.id}">
        <span class="recent-level">${course.level}e</span>
        <span><strong>${escapeHtml(course.title)}</strong><small>${escapeHtml(course.category)} · ${formatDate(course.updatedAt)}</small></span>
        <span class="status ${course.status}">${course.status === "published" ? "Publié" : "Brouillon"}</span>
      </button>
    `).join("") || '<p class="table-empty">Aucun cours enregistré.</p>';
  }

  function filteredCourses() {
    const query = normalize(document.querySelector("#admin-search").value);
    const level = document.querySelector("#level-filter").value;
    const status = document.querySelector("#status-filter").value;
    return CourseStore.all().filter((course) =>
      (!query || normalize(`${course.title} ${course.category}`).includes(query)) &&
      (level === "all" || course.level === level) &&
      (status === "all" || course.status === status),
    );
  }

  function renderTable() {
    const courses = filteredCourses();
    document.querySelector("#course-table-body").innerHTML = courses.map((course) => `
      <tr>
        <td><strong>${escapeHtml(course.title)}</strong><small>${escapeHtml(course.summary || "Sans résumé")}</small></td>
        <td><span class="level-pill level-${course.level}">${course.level}e</span></td>
        <td>${escapeHtml(course.category)}</td>
        <td><button type="button" class="status ${course.status}" data-toggle-course="${course.id}" title="Changer le statut">${course.status === "published" ? "Publié" : "Brouillon"}</button></td>
        <td>${course.sortOrder}</td>
        <td>${formatDate(course.updatedAt)}</td>
        <td>
          <div class="row-actions">
            <button type="button" data-edit-course="${course.id}" title="Modifier"><span aria-hidden="true">✎</span><span class="sr-only">Modifier ${escapeHtml(course.title)}</span></button>
            <button type="button" data-pdf-course="${course.id}" title="Télécharger en PDF"><span aria-hidden="true">↓</span><span class="sr-only">Télécharger ${escapeHtml(course.title)} en PDF</span></button>
            <button type="button" data-duplicate-course="${course.id}" title="Dupliquer"><span aria-hidden="true">⧉</span><span class="sr-only">Dupliquer ${escapeHtml(course.title)}</span></button>
            <button type="button" data-delete-course="${course.id}" class="danger" title="Supprimer"><span aria-hidden="true">×</span><span class="sr-only">Supprimer ${escapeHtml(course.title)}</span></button>
          </div>
        </td>
      </tr>
    `).join("");
    document.querySelector("#table-empty").hidden = courses.length > 0;
  }

  function openEditor(id = "") {
    courseForm.reset();
    courseForm.elements.id.value = "";
    courseForm.elements.sortOrder.value = "0";
    document.querySelector("#editor-title").textContent = "Nouveau cours";
    if (id) {
      const course = CourseStore.get(id);
      if (!course) return;
      Object.entries(course).forEach(([key, value]) => { if (courseForm.elements[key]) courseForm.elements[key].value = value; });
      document.querySelector("#editor-title").textContent = "Modifier le cours";
    }
    showView("editor");
    courseForm.elements.title.focus();
  }

  function renderAll() {
    renderStats();
    renderTable();
  }

  document.querySelector("#login-form").addEventListener("submit", (event) => {
    event.preventDefault();
    document.querySelector("#login-message").textContent = "La connexion sécurisée sera activée après la création du projet Supabase. Aucun identifiant n’a été envoyé.";
    event.currentTarget.reset();
  });
  document.querySelector("#demo-login").addEventListener("click", showAdmin);
  document.querySelector("#logout").addEventListener("click", () => { adminApp.hidden = true; loginView.hidden = false; });
  document.querySelector("#sidebar-toggle").addEventListener("click", () => document.querySelector(".admin-sidebar").classList.toggle("open"));
  document.querySelectorAll("[data-admin-view]").forEach((button) => button.addEventListener("click", () => button.dataset.adminView === "editor" ? openEditor() : showView(button.dataset.adminView)));
  document.querySelectorAll("[data-go-editor]").forEach((button) => button.addEventListener("click", () => openEditor()));
  document.querySelectorAll("[data-go-courses]").forEach((button) => button.addEventListener("click", () => showView("courses")));
  document.querySelector("#cancel-editor").addEventListener("click", () => showView("courses"));
  ["#admin-search", "#level-filter", "#status-filter"].forEach((selector) => document.querySelector(selector).addEventListener("input", renderTable));

  courseForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = Object.fromEntries(new FormData(courseForm).entries());
    CourseStore.save(input);
    renderAll();
    showView("courses");
    toast(input.id ? "Cours mis à jour." : "Cours créé.");
  });

  document.addEventListener("click", (event) => {
    const edit = event.target.closest("[data-edit-course]");
    const pdf = event.target.closest("[data-pdf-course]");
    const duplicate = event.target.closest("[data-duplicate-course]");
    const remove = event.target.closest("[data-delete-course]");
    const toggle = event.target.closest("[data-toggle-course]");
    if (edit) openEditor(edit.dataset.editCourse);
    if (pdf) CoursePdf.download(CourseStore.get(pdf.dataset.pdfCourse));
    if (duplicate) { CourseStore.duplicate(duplicate.dataset.duplicateCourse); renderAll(); toast("Copie créée en brouillon."); }
    if (toggle) { CourseStore.toggleStatus(toggle.dataset.toggleCourse); renderAll(); toast("Statut modifié."); }
    if (remove) {
      const course = CourseStore.get(remove.dataset.deleteCourse);
      if (course && window.confirm(`Supprimer définitivement « ${course.title} » ?`)) { CourseStore.remove(course.id); renderAll(); toast("Cours supprimé."); }
    }
  });
})();
