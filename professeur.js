(function () {
  "use strict";

  const loginView = document.querySelector("#login-view");
  const adminApp = document.querySelector("#admin-app");
  const loginButton = document.querySelector("#google-login");
  const loginMessage = document.querySelector("#login-message");
  const courseForm = document.querySelector("#course-form");
  const blockList = document.querySelector("#block-list");
  const saveButton = document.querySelector("#save-course");
  const publishButton = document.querySelector("#publish-course");
  const unpublishButton = document.querySelector("#unpublish-course");
  let accessGranted = false;
  let editorBlocks = [];
  let uploadedDuringEdit = new Set();

  const escapeHtml = CourseContent.escapeHtml;
  const normalizeSearch = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const formatDate = (value) => new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));

  function toast(message) {
    const element = document.querySelector("#toast");
    element.textContent = message;
    element.classList.add("visible");
    window.setTimeout(() => element.classList.remove("visible"), 3000);
  }

  function readableError(error) {
    const code = error?.code || "";
    if (code === "image-too-large") return "L’image reste trop lourde après compression.";
    if (code.includes("popup-closed") || code.includes("cancelled-popup")) return "Connexion annulée.";
    if (code.includes("popup-blocked")) return "La fenêtre de connexion a été bloquée par le navigateur.";
    if (code.includes("unauthorized-domain")) return "Ce site doit encore être autorisé dans Firebase.";
    if (code.includes("permission-denied")) return "Ce compte Google n’est pas autorisé à accéder au back-office.";
    if (code.includes("network-request-failed") || !navigator.onLine) return "Connexion impossible. Vérifiez votre accès à Internet.";
    return "Une erreur est survenue. Veuillez réessayer.";
  }

  function showLogin(message = "") {
    accessGranted = false;
    CourseStore.stopSubscriptions();
    adminApp.hidden = true;
    loginView.hidden = false;
    loginMessage.textContent = message;
    loginButton.disabled = false;
  }

  function showAdmin(user) {
    accessGranted = true;
    loginView.hidden = true;
    adminApp.hidden = false;
    document.querySelector("#account-label").textContent = user.email;
    CourseStore.startAdmin((error) => {
      showLogin(readableError(error));
      FirebaseBackend.signOut().catch(() => {});
    });
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
        <span><strong>${escapeHtml(CourseContent.displayTitle(course))}</strong><small>${course.slideCount} diapo${course.slideCount > 1 ? "s" : ""} · ${formatDate(course.updatedAt)}</small></span>
        <span class="status ${course.status}">${course.status === "published" ? "Publié" : "Brouillon"}</span>
      </button>
    `).join("") || '<p class="table-empty">Aucun cours enregistré.</p>';
  }

  function filteredCourses() {
    const query = normalizeSearch(document.querySelector("#admin-search").value);
    const level = document.querySelector("#level-filter").value;
    const status = document.querySelector("#status-filter").value;
    return CourseStore.all().filter((course) =>
      (!query || normalizeSearch(`${course.chapterNumber} ${course.title}`).includes(query)) &&
      (level === "all" || course.level === level) &&
      (status === "all" || course.status === status),
    );
  }

  function renderTable() {
    const courses = filteredCourses();
    document.querySelector("#course-table-body").innerHTML = courses.map((course) => `
      <tr>
        <td><strong class="chapter-number">${escapeHtml(course.chapterNumber || "—")}</strong></td>
        <td><strong>${escapeHtml(course.title)}</strong><small>${course.slideCount} diapo${course.slideCount > 1 ? "s" : ""}</small></td>
        <td><span class="level-pill level-${course.level}">${course.level}e</span></td>
        <td><button type="button" class="status-action ${course.status}" data-toggle-course="${course.id}">${course.status === "published" ? "Dépublier" : "Publier"}</button></td>
        <td><div class="order-actions"><button type="button" data-move-course="${course.id}" data-direction="-1" title="Monter">↑</button><button type="button" data-move-course="${course.id}" data-direction="1" title="Descendre">↓</button></div></td>
        <td>${formatDate(course.updatedAt)}</td>
        <td>
          <div class="row-actions">
            <button type="button" data-present-course="${course.id}" title="Projeter"><span aria-hidden="true">▶</span><span class="sr-only">Projeter ${escapeHtml(course.title)}</span></button>
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

  function updateEditorStatus(status) {
    courseForm.elements.status.value = status;
    const label = document.querySelector("#editor-status-label");
    label.textContent = status === "published" ? "Publié" : "Brouillon";
    label.className = `status ${status}`;
    saveButton.textContent = status === "published" ? "Enregistrer les modifications" : "Enregistrer le brouillon";
    publishButton.hidden = status === "published";
    unpublishButton.hidden = status !== "published";
  }

  function blockCard(block, index) {
    const type = CourseContent.TYPES[block.type];
    const imagePreviews = block.imageIds.map((imageId) => `
      <div class="block-image" data-image-id="${imageId}">
        <div class="image-loading">Chargement…</div>
        <label>Texte alternatif<input type="text" data-image-alt maxlength="160" placeholder="Décrire l’image" /></label>
        <button type="button" class="remove-image" data-remove-image="${imageId}">Retirer</button>
      </div>
    `).join("");
    return `
      <article class="block-editor block-${block.type}" data-block-id="${block.id}">
        <header class="block-editor-header">
          <div><span class="block-type-icon">${type.icon}</span><strong>${type.label}</strong><small>Bloc ${index + 1}</small></div>
          <div class="block-controls">
            <button type="button" data-move-block="-1" ${index === 0 ? "disabled" : ""} title="Monter le bloc">↑</button>
            <button type="button" data-move-block="1" ${index === editorBlocks.length - 1 ? "disabled" : ""} title="Descendre le bloc">↓</button>
            <button type="button" class="danger" data-remove-block title="Supprimer le bloc">×</button>
          </div>
        </header>
        <div class="rich-toolbar" aria-label="Mise en forme">
          <button type="button" data-format="bold" title="Gras"><strong>G</strong></button>
          <span>Mettre en valeur :</span>
          <button type="button" class="tone yellow" data-format="highlight" data-color="#ffe6a6" aria-label="Jaune"></button>
          <button type="button" class="tone blue" data-format="highlight" data-color="#dcecf2" aria-label="Bleu"></button>
          <button type="button" class="tone green" data-format="highlight" data-color="#d9eee5" aria-label="Vert"></button>
          <button type="button" class="tone pink" data-format="highlight" data-color="#f7deda" aria-label="Rose"></button>
        </div>
        <div class="block-richtext" contenteditable="true" role="textbox" aria-multiline="true" data-placeholder="Écrivez le contenu de ce bloc…">${CourseContent.sanitizeHtml(block.html)}</div>
        ${block.type === "property" ? `<label class="admitted-option"><input type="checkbox" data-admitted ${block.admitted ? "checked" : ""} /> Propriété admise <small>Elle sera présentée avec un style distinct.</small></label>` : ""}
        <div class="block-options">
          <label><input type="checkbox" data-slide-break ${block.slideBreakBefore ? "checked" : ""} ${index === 0 ? "disabled" : ""} /> Nouvelle diapo avant ce bloc</label>
          <label><input type="checkbox" data-reveal-break ${block.revealBreakBefore ? "checked" : ""} /> Révéler ce bloc au clic</label>
        </div>
        <details class="block-extras">
          <summary>Images et lien de projection</summary>
          <div class="block-images">${imagePreviews}</div>
          <label class="image-upload">Ajouter des images<input type="file" data-image-upload accept="image/png,image/jpeg,image/webp" multiple /></label>
          <p class="field-help">Les images sont automatiquement compressées. Maximum 8 par bloc.</p>
          <div class="teacher-link-fields">
            <label>Nom du lien professeur<input type="text" data-teacher-label maxlength="80" value="${escapeHtml(block.teacherLabel)}" placeholder="Ex. Animation GeoGebra" /></label>
            <label>Adresse du lien<input type="url" data-teacher-url value="${escapeHtml(block.teacherUrl)}" placeholder="https://…" /></label>
          </div>
          <p class="field-help">Ce lien apparaîtra uniquement lorsque vous projetterez depuis le back-office. Il est absent du cours élève et du PDF.</p>
        </details>
      </article>
    `;
  }

  function syncBlocksFromDom() {
    editorBlocks = [...blockList.querySelectorAll("[data-block-id]")].map((card, index) => {
      const previous = editorBlocks.find((block) => block.id === card.dataset.blockId) || {};
      return CourseContent.normalizeBlock({
        ...previous,
        html: card.querySelector(".block-richtext").innerHTML,
        admitted: Boolean(card.querySelector("[data-admitted]")?.checked),
        slideBreakBefore: index > 0 && card.querySelector("[data-slide-break]").checked,
        revealBreakBefore: card.querySelector("[data-reveal-break]").checked,
        teacherLabel: card.querySelector("[data-teacher-label]").value,
        teacherUrl: card.querySelector("[data-teacher-url]").value,
      });
    });
  }

  async function hydrateImages() {
    const previews = [...blockList.querySelectorAll("[data-image-id]")];
    await Promise.all(previews.map(async (preview) => {
      try {
        const image = await CourseStore.getImage(preview.dataset.imageId);
        if (!image || !preview.isConnected) return;
        const img = document.createElement("img");
        img.src = image.dataUrl;
        img.alt = image.alt;
        preview.querySelector(".image-loading").replaceWith(img);
        preview.querySelector("[data-image-alt]").value = image.alt;
      } catch {
        if (preview.isConnected) preview.querySelector(".image-loading").textContent = "Image indisponible";
      }
    }));
  }

  function renderBlocks() {
    blockList.innerHTML = editorBlocks.map(blockCard).join("");
    const count = editorBlocks.length;
    document.querySelector("#block-count").textContent = `${count} bloc${count > 1 ? "s" : ""}`;
    hydrateImages();
  }

  function addBlock(type) {
    syncBlocksFromDom();
    const block = CourseContent.normalizeBlock({ id: CourseContent.id("block"), type });
    editorBlocks.push(block);
    renderBlocks();
    blockList.querySelector(`[data-block-id="${block.id}"] .block-richtext`).focus();
  }

  async function cleanupNewUploads() {
    const ids = [...uploadedDuringEdit];
    uploadedDuringEdit = new Set();
    await Promise.allSettled(ids.map((id) => CourseStore.deleteImage(id)));
  }

  function openEditor(id = "") {
    courseForm.reset();
    uploadedDuringEdit = new Set();
    const course = id ? CourseStore.get(id) : null;
    courseForm.elements.id.value = course?.id || CourseContent.id("course");
    courseForm.elements.title.value = course?.title || "";
    courseForm.elements.chapterNumber.value = course?.chapterNumber || "";
    courseForm.elements.level.value = course?.level || "6";
    editorBlocks = course?.blocks.map((block) => ({ ...block, imageIds: [...block.imageIds] })) || [CourseContent.normalizeBlock({ type: "text" })];
    document.querySelector("#editor-title").textContent = course ? "Modifier le cours" : "Nouveau cours";
    updateEditorStatus(course?.status || "draft");
    renderBlocks();
    showView("editor");
    courseForm.elements.title.focus();
  }

  function renderAll() {
    renderStats();
    renderTable();
  }

  async function runMutation(action, successMessage) {
    try {
      await action();
      toast(successMessage);
    } catch (error) {
      toast(readableError(error));
    }
  }

  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const objectUrl = URL.createObjectURL(file);
      image.onload = () => {
        URL.revokeObjectURL(objectUrl);
        let width = image.naturalWidth;
        let height = image.naturalHeight;
        const maximum = 1600;
        if (Math.max(width, height) > maximum) {
          const ratio = maximum / Math.max(width, height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        let quality = 0.88;
        let dataUrl = "";
        for (let attempt = 0; attempt < 8; attempt += 1) {
          canvas.width = width;
          canvas.height = height;
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, width, height);
          context.drawImage(image, 0, 0, width, height);
          dataUrl = canvas.toDataURL("image/jpeg", quality);
          if (dataUrl.length <= 650000) break;
          quality = Math.max(0.55, quality - 0.07);
          width = Math.round(width * 0.85);
          height = Math.round(height * 0.85);
        }
        if (dataUrl.length > 650000) reject(Object.assign(new Error("Image too large"), { code: "image-too-large" }));
        else resolve(dataUrl);
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Invalid image"));
      };
      image.src = objectUrl;
    });
  }

  async function uploadImages(input) {
    syncBlocksFromDom();
    const card = input.closest("[data-block-id]");
    const block = editorBlocks.find((item) => item.id === card.dataset.blockId);
    const available = 8 - block.imageIds.length;
    const files = [...input.files].filter((file) => file.type.startsWith("image/")).slice(0, available);
    if (!files.length) return;
    input.disabled = true;
    try {
      for (const file of files) {
        const dataUrl = await compressImage(file);
        const saved = await CourseStore.saveImage({
          id: CourseContent.id("image"),
          courseId: courseForm.elements.id.value,
          dataUrl,
          alt: file.name.replace(/\.[^.]+$/, ""),
          published: false,
        });
        uploadedDuringEdit.add(saved.id);
        block.imageIds.push(saved.id);
      }
      renderBlocks();
      toast(`${files.length} image${files.length > 1 ? "s ajoutées" : " ajoutée"}.`);
    } catch (error) {
      toast(readableError(error));
    } finally {
      input.disabled = false;
      input.value = "";
    }
  }

  async function saveCourse(status) {
    if (!courseForm.reportValidity()) return;
    syncBlocksFromDom();
    if (!editorBlocks.length || !editorBlocks.some((block) => CourseContent.plainText(block.html) || block.imageIds.length)) {
      toast("Ajoutez du contenu avant d’enregistrer le cours.");
      return;
    }
    const existing = CourseStore.get(courseForm.elements.id.value);
    const buttons = [saveButton, publishButton, unpublishButton];
    buttons.forEach((button) => { button.disabled = true; });
    try {
      await CourseStore.save({
        ...existing,
        id: courseForm.elements.id.value,
        title: courseForm.elements.title.value,
        chapterNumber: courseForm.elements.chapterNumber.value,
        level: courseForm.elements.level.value,
        status,
        blocks: editorBlocks,
        manualOrder: existing?.manualOrder ?? null,
      });
      uploadedDuringEdit = new Set();
      showView("courses");
      toast(status === "published" ? "Cours publié." : existing ? "Cours mis à jour." : "Brouillon enregistré.");
    } catch (error) {
      toast(readableError(error));
    } finally {
      buttons.forEach((button) => { button.disabled = false; });
    }
  }

  loginButton.addEventListener("click", async () => {
    loginButton.disabled = true;
    loginMessage.textContent = "Ouverture de la connexion Google…";
    try {
      await FirebaseBackend.signIn();
    } catch (error) {
      loginMessage.textContent = readableError(error);
      loginButton.disabled = false;
    }
  });

  document.querySelector("#logout").addEventListener("click", () => FirebaseBackend.signOut());
  document.querySelector("#sidebar-toggle").addEventListener("click", () => document.querySelector(".admin-sidebar").classList.toggle("open"));
  document.querySelectorAll("[data-admin-view]").forEach((button) => button.addEventListener("click", () => button.dataset.adminView === "editor" ? openEditor() : showView(button.dataset.adminView)));
  document.querySelectorAll("[data-go-editor]").forEach((button) => button.addEventListener("click", () => openEditor()));
  document.querySelectorAll("[data-go-courses]").forEach((button) => button.addEventListener("click", () => showView("courses")));
  document.querySelector("#cancel-editor").addEventListener("click", async () => { await cleanupNewUploads(); showView("courses"); });
  document.querySelector("#reset-order").addEventListener("click", () => runMutation(() => CourseStore.resetOrder(document.querySelector("#level-filter").value), "Tri automatique rétabli."));
  ["#admin-search", "#level-filter", "#status-filter"].forEach((selector) => document.querySelector(selector).addEventListener("input", renderTable));
  document.querySelectorAll("[data-add-block]").forEach((button) => button.addEventListener("click", () => addBlock(button.dataset.addBlock)));
  window.addEventListener("courses:changed", () => { if (accessGranted) renderAll(); });

  blockList.addEventListener("mousedown", (event) => {
    if (event.target.closest("[data-format]")) event.preventDefault();
  });
  blockList.addEventListener("click", async (event) => {
    const card = event.target.closest("[data-block-id]");
    if (!card) return;
    const index = editorBlocks.findIndex((block) => block.id === card.dataset.blockId);
    const move = event.target.closest("[data-move-block]");
    const remove = event.target.closest("[data-remove-block]");
    const removeImage = event.target.closest("[data-remove-image]");
    const format = event.target.closest("[data-format]");
    if (move) {
      syncBlocksFromDom();
      const target = index + Number(move.dataset.moveBlock);
      if (target >= 0 && target < editorBlocks.length) [editorBlocks[index], editorBlocks[target]] = [editorBlocks[target], editorBlocks[index]];
      renderBlocks();
    }
    if (remove && window.confirm("Supprimer ce bloc ?")) {
      syncBlocksFromDom();
      editorBlocks.splice(index, 1);
      renderBlocks();
    }
    if (removeImage) {
      syncBlocksFromDom();
      const block = editorBlocks.find((item) => item.id === card.dataset.blockId);
      block.imageIds = block.imageIds.filter((id) => id !== removeImage.dataset.removeImage);
      if (uploadedDuringEdit.has(removeImage.dataset.removeImage)) {
        uploadedDuringEdit.delete(removeImage.dataset.removeImage);
        await CourseStore.deleteImage(removeImage.dataset.removeImage).catch(() => {});
      }
      renderBlocks();
    }
    if (format) {
      const editor = card.querySelector(".block-richtext");
      editor.focus();
      if (format.dataset.format === "bold") document.execCommand("bold", false);
      if (format.dataset.format === "highlight") document.execCommand("hiliteColor", false, format.dataset.color);
    }
  });
  blockList.addEventListener("change", async (event) => {
    if (event.target.matches("[data-image-upload]")) await uploadImages(event.target);
    if (event.target.matches("[data-image-alt]")) {
      const preview = event.target.closest("[data-image-id]");
      const image = await CourseStore.getImage(preview.dataset.imageId);
      if (image) await CourseStore.saveImage({ ...image, alt: event.target.value });
    }
  });

  courseForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveCourse(courseForm.elements.status.value);
  });
  publishButton.addEventListener("click", () => saveCourse("published"));
  unpublishButton.addEventListener("click", () => saveCourse("draft"));

  document.addEventListener("click", async (event) => {
    const edit = event.target.closest("[data-edit-course]");
    const present = event.target.closest("[data-present-course]");
    const pdf = event.target.closest("[data-pdf-course]");
    const duplicate = event.target.closest("[data-duplicate-course]");
    const remove = event.target.closest("[data-delete-course]");
    const toggle = event.target.closest("[data-toggle-course]");
    const move = event.target.closest("[data-move-course]");
    if (edit) openEditor(edit.dataset.editCourse);
    if (present) window.open(`presentation.html?course=${encodeURIComponent(present.dataset.presentCourse)}&mode=teacher`, "_blank", "noopener");
    if (pdf) await runMutation(() => CoursePdf.download(CourseStore.get(pdf.dataset.pdfCourse)), "PDF généré.");
    if (duplicate) await runMutation(() => CourseStore.duplicate(duplicate.dataset.duplicateCourse), "Copie créée en brouillon.");
    if (toggle) await runMutation(() => CourseStore.toggleStatus(toggle.dataset.toggleCourse), CourseStore.get(toggle.dataset.toggleCourse)?.status === "published" ? "Cours dépublié." : "Cours publié.");
    if (move) await runMutation(() => CourseStore.move(move.dataset.moveCourse, Number(move.dataset.direction)), "Ordre modifié.");
    if (remove) {
      const course = CourseStore.get(remove.dataset.deleteCourse);
      if (course && window.confirm(`Supprimer définitivement « ${CourseContent.displayTitle(course)} » ?`)) {
        await runMutation(() => CourseStore.remove(course.id), "Cours supprimé.");
      }
    }
  });

  if (!window.FirebaseBackend?.configured) {
    showLogin("La configuration Firebase est absente.");
    loginButton.disabled = true;
  } else {
    FirebaseBackend.onAuth(async (user) => {
      if (!user) {
        showLogin();
        return;
      }
      loginMessage.textContent = "Vérification des autorisations…";
      try {
        await FirebaseBackend.verifyProfessor();
        showAdmin(user);
      } catch (error) {
        await FirebaseBackend.signOut().catch(() => {});
        showLogin(readableError(error));
      }
    });
  }
})();
