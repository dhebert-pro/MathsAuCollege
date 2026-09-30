(function () {
  "use strict";

  const mounts = new Set();

  function option(label, value) { return new Option(label, value); }

  function courseLabel(course) {
    return course.chapterNumber ? `Chapitre ${course.chapterNumber} - ${course.title}` : course.title;
  }

  function pageOptions(select, maximum, selected = 1) {
    select.replaceChildren(...Array.from({ length: maximum }, (_, index) => option(`Page ${index + 1}`, String(index + 1))));
    select.value = String(Math.min(maximum, Math.max(1, Number(selected) || 1)));
  }

  function mount(element) {
    if (element.dataset.assessmentMounted) return;
    element.dataset.assessmentMounted = "true";
    const fixedLevel = element.dataset.level === "all" ? "" : element.dataset.level;
    const adminMode = element.dataset.mode === "admin";
    element.classList.add("assessment-generator");
    element.innerHTML = `
      <div class="assessment-generator-heading">
        <div><p class="eyebrow">${adminMode ? "Interrogation aléatoire" : "Pour s’exercer"}</p><h2>${adminMode ? "Créer une feuille d’interrogation" : "Créer une feuille d’entraînement"}</h2></div>
        <span class="assessment-dice" aria-hidden="true">⌁</span>
      </div>
      <p class="assessment-intro">${adminMode
        ? "Choisissez les pages évaluées et la durée souhaitée. Les mêmes critères sélectionnent les mêmes types d’exercices, avec de nouvelles valeurs à chaque génération."
        : "Choisis les pages que tu souhaites travailler et le temps dont tu disposes. Une feuille d’exercices adaptée sera créée pour t’entraîner."}</p>
      <div class="assessment-fields">
        ${fixedLevel ? "" : `<label>Niveau<select data-assessment-level>${window.CourseContent.LEVELS.map((level) => `<option value="${level}">${level}e</option>`).join("")}</select></label>`}
        <label>Durée<input data-assessment-duration type="number" min="5" max="120" step="5" value="20" /><span>minutes</span></label>
        <label>Calculatrice<select data-assessment-calculator><option value="">Choisir…</option><option value="forbidden">Non autorisée</option><option value="allowed">Autorisée</option></select></label>
        <fieldset><legend>Depuis</legend><select data-assessment-start-course aria-label="Cours de départ"></select><select data-assessment-start-page aria-label="Page de départ"></select></fieldset>
        <fieldset><legend>Jusqu’à</legend><select data-assessment-end-course aria-label="Cours de fin"></select><select data-assessment-end-page aria-label="Page de fin"></select></fieldset>
      </div>
      <div class="assessment-actions"><button type="button" data-assessment-generate>${adminMode ? "Générer l’interrogation" : "Créer ma feuille d’exercices"}</button><span data-assessment-status role="status" aria-live="polite"></span></div>
    `;
    const state = { element, fixedLevel, adminMode };
    mounts.add(state);
    const level = element.querySelector("[data-assessment-level]");
    level?.addEventListener("change", () => refresh(state));
    ["start", "end"].forEach((side) => {
      element.querySelector(`[data-assessment-${side}-course]`).addEventListener("change", () => refreshPages(state, side));
    });
    element.querySelector("[data-assessment-generate]").addEventListener("click", () => generate(state));
    refresh(state);
  }

  function currentLevel(state) {
    return state.fixedLevel || state.element.querySelector("[data-assessment-level]").value;
  }

  function available(state) {
    const level = currentLevel(state);
    const banks = window.AssessmentStore.forLevel(level);
    const byId = new Map(banks.map((bank) => [bank.courseId, bank]));
    const courses = window.CourseStore.published(level).filter((course) => byId.has(course.id));
    return { courses, byId };
  }

  function refresh(state) {
    const { courses } = available(state);
    const start = state.element.querySelector("[data-assessment-start-course]");
    const end = state.element.querySelector("[data-assessment-end-course]");
    const previousStart = start.value;
    const previousEnd = end.value;
    const options = courses.map((course) => option(courseLabel(course), course.id));
    start.replaceChildren(...options.map((item) => item.cloneNode(true)));
    end.replaceChildren(...options);
    start.value = courses.some((course) => course.id === previousStart) ? previousStart : courses[0]?.id || "";
    end.value = courses.some((course) => course.id === previousEnd) ? previousEnd : courses.at(-1)?.id || "";
    refreshPages(state, "start");
    refreshPages(state, "end", true);
    const button = state.element.querySelector("[data-assessment-generate]");
    button.disabled = !courses.length;
    state.element.querySelector("[data-assessment-status]").textContent = courses.length ? "" : "Aucun exercice n’est encore disponible pour ce niveau.";
  }

  function refreshPages(state, side, last = false) {
    const { byId } = available(state);
    const courseId = state.element.querySelector(`[data-assessment-${side}-course]`).value;
    const select = state.element.querySelector(`[data-assessment-${side}-page]`);
    const previous = select.value;
    const maximum = byId.get(courseId)?.slideCount || 1;
    pageOptions(select, maximum, previous || (last ? maximum : 1));
  }

  function scope(state) {
    const { courses, byId } = available(state);
    const startCourseId = state.element.querySelector("[data-assessment-start-course]").value;
    const endCourseId = state.element.querySelector("[data-assessment-end-course]").value;
    const startPage = Number(state.element.querySelector("[data-assessment-start-page]").value);
    const endPage = Number(state.element.querySelector("[data-assessment-end-page]").value);
    const startIndex = courses.findIndex((course) => course.id === startCourseId);
    const endIndex = courses.findIndex((course) => course.id === endCourseId);
    if (startIndex < 0 || endIndex < 0 || startIndex > endIndex || (startIndex === endIndex && startPage > endPage)) throw new Error("L’intervalle de pages est inversé.");
    const candidates = [];
    courses.forEach((course, courseIndex) => {
      const bank = byId.get(course.id);
      bank.exercises.forEach((exercise) => {
        const pages = exercise.pages.filter((page) => {
          if (courseIndex < startIndex || courseIndex > endIndex) return false;
          if (courseIndex === startIndex && page < startPage) return false;
          if (courseIndex === endIndex && page > endPage) return false;
          return true;
        });
        if (pages.length) candidates.push({ ...exercise, courseId: course.id, courseIndex, matchedPages: pages });
      });
    });
    return { candidates, startCourseId, endCourseId, startPage, endPage };
  }

  async function generate(state) {
    const button = state.element.querySelector("[data-assessment-generate]");
    const status = state.element.querySelector("[data-assessment-status]");
    button.disabled = true;
    status.textContent = "Préparation de la feuille…";
    try {
      const level = currentLevel(state);
      const duration = Number(state.element.querySelector("[data-assessment-duration]").value);
      if (!Number.isFinite(duration) || duration < 5 || duration > 120) throw new Error("Choisissez une durée entre 5 et 120 minutes.");
      const calculator = state.element.querySelector("[data-assessment-calculator]").value;
      if (!calculator) throw new Error("Indiquez si la calculatrice est autorisée avant de générer la feuille.");
      const selection = scope(state);
      if (!selection.candidates.length) throw new Error("Aucun exercice ne correspond à ces pages.");
      const seed = `${level}|${selection.startCourseId}:${selection.startPage}|${selection.endCourseId}:${selection.endPage}|${duration}`;
      const result = window.AssessmentBank.selectExercises(selection.candidates, duration, seed);
      const exercises = result.exercises
        .sort((a, b) => a.courseIndex - b.courseIndex || Math.min(...a.matchedPages) - Math.min(...b.matchedPages) || a.id.localeCompare(b.id))
        .map(window.AssessmentBank.instantiate);
      const fitted = window.AssessmentPdf.fitToSinglePage(exercises);
      await window.AssessmentPdf.download({ level, exercises: fitted, calculator, practice: !state.adminMode });
      status.textContent = `${fitted.length} exercice${fitted.length > 1 ? "s" : ""} généré${fitted.length > 1 ? "s" : ""} sur une feuille recto.`;
    } catch (error) {
      status.textContent = error.message || "La feuille n’a pas pu être générée.";
    } finally { button.disabled = false; }
  }

  function mountAll() { document.querySelectorAll("[data-assessment-generator]").forEach(mount); }
  window.addEventListener("courses:changed", () => mounts.forEach(refresh));
  window.addEventListener("assessments:changed", () => mounts.forEach(refresh));
  window.AssessmentGenerator = { mountAll };
})();
