(function () {
  "use strict";

  const parameters = new URLSearchParams(window.location.search);
  const courseId = parameters.get("course");
  const teacherMode = parameters.get("mode") === "teacher";
  const loading = document.querySelector("#presentation-loading");
  const errorView = document.querySelector("#presentation-error");
  const stage = document.querySelector("#presentation-stage");
  const slideElement = document.querySelector("#slide");
  const teacherToggle = document.querySelector("#teacher-links-toggle");
  const teacherPanel = document.querySelector("#teacher-links");
  let course = null;
  let slides = [];
  let slideIndex = 0;
  let revealIndex = 0;

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
    try {
      localStorage.setItem(progressKey(), JSON.stringify({ slideIndex, revealIndex }));
    } catch {}
  }

  function restoreProgress() {
    try {
      const saved = JSON.parse(localStorage.getItem(progressKey()) || "null");
      slideIndex = Math.max(0, Math.min(Number(saved?.slideIndex) || 0, slides.length));
      revealIndex = Math.max(0, Math.min(Number(saved?.revealIndex) || 0, maxReveal()));
    } catch {
      slideIndex = 0;
      revealIndex = 0;
    }
  }

  function stagesFor(slide) {
    let stageNumber = 0;
    return slide.map((block, index) => {
      if (index > 0 && block.revealBreakBefore) stageNumber += 1;
      return { block, stageNumber };
    });
  }

  function blockHtml(block, stageNumber, revealedStage) {
    const type = CourseContent.TYPES[block.type];
    const hidden = stageNumber > revealIndex;
    const newlyRevealed = !hidden && stageNumber > 0 && stageNumber === revealedStage;
    return `
      <section class="course-block block-${block.type}${block.admitted ? " admitted" : ""}${hidden ? " reveal-hidden" : ""}${newlyRevealed ? " reveal-new" : ""}" data-block-id="${block.id}">
        ${block.type === "text" ? "" : `<h2><span>${type.icon}</span>${type.label}${block.admitted ? " · admise" : ""}</h2>`}
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
        holder.replaceWith(element);
      } catch {
        holder.remove();
      }
    }));
  }

  function currentTeacherLinks() {
    if (!teacherMode || slideIndex === 0) return [];
    return stagesFor(slides[slideIndex - 1])
      .filter(({ block, stageNumber }) => block.teacherUrl && stageNumber <= revealIndex)
      .map(({ block }) => ({ id: block.id, label: block.teacherLabel || CourseContent.TYPES[block.type].label, url: block.teacherUrl }));
  }

  function teacherLinkHtml(link) {
    return `<a href="${CourseContent.safeUrl(link.url)}" target="_blank" rel="noopener noreferrer">Ouvrir ${CourseContent.escapeHtml(link.label)} <span aria-hidden="true">↗</span></a>`;
  }

  function renderTeacherLinks() {
    const current = currentTeacherLinks();
    teacherPanel.hidden = true;
    teacherToggle.hidden = !teacherMode;
    teacherToggle.disabled = current.length === 0;
    teacherToggle.dataset.singleUrl = current.length === 1 ? current[0].url : "";
    if (!current.length) {
      teacherToggle.innerHTML = 'Ressource du bloc <span aria-hidden="true">↗</span>';
      teacherToggle.title = "Le bouton s’activera lorsqu’un bloc possédant une ressource sera visible.";
      teacherPanel.innerHTML = "";
      return;
    }
    teacherToggle.title = "Ouvrir la ressource du bloc visible (raccourci L)";
    teacherToggle.innerHTML = current.length === 1
      ? `Ressource : ${CourseContent.escapeHtml(current[0].label)} <span aria-hidden="true">↗</span>`
      : `Ressources disponibles <span>${current.length}</span>`;
    teacherPanel.innerHTML = `
      <h2>Ressources du professeur</h2>
      <p class="teacher-links-help">Ces commandes sont placées hors de la page à recopier. Elles sont absentes du cours élève et du PDF.</p>
      ${current.map(teacherLinkHtml).join("")}
    `;
  }

  function openTeacherResource() {
    const current = currentTeacherLinks();
    if (current.length === 1) {
      window.open(CourseContent.safeUrl(current[0].url), "_blank", "noopener,noreferrer");
    } else if (current.length > 1) {
      teacherPanel.hidden = !teacherPanel.hidden;
    }
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
    renderTeacherLinks();
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
    teacherPanel.hidden = true;
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
    if (direction) {
      slideElement.classList.remove("page-turn-next", "page-turn-previous");
      void slideElement.offsetWidth;
      slideElement.classList.add(direction === "next" ? "page-turn-next" : "page-turn-previous");
    }
    updateControls();
  }

  function next() {
    if (revealIndex < maxReveal()) {
      revealIndex += 1;
      updateRevealOnly(revealIndex);
    } else if (slideIndex < slides.length) {
      slideIndex += 1;
      revealIndex = 0;
      render({ direction: "next" });
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
    document.querySelector("#teacher-mode-badge").hidden = !teacherMode;
    document.querySelector("#presentation-close").href = teacherMode ? "professeur.html" : `index.html#niveau-${course.level}`;
    loading.hidden = true;
    stage.hidden = false;
    render();
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
  document.querySelector("#presentation-pdf").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try { await CoursePdf.download(course); } finally { button.disabled = false; }
  });
  document.querySelector("#fullscreen-button").addEventListener("click", () => document.documentElement.requestFullscreen?.());
  teacherToggle.addEventListener("click", openTeacherResource);
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
    if (["ArrowRight", "PageDown", "Enter", " "].includes(event.key)) { event.preventDefault(); next(); }
    if (["ArrowLeft", "PageUp", "Backspace"].includes(event.key)) { event.preventDefault(); previous(); }
    if (teacherMode && event.key.toLowerCase() === "l") openTeacherResource();
    if (event.key === "Home") { event.preventDefault(); restart(); }
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
        if (!course) {
          const published = await CourseStore.getPublished(courseId).catch(() => null);
          if (!published) fail("Reconnectez-vous au back-office pour projeter ce brouillon.");
        }
        return;
      }
      try {
        await FirebaseBackend.verifyProfessor();
        const value = await CourseStore.getPrivate(courseId);
        if (!value) {
          if (!course) fail("Ce cours n’existe plus.");
        } else {
          window.clearTimeout(timeout);
          showCourse(value, !course);
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
