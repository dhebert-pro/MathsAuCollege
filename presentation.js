(function () {
  "use strict";

  const parameters = new URLSearchParams(window.location.search);
  const courseId = parameters.get("course");
  const teacherMode = parameters.get("mode") === "teacher";
  const loading = document.querySelector("#presentation-loading");
  const errorView = document.querySelector("#presentation-error");
  const stage = document.querySelector("#presentation-stage");
  const slideElement = document.querySelector("#slide");
  const zoomOut = document.querySelector("#zoom-out");
  const zoomIn = document.querySelector("#zoom-in");
  const zoomLabel = document.querySelector("#zoom-label");
  const exerciseButton = document.querySelector("#presentation-exercises");
  const trackingToggle = document.querySelector("#tracking-toggle");
  const trackingPanel = document.querySelector("#tracking-panel");
  const trackingSelect = document.querySelector("#tracking-class");
  const trackingNewLevel = document.querySelector("#tracking-new-level");
  const trackingActiveClass = document.querySelector("#tracking-active-class");
  const trackingPosition = document.querySelector("#tracking-position");
  const trackingExercises = document.querySelector("#tracking-exercises");
  const trackingStatus = document.querySelector("#tracking-status");
  const trackingMarkCurrent = document.querySelector("#tracking-mark-current");
  let course = null;
  let slides = [];
  let slideIndex = 0;
  let revealIndex = 0;
  let zoomLevel = 1;
  let teacherClasses = [];
  let activeClass = null;
  let completedExercises = new Set();
  let trackingReady = false;
  let trackingInitialized = false;
  let trackingSaveTimer = null;
  let trackingSaveChain = Promise.resolve();
  let trackingUser = null;
  let trackingSelectionToken = 0;
  let journalQueue = Promise.resolve();
  const journalCache = new Map();

  const trackingApi = {
    async request(path, options = {}) {
      if (!trackingUser) throw new Error("Compte professeur non vérifié");
      const token = await trackingUser.getIdToken();
      const base = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(window.FIREBASE_CONFIG.projectId)}/databases/(default)/documents/`;
      const response = await fetch(base + path, {
        ...options,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        cache: "no-store",
      });
      if (response.status === 404 && !options.method) return null;
      if (!response.ok) {
        const failure = new Error(`Firestore ${response.status}`);
        failure.status = response.status;
        throw failure;
      }
      return response.json();
    },
    async listTeachingClasses() {
      const classes = [];
      let pageToken = "";
      do {
        const suffix = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "";
        const data = await this.request(`teacherClasses?pageSize=100${suffix}`);
        (data?.documents || []).forEach((document) => {
          const fields = document.fields || {};
          classes.push({ id: fields.id?.stringValue || "", level: fields.level?.stringValue || "", name: fields.name?.stringValue || "" });
        });
        pageToken = data?.nextPageToken || "";
      } while (pageToken);
      return classes;
    },
    async addTeachingClass(level, name) {
      const item = { id: CourseContent.id("class"), level: String(level), name: String(name).trim().slice(0, 50) };
      if (!CourseContent.LEVELS.includes(item.level) || !item.name) throw new Error("Classe invalide");
      await this.request(`teacherClasses/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ fields: {
          id: { stringValue: item.id },
          level: { stringValue: item.level },
          name: { stringValue: item.name },
          createdAt: { stringValue: new Date().toISOString() },
        } }),
      });
      return item;
    },
    async getTeachingProgress(classId, courseId) {
      const document = await this.request(`teacherClasses/${encodeURIComponent(classId)}/progress/${encodeURIComponent(courseId)}`);
      if (!document) return null;
      const fields = document.fields || {};
      return {
        slideIndex: Number(fields.slideIndex?.integerValue) || 0,
        revealIndex: Number(fields.revealIndex?.integerValue) || 0,
        completedExercises: (fields.completedExercises?.arrayValue?.values || []).map((value) => value.stringValue).filter(Boolean),
      };
    },
    async saveTeachingProgress(classId, courseId, progress) {
      await this.request(`teacherClasses/${encodeURIComponent(classId)}/progress/${encodeURIComponent(courseId)}`, {
        method: "PATCH",
        body: JSON.stringify({ fields: {
          classId: { stringValue: classId },
          courseId: { stringValue: courseId },
          slideIndex: { integerValue: String(progress.slideIndex) },
          revealIndex: { integerValue: String(progress.revealIndex) },
          completedExercises: { arrayValue: { values: progress.completedExercises.map((value) => ({ stringValue: value })) } },
          updatedAt: { stringValue: new Date().toISOString() },
        } }),
      });
    },
  };

  try {
    const savedZoom = Number(localStorage.getItem("maths-presentation-zoom"));
    if (Number.isFinite(savedZoom) && savedZoom > 0) zoomLevel = savedZoom;
  } catch {}

  function fail(message) {
    loading.hidden = true;
    stage.hidden = true;
    errorView.hidden = false;
    document.querySelector("#presentation-error-message").textContent = message;
  }

  function progressKey() {
    return `maths-course-progress:${teacherMode ? "teacher" : "student"}:${courseId}`;
  }

  function saveProgress() {
    if (!course) return;
    if (teacherMode) {
      if (trackingReady && activeClass) {
        window.clearTimeout(trackingSaveTimer);
        trackingSaveTimer = window.setTimeout(persistTracking, 700);
        updateTrackingPosition();
      }
      return;
    }
    try {
      localStorage.setItem(progressKey(), JSON.stringify({ slideIndex, revealIndex }));
    } catch {}
  }

  function restoreProgress() {
    if (teacherMode) { slideIndex = 0; revealIndex = 0; return; }
    try {
      const saved = JSON.parse(localStorage.getItem(progressKey()) || "null");
      slideIndex = Math.max(0, Math.min(Number(saved?.slideIndex) || 0, slides.length));
      revealIndex = Math.max(0, Math.min(Number(saved?.revealIndex) || 0, maxReveal()));
    } catch {
      slideIndex = 0;
      revealIndex = 0;
    }
  }

  function setTrackingPanel(open) {
    if (trackingToggle.hidden) return;
    trackingPanel.hidden = !open;
    trackingToggle.setAttribute("aria-expanded", String(open));
    if (open) trackingSelect.focus();
  }

  function updateTrackingPosition() {
    trackingMarkCurrent.disabled = !trackingReady || !activeClass || slideIndex === 0;
    trackingToggle.classList.toggle("needs-class", !activeClass);
    trackingToggle.title = activeClass ? `Suivi de ${activeClass.name} (touche S)` : "Choisir une classe pour enregistrer le suivi (touche S)";
    trackingActiveClass.hidden = !teacherMode;
    trackingActiveClass.classList.toggle("needs-class", !activeClass);
    trackingActiveClass.textContent = activeClass ? `Classe suivie : ${activeClass.name} · ${activeClass.level}e` : "Aucune classe sélectionnée";
    if (!activeClass) {
      trackingPosition.textContent = "Choisissez une classe pour reprendre son cours.";
      return;
    }
    const place = slideIndex === 0 ? "page de titre" : `page ${slideIndex} sur ${slides.length}`;
    const reveal = slideIndex > 0 && maxReveal() > 0 ? ` · ${revealIndex + 1} bloc${revealIndex ? "s" : ""} affiché${revealIndex ? "s" : ""} sur ${maxReveal() + 1}` : "";
    trackingPosition.textContent = `${activeClass.name} : ${place}${reveal}`;
  }

  function blockSummary(block) {
    const text = CourseContent.plainText(block.html).replace(/\s+/g, " ").trim().slice(0, 320);
    return {
      id: block.id,
      label: block.type === "text" ? "Cours" : CourseContent.TYPES[block.type].label,
      text: text || (block.imageIds.length ? "Illustration étudiée en classe" : ""),
    };
  }

  function recordActivity({ blocks = [], exerciseId = "", checked = true, manual = false } = {}) {
    if (!teacherMode || !trackingReady || !activeClass || !course) return;
    if (activeClass.level !== course.level) {
      trackingStatus.textContent = "Ce cours n’est pas du niveau de la classe suivie. Rien n’a été noté.";
      return;
    }
    const classId = activeClass.id;
    const date = ClassJournal.dayKey();
    const courseSnapshot = course;
    const key = `${classId}:${date}:${courseSnapshot.id}`;
    const summaries = blocks.map(blockSummary);
    journalQueue = journalQueue.catch(() => {}).then(async () => {
      const existing = journalCache.get(key) || await ClassJournal.getCourse(classId, date, courseSnapshot.id);
      const recorded = existing || {
        classId, date, courseId: courseSnapshot.id,
        title: courseSnapshot.title, chapterNumber: courseSnapshot.chapterNumber,
        level: courseSnapshot.level, blocks: [], exercises: [], startedAt: new Date().toISOString(),
      };
      const nextBlocks = [...recorded.blocks];
      summaries.forEach((summary) => {
        if (!nextBlocks.some((item) => item.id === summary.id)) nextBlocks.push(summary);
      });
      const nextExercises = new Set(recorded.exercises);
      if (exerciseId && checked) nextExercises.add(exerciseId);
      if (exerciseId && !checked) nextExercises.delete(exerciseId);
      if (nextBlocks.length === recorded.blocks.length && nextExercises.size === recorded.exercises.length) {
        if (manual && activeClass?.id === classId) trackingStatus.textContent = "Cette page est déjà notée pour aujourd’hui.";
        return;
      }
      const updated = { ...recorded, blocks: nextBlocks, exercises: [...nextExercises], updatedAt: new Date().toISOString() };
      await ClassJournal.saveCourse(classId, date, courseSnapshot.id, updated);
      journalCache.set(key, updated);
      if (activeClass?.id === classId) trackingStatus.textContent = manual ? "Page ajoutée à la séance d’aujourd’hui." : "Séance notée pour le cahier de texte";
    }).catch(() => {
      if (activeClass?.id === classId) trackingStatus.textContent = "Séance non enregistrée. Vérifiez la connexion.";
    });
  }

  function recordCurrentVisible() {
    if (slideIndex === 0) return;
    trackingStatus.textContent = "Vérification de la séance d’aujourd’hui…";
    recordActivity({ blocks: slides[slideIndex - 1].slice(0, revealIndex + 1), manual: true });
  }

  function trackingErrorMessage(error) {
    if (error?.status === 401 || error?.status === 403) return "Accès refusé par Firebase. Reconnectez-vous à l’espace professeur.";
    if (error?.status === 429) return "Trop de demandes pour le moment. Réessayez dans quelques instants.";
    if (error?.status >= 500) return "Firebase est temporairement indisponible. Réessayez dans quelques instants.";
    if (error?.status) return `Firebase a refusé l’ajout (erreur ${error.status}).`;
    return "Connexion interrompue pendant l’ajout. Vérifiez votre connexion et réessayez.";
  }

  function renderTeachingClasses() {
    trackingSelect.replaceChildren(new Option("Choisir une classe", ""));
    teacherClasses.filter((item) => item.level === course?.level)
      .sort((a, b) => a.name.localeCompare(b.name, "fr", { numeric: true }))
      .forEach((item) => trackingSelect.add(new Option(item.name, item.id)));
    trackingSelect.value = activeClass?.id || "";
  }

  function renderExerciseTracking() {
    trackingExercises.replaceChildren();
    trackingExercises.hidden = !activeClass || !course?.exerciseFileId;
    if (trackingExercises.hidden) return;
    const heading = document.createElement("h3");
    heading.textContent = "Exercices déjà faits";
    trackingExercises.append(heading);
    for (let page = 1; page <= slides.length; page += 1) {
      const row = document.createElement("div");
      row.className = "tracking-exercise-row";
      const title = document.createElement("span");
      title.textContent = `Page ${page}`;
      row.append(title);
      for (let number = page * 2 - 1; number <= page * 2; number += 1) {
        const label = document.createElement("label");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = `ex-${number}`;
        checkbox.checked = completedExercises.has(checkbox.value);
        label.append(checkbox, ` Ex. ${number}`);
        row.append(label);
      }
      trackingExercises.append(row);
    }
    const complex = document.createElement("label");
    complex.className = "tracking-complex";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = "complex";
    checkbox.checked = completedExercises.has("complex");
    complex.append(checkbox, " Tâche complexe");
    trackingExercises.append(complex);
  }

  function persistTracking() {
    trackingSaveTimer = null;
    if (!trackingReady || !activeClass || !course) return trackingSaveChain;
    const classId = activeClass.id;
    const courseIdToSave = course.id;
    const snapshot = { slideIndex, revealIndex, completedExercises: [...completedExercises] };
    trackingStatus.textContent = "Enregistrement…";
    trackingSaveChain = trackingSaveChain.catch(() => {}).then(() =>
      trackingApi.saveTeachingProgress(classId, courseIdToSave, snapshot)
    ).then(() => { if (activeClass?.id === classId) trackingStatus.textContent = "Suivi enregistré"; })
      .catch(() => { if (activeClass?.id === classId) trackingStatus.textContent = "Échec de l’enregistrement. Vérifiez la connexion."; });
    return trackingSaveChain;
  }

  async function flushTracking() {
    if (trackingSaveTimer) {
      window.clearTimeout(trackingSaveTimer);
      trackingSaveTimer = null;
      await persistTracking();
    } else {
      await trackingSaveChain;
    }
  }

  async function selectTeachingClass(classId) {
    const selectionToken = ++trackingSelectionToken;
    await flushTracking();
    if (selectionToken !== trackingSelectionToken) return;
    trackingReady = false;
    activeClass = teacherClasses.find((item) => item.id === classId && item.level === course.level) || null;
    trackingSelect.value = activeClass?.id || "";
    if (!activeClass) {
      try { localStorage.removeItem(`maths-teacher-class:${course.level}`); } catch {}
      completedExercises = new Set();
      renderExerciseTracking();
      updateTrackingPosition();
      return;
    }
    trackingStatus.textContent = "Chargement du suivi…";
    try {
      const saved = await trackingApi.getTeachingProgress(activeClass.id, course.id);
      if (selectionToken !== trackingSelectionToken) return;
      slideIndex = Math.max(0, Math.min(Number(saved?.slideIndex) || 0, slides.length));
      revealIndex = Math.max(0, Math.min(Number(saved?.revealIndex) || 0, maxReveal()));
      completedExercises = new Set(Array.isArray(saved?.completedExercises) ? saved.completedExercises : []);
      try { localStorage.setItem(`maths-teacher-class:${course.level}`, activeClass.id); } catch {}
      render();
      renderExerciseTracking();
      trackingReady = true;
      updateTrackingPosition();
      trackingStatus.textContent = saved ? "Dernier arrêt retrouvé" : "Nouveau suivi pour cette classe";
    } catch {
      if (selectionToken !== trackingSelectionToken) return;
      activeClass = null;
      trackingSelect.value = "";
      trackingStatus.textContent = "Suivi indisponible. Vérifiez la connexion avant de commencer.";
    }
  }

  async function initializeTracking() {
    if (trackingInitialized) return;
    trackingInitialized = true;
    try {
      teacherClasses = await trackingApi.listTeachingClasses();
      trackingToggle.hidden = false;
      renderTeachingClasses();
      updateTrackingPosition();
      const savedId = localStorage.getItem(`maths-teacher-class:${course.level}`);
      if (savedId && teacherClasses.some((item) => item.id === savedId && item.level === course.level)) {
        await selectTeachingClass(savedId);
      }
    } catch {
      trackingInitialized = false;
      trackingToggle.hidden = false;
      trackingStatus.textContent = "Suivi indisponible. Vérifiez la connexion ou les droits d’accès.";
    }
  }

  function stagesFor(slide) {
    let stageNumber = 0;
    return slide.map((block, index) => {
      if (index > 0) stageNumber += 1;
      return { block, stageNumber };
    });
  }

  function blockHtml(block, stageNumber, revealedStage) {
    const type = CourseContent.TYPES[block.type];
    const validLinks = block.links.filter((link) => link.url);
    const resourceLinks = validLinks.map((link, linkIndex) => {
      const resourceLabel = CourseContent.escapeHtml(link.label || "la ressource associée à ce bloc");
      const marker = validLinks.length === 1 ? "↗" : String(linkIndex + 1);
      return `<a class="block-resource-link" href="${link.url}" target="_blank" rel="noopener noreferrer" aria-label="Ouvrir ${resourceLabel}" title="${resourceLabel}"><span aria-hidden="true">${marker}</span></a>`;
    }).join("");
    const hidden = stageNumber > revealIndex;
    const newlyRevealed = !hidden && stageNumber > 0 && stageNumber === revealedStage;
    return `
      <section class="course-block block-${block.type}${block.admitted ? " admitted" : ""}${hidden ? " reveal-hidden" : ""}${newlyRevealed ? " reveal-new" : ""}" data-block-id="${block.id}">
        ${resourceLinks ? `<nav class="block-resource-links links-count-${Math.min(validLinks.length, 8)}" aria-label="Ressources associées">${resourceLinks}</nav>` : ""}
        ${block.type === "text" ? "" : `<h2>${type.label}${block.admitted ? " · admise" : ""}</h2>`}
        <div class="block-content">${CourseContent.sanitizeHtml(block.html)}</div>
        ${block.imageIds.length ? `<div class="block-images-view">${block.imageIds.map((id) => `<div data-presentation-image="${id}"></div>`).join("")}</div>` : ""}
      </section>
    `;
  }

  async function hydrateImages() {
    const holders = [...slideElement.querySelectorAll("[data-presentation-image]")];
    await Promise.all(holders.map(async (holder) => {
      try {
        const image = await CourseStore.getImage(holder.dataset.presentationImage);
        if (!image || !holder.isConnected) return;
        const element = document.createElement("img");
        element.src = image.dataUrl;
        element.alt = image.alt;
        if (image.dataUrl.startsWith("data:image/png")) element.classList.add("transparent-image");
        holder.replaceWith(element);
      } catch {
        holder.remove();
      }
    }));
  }

  function updateZoom() {
    const percent = Math.round(zoomLevel * 100);
    slideElement.style.setProperty("--presentation-zoom", String(zoomLevel));
    slideElement.style.setProperty("--presentation-font-size", `${zoomLevel}rem`);
    slideElement.style.setProperty("--presentation-image-height", `${Math.round(300 * zoomLevel)}px`);
    zoomLabel.value = `${percent} %`;
    zoomLabel.textContent = `${percent} %`;
    zoomOut.disabled = zoomLevel <= .1;
    zoomIn.disabled = false;
    try { localStorage.setItem("maths-presentation-zoom", String(zoomLevel)); } catch {}
  }

  function changeZoom(delta) {
    zoomLevel = Math.max(.1, Math.round((zoomLevel + delta) * 10) / 10);
    updateZoom();
  }

  function clonePage(className) {
    const sheet = slideElement.cloneNode(true);
    sheet.removeAttribute("id");
    sheet.removeAttribute("aria-live");
    sheet.setAttribute("aria-hidden", "true");
    sheet.classList.remove("page-under", "page-return-target");
    sheet.classList.add("page-turn-sheet", className);
    slideElement.parentElement.append(sheet);
    sheet.scrollTop = slideElement.scrollTop;
    return sheet;
  }

  function preparePageTurn(direction) {
    slideElement.parentElement.querySelectorAll(".page-turn-sheet").forEach((sheet) => sheet.remove());
    if (!direction || !slideElement.innerHTML.trim() || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return null;
    const sheet = clonePage(direction === "next" ? "turn-forward" : "page-old-under");
    if (direction === "next") {
      sheet.addEventListener("animationend", () => sheet.remove(), { once: true });
      window.setTimeout(() => sheet.remove(), 1000);
    }
    return sheet;
  }

  function finishBackwardTurn(oldSheet) {
    if (!oldSheet) return;
    slideElement.classList.add("page-return-target");
    const returningSheet = clonePage("turn-backward");
    returningSheet.classList.remove("page-return-target");
    const finish = () => {
      returningSheet.remove();
      oldSheet.remove();
      slideElement.classList.remove("page-return-target");
    };
    returningSheet.addEventListener("animationend", finish, { once: true });
    window.setTimeout(finish, 1000);
  }

  function maxReveal() {
    if (slideIndex === 0) return 0;
    const staged = stagesFor(slides[slideIndex - 1]);
    return staged.length ? Math.max(...staged.map((item) => item.stageNumber)) : 0;
  }

  function updateControls() {
    const total = slides.length + 1;
    document.querySelector("#slide-counter").textContent = `${slideIndex + 1} / ${total}`;
    document.querySelector("#progress-bar").style.width = `${((slideIndex + 1) / total) * 100}%`;
    document.querySelector("#previous-step").disabled = slideIndex === 0 && revealIndex === 0;
    document.querySelector("#next-step").disabled = slideIndex === total - 1 && revealIndex >= maxReveal();
    document.querySelector("#reveal-hint").textContent = revealIndex < maxReveal() ? "Cliquez pour révéler la suite" : slideIndex < total - 1 ? "Continuer" : "Fin du cours";
    exerciseButton.hidden = !course?.exerciseFileId || slideIndex === 0;
    if (!exerciseButton.hidden) exerciseButton.textContent = `Ex. ${slideIndex * 2 - 1} et ${slideIndex * 2}`;
    saveProgress();
  }

  function updateRevealOnly(revealedStage = null) {
    if (slideIndex === 0) return;
    stagesFor(slides[slideIndex - 1]).forEach(({ block, stageNumber }) => {
      const element = slideElement.querySelector(`[data-block-id="${block.id}"]`);
      if (!element) return;
      element.classList.remove("reveal-new");
      element.classList.toggle("reveal-hidden", stageNumber > revealIndex);
      if (revealedStage !== null && stageNumber === revealedStage) {
        void element.offsetWidth;
        element.classList.add("reveal-new");
      }
    });
    updateControls();
  }

  function render({ direction = "", revealedStage = null } = {}) {
    const oldSheet = preparePageTurn(direction);
    if (slideIndex === 0) {
      slideElement.className = "slide slide-cover";
      slideElement.dataset.blockCount = "0";
      slideElement.innerHTML = `<div class="cover-decoration" aria-hidden="true"><span>π</span><span>x²</span><span>△</span></div><div class="cover-content">${course.chapterNumber ? `<span class="cover-number">Chapitre ${CourseContent.escapeHtml(course.chapterNumber)}</span>` : ""}<h1>${CourseContent.escapeHtml(course.title)}</h1></div>`;
    } else {
      slideElement.className = "slide";
      const currentSlide = slides[slideIndex - 1];
      slideElement.dataset.blockCount = String(currentSlide.length);
      slideElement.innerHTML = stagesFor(currentSlide).map(({ block, stageNumber }) => blockHtml(block, stageNumber, revealedStage)).join("");
      hydrateImages();
    }
    if (direction === "next" && oldSheet) {
      slideElement.classList.add("page-under");
      window.setTimeout(() => slideElement.classList.remove("page-under"), 750);
    } else if (direction === "previous") {
      finishBackwardTurn(oldSheet);
    }
    slideElement.scrollTop = 0;
    updateZoom();
    updateControls();
  }

  function next() {
    if (revealIndex < maxReveal()) {
      revealIndex += 1;
      updateRevealOnly(revealIndex);
      recordActivity({ blocks: [slides[slideIndex - 1][revealIndex]] });
    } else if (slideIndex < slides.length) {
      slideIndex += 1;
      revealIndex = 0;
      render({ direction: "next" });
      if (slides[slideIndex - 1][0]) recordActivity({ blocks: [slides[slideIndex - 1][0]] });
    }
  }

  function previous() {
    if (revealIndex > 0) {
      revealIndex -= 1;
      updateRevealOnly();
    } else if (slideIndex > 0) {
      slideIndex -= 1;
      revealIndex = maxReveal();
      render({ direction: "previous" });
    }
  }

  function restart() {
    slideIndex = 0;
    revealIndex = 0;
    render({ direction: "previous" });
  }

  function showCourse(value, reset = true) {
    course = value;
    slides = CourseContent.groupSlides(course.blocks);
    if (reset) restoreProgress();
    else {
      slideIndex = Math.min(slideIndex, slides.length);
      revealIndex = Math.min(revealIndex, maxReveal());
    }
    document.title = `${CourseContent.displayTitle(course)} · Maths au collège`;
    document.querySelector("#presentation-level").textContent = `${course.level}e`;
    trackingNewLevel.value = course.level;
    document.querySelector("#teacher-mode-badge").hidden = !teacherMode;
    document.querySelector("#presentation-close").href = teacherMode ? "professeur.html" : `index.html#niveau-${course.level}`;
    loading.hidden = true;
    errorView.hidden = true;
    stage.hidden = false;
    render();
    if (trackingInitialized) {
      renderTeachingClasses();
      renderExerciseTracking();
    }
  }

  async function loadPublic() {
    try {
      const value = await CourseStore.getPublished(courseId);
      if (!value) fail("Ce cours n’est pas publié ou n’existe plus.");
      else showCourse(value);
    } catch {
      fail("Le cours n’a pas pu être chargé. Vérifiez votre connexion.");
    }
  }

  document.querySelector("#next-step").addEventListener("click", next);
  document.querySelector("#previous-step").addEventListener("click", previous);
  document.querySelector("#presentation-restart").addEventListener("click", restart);
  trackingToggle.addEventListener("click", () => setTrackingPanel(trackingPanel.hidden));
  trackingMarkCurrent.addEventListener("click", recordCurrentVisible);
  document.querySelector("#tracking-close").addEventListener("click", () => setTrackingPanel(false));
  trackingSelect.addEventListener("change", () => selectTeachingClass(trackingSelect.value));
  document.querySelector("#tracking-add-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = document.querySelector("#tracking-new-class");
    const name = input.value.trim();
    if (!name || !course) return;
    const level = trackingNewLevel.value;
    const existing = teacherClasses.find((item) => item.level === level && item.name.toLocaleLowerCase("fr") === name.toLocaleLowerCase("fr"));
    if (existing) {
      if (level === course.level) {
        await selectTeachingClass(existing.id);
        if (activeClass?.id === existing.id) trackingStatus.textContent = "Cette classe existait déjà : elle est maintenant sélectionnée.";
      } else trackingStatus.textContent = `Cette classe de ${level}e existe déjà. Ouvrez un cours de ${level}e pour la suivre.`;
      return;
    }
    const button = event.currentTarget.querySelector("button");
    button.disabled = true;
    try {
      const added = await trackingApi.addTeachingClass(level, name);
      teacherClasses.push(added);
      input.value = "";
      renderTeachingClasses();
      if (level === course.level) await selectTeachingClass(added.id);
      else trackingStatus.textContent = `${name} créée en ${level}e. Ouvrez un cours de ${level}e pour la suivre.`;
    } catch (error) {
      try {
        teacherClasses = await trackingApi.listTeachingClasses();
        renderTeachingClasses();
        const recovered = teacherClasses.find((item) => item.level === level && item.name.toLocaleLowerCase("fr") === name.toLocaleLowerCase("fr"));
        if (recovered) {
          input.value = "";
          if (level === course.level) {
            await selectTeachingClass(recovered.id);
            if (activeClass?.id === recovered.id) trackingStatus.textContent = "Classe retrouvée et sélectionnée.";
          } else trackingStatus.textContent = `Classe de ${level}e retrouvée. Ouvrez un cours de ${level}e pour la suivre.`;
          return;
        }
      } catch {}
      trackingStatus.textContent = trackingErrorMessage(error);
    } finally { button.disabled = false; }
  });
  trackingExercises.addEventListener("change", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== "checkbox" || !trackingReady) return;
    if (input.checked) completedExercises.add(input.value);
    else completedExercises.delete(input.value);
    saveProgress();
    recordActivity({ exerciseId: input.value, checked: input.checked });
  });
  zoomOut.addEventListener("click", () => changeZoom(-.1));
  zoomIn.addEventListener("click", () => changeZoom(.1));
  document.querySelector("#presentation-pdf").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try { await CoursePdf.download(course); } finally { button.disabled = false; }
  });
  exerciseButton.addEventListener("click", async () => {
    exerciseButton.disabled = true;
    try { await CourseStore.openFile(course.exerciseFileId, Math.ceil(slideIndex / 2)); }
    finally { exerciseButton.disabled = false; }
  });
  document.querySelector("#fullscreen-button").addEventListener("click", () => document.documentElement.requestFullscreen?.());
  document.querySelector("#presentation-close").addEventListener("click", (event) => {
    if (teacherMode && window.opener) {
      event.preventDefault();
      window.close();
      return;
    }
    try {
      if (document.referrer && new URL(document.referrer).origin === window.location.origin && history.length > 1) {
        event.preventDefault();
        history.back();
      }
    } catch {}
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !trackingPanel.hidden) { setTrackingPanel(false); return; }
    if (event.target.closest("input, select, textarea, [contenteditable]")) return;
    if (teacherMode && !trackingToggle.hidden && event.key.toLowerCase() === "s" && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault(); setTrackingPanel(trackingPanel.hidden); return;
    }
    if (["Enter", " "].includes(event.key) && event.target.closest("a, button")) return;
    if (["ArrowRight", "PageDown", "Enter", " "].includes(event.key)) { event.preventDefault(); next(); }
    if (["ArrowLeft", "PageUp", "Backspace"].includes(event.key)) { event.preventDefault(); previous(); }
    if (["+", "="].includes(event.key)) { event.preventDefault(); changeZoom(.1); }
    if (event.key === "-") { event.preventDefault(); changeZoom(-.1); }
    if (event.key === "0") { event.preventDefault(); zoomLevel = 1; updateZoom(); }
    if (event.key === "Home") { event.preventDefault(); restart(); }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushTracking();
  });

  if (!courseId) {
    fail("Aucun cours n’a été demandé.");
  } else if (teacherMode) {
    const timeout = window.setTimeout(() => {
      if (!course) fail("La vérification du compte professeur prend trop de temps. Rechargez la page depuis le back-office.");
    }, 10000);

    CourseStore.getPublished(courseId).then((value) => {
      if (value && !course) {
        window.clearTimeout(timeout);
        showCourse(value);
      }
    }).catch(() => {});

    FirebaseBackend.onAuth(async (user) => {
      if (!user) {
        ClassJournal.setUser(null);
        trackingUser = null;
        trackingReady = false;
        trackingToggle.hidden = true;
        trackingPanel.hidden = true;
        if (!course) {
          const published = await CourseStore.getPublished(courseId).catch(() => null);
          if (!published) fail("Reconnectez-vous au back-office pour projeter ce brouillon.");
        }
        return;
      }
      try {
        await FirebaseBackend.verifyProfessor();
        ClassJournal.setUser(user);
        trackingUser = user;
        const value = await CourseStore.getPrivate(courseId);
        if (!value) {
          if (!course) fail("Ce cours n’existe plus.");
        } else {
          window.clearTimeout(timeout);
          showCourse(value, !course);
          await initializeTracking();
        }
      } catch {
        if (!course) {
          const published = await CourseStore.getPublished(courseId).catch(() => null);
          if (published) showCourse(published);
          else fail("Vous n’êtes pas autorisé à projeter ce cours.");
        }
      }
    });
  } else {
    loadPublic();
  }
})();
