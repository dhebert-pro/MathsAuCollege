(function () {
  "use strict";

  const parameters = new URLSearchParams(window.location.search);
  const courseId = parameters.get("course");
  const teacherMode = parameters.get("mode") === "teacher";
  const loading = document.querySelector("#presentation-loading");
  const errorView = document.querySelector("#presentation-error");
  const stage = document.querySelector("#presentation-stage");
  const slideElement = document.querySelector("#slide");
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

  function stagesFor(slide) {
    let stageNumber = 0;
    return slide.map((block, index) => {
      if (index > 0 && block.revealBreakBefore) stageNumber += 1;
      return { block, stageNumber };
    });
  }

  function blockHtml(block, stageNumber) {
    const type = CourseContent.TYPES[block.type];
    return `
      <section class="course-block block-${block.type}${block.admitted ? " admitted" : ""}${stageNumber > revealIndex ? " reveal-hidden" : ""}" data-block-id="${block.id}">
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
    return slides[slideIndex - 1]
      .filter((block) => block.teacherUrl)
      .map((block) => ({ label: block.teacherLabel || CourseContent.TYPES[block.type].label, url: block.teacherUrl }));
  }

  function renderTeacherLinks() {
    const links = currentTeacherLinks();
    const toggle = document.querySelector("#teacher-links-toggle");
    toggle.hidden = !links.length;
    document.querySelector("#teacher-link-count").textContent = links.length;
    const panel = document.querySelector("#teacher-links");
    panel.innerHTML = `<h2>Ressources disponibles</h2>${links.map((link) => `<a href="${CourseContent.safeUrl(link.url)}" target="_blank" rel="noopener noreferrer">${CourseContent.escapeHtml(link.label)} ↗</a>`).join("")}`;
    if (!links.length) panel.hidden = true;
  }

  function maxReveal() {
    if (slideIndex === 0) return 0;
    const staged = stagesFor(slides[slideIndex - 1]);
    return staged.length ? Math.max(...staged.map((item) => item.stageNumber)) : 0;
  }

  function render() {
    if (slideIndex === 0) {
      slideElement.className = "slide slide-cover";
      slideElement.dataset.blockCount = "0";
      slideElement.innerHTML = `<div class="cover-decoration" aria-hidden="true"><span>π</span><span>x²</span><span>△</span></div><div class="cover-content"><img src="assets/logo.svg" alt="" width="64" height="64" /><span class="cover-number">${course.chapterNumber ? `Chapitre ${CourseContent.escapeHtml(course.chapterNumber)}` : `Mathématiques · ${course.level}e`}</span><h1>${CourseContent.escapeHtml(course.title)}</h1><p>Maths au collège · ${course.level}e</p></div>`;
    } else {
      slideElement.className = "slide";
      const currentSlide = slides[slideIndex - 1];
      slideElement.dataset.blockCount = String(currentSlide.length);
      slideElement.innerHTML = stagesFor(currentSlide).map(({ block, stageNumber }) => blockHtml(block, stageNumber)).join("");
      hydrateImages();
    }
    const total = slides.length + 1;
    document.querySelector("#slide-counter").textContent = `${slideIndex + 1} / ${total}`;
    document.querySelector("#progress-bar").style.width = `${((slideIndex + 1) / total) * 100}%`;
    document.querySelector("#previous-step").disabled = slideIndex === 0 && revealIndex === 0;
    document.querySelector("#next-step").disabled = slideIndex === total - 1 && revealIndex >= maxReveal();
    document.querySelector("#reveal-hint").textContent = revealIndex < maxReveal() ? "Cliquez pour révéler la suite" : slideIndex < total - 1 ? "Continuer" : "Fin du cours";
    renderTeacherLinks();
  }

  function next() {
    if (revealIndex < maxReveal()) revealIndex += 1;
    else if (slideIndex < slides.length) { slideIndex += 1; revealIndex = 0; }
    render();
  }

  function previous() {
    if (revealIndex > 0) revealIndex -= 1;
    else if (slideIndex > 0) { slideIndex -= 1; revealIndex = maxReveal(); }
    render();
  }

  function showCourse(value, reset = true) {
    course = value;
    slides = CourseContent.groupSlides(course.blocks);
    if (reset) {
      slideIndex = 0;
      revealIndex = 0;
    } else {
      slideIndex = Math.min(slideIndex, slides.length);
      revealIndex = Math.min(revealIndex, maxReveal());
    }
    document.title = `${CourseContent.displayTitle(course)} · Maths au collège`;
    document.querySelector("#presentation-level").textContent = `${course.level}e`;
    document.querySelector("#presentation-close").href = teacherMode ? "professeur.html" : `index.html#${course.level === "6" ? "sixieme" : "quatrieme"}`;
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
  document.querySelector("#presentation-pdf").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try { await CoursePdf.download(course); } finally { button.disabled = false; }
  });
  document.querySelector("#fullscreen-button").addEventListener("click", () => document.documentElement.requestFullscreen?.());
  document.querySelector("#teacher-links-toggle").addEventListener("click", () => {
    const panel = document.querySelector("#teacher-links");
    panel.hidden = !panel.hidden;
  });
  document.addEventListener("keydown", (event) => {
    if (["ArrowRight", "PageDown", "Enter", " "].includes(event.key)) { event.preventDefault(); next(); }
    if (["ArrowLeft", "PageUp", "Backspace"].includes(event.key)) { event.preventDefault(); previous(); }
    if (teacherMode && event.key.toLowerCase() === "l" && currentTeacherLinks().length) {
      const panel = document.querySelector("#teacher-links");
      panel.hidden = !panel.hidden;
    }
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
