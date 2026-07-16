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
  let course = null;
  let slides = [];
  let slideIndex = 0;
  let revealIndex = 0;
  let zoomLevel = 1;

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
    const resourceUrl = CourseContent.safeUrl(block.teacherUrl);
    const resourceLabel = CourseContent.escapeHtml(block.teacherLabel || "la ressource associée à ce bloc");
    const hidden = stageNumber > revealIndex;
    const newlyRevealed = !hidden && stageNumber > 0 && stageNumber === revealedStage;
    return `
      <section class="course-block block-${block.type}${block.admitted ? " admitted" : ""}${hidden ? " reveal-hidden" : ""}${newlyRevealed ? " reveal-new" : ""}" data-block-id="${block.id}">
        ${resourceUrl ? `<a class="block-resource-link" href="${resourceUrl}" target="_blank" rel="noopener noreferrer" aria-label="Ouvrir ${resourceLabel}" title="Ouvrir ${resourceLabel}"><span aria-hidden="true">↗</span></a>` : ""}
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
    errorView.hidden = true;
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
  zoomOut.addEventListener("click", () => changeZoom(-.1));
  zoomIn.addEventListener("click", () => changeZoom(.1));
  document.querySelector("#presentation-pdf").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try { await CoursePdf.download(course); } finally { button.disabled = false; }
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
    if (["Enter", " "].includes(event.key) && event.target.closest("a, button")) return;
    if (["ArrowRight", "PageDown", "Enter", " "].includes(event.key)) { event.preventDefault(); next(); }
    if (["ArrowLeft", "PageUp", "Backspace"].includes(event.key)) { event.preventDefault(); previous(); }
    if (["+", "="].includes(event.key)) { event.preventDefault(); changeZoom(.1); }
    if (event.key === "-") { event.preventDefault(); changeZoom(-.1); }
    if (event.key === "0") { event.preventDefault(); zoomLevel = 1; updateZoom(); }
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
