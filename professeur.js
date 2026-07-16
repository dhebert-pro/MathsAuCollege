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
  let editorPageIndex = 0;
  let uploadedDuringEdit = new Set();
  let draggedBlockId = "";
  let savedSelectionRange = null;
  let savedSelectionEditor = null;

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
    if (name === "images") renderImageLibrary();
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
        <span><strong>${escapeHtml(CourseContent.displayTitle(course))}</strong><small>${course.slideCount} partie${course.slideCount > 1 ? "s" : ""} · ${formatDate(course.updatedAt)}</small></span>
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
        <td><strong>${escapeHtml(course.title)}</strong><small>${course.slideCount} partie${course.slideCount > 1 ? "s" : ""}</small></td>
        <td><span class="level-pill level-${course.level}">${course.level}e</span></td>
        <td><button type="button" class="status-action ${course.status}" data-toggle-course="${course.id}">${course.status === "published" ? "Dépublier" : "Publier"}</button></td>
        <td><div class="order-actions"><button type="button" data-move-course="${course.id}" data-direction="-1" title="Monter">↑</button><button type="button" data-move-course="${course.id}" data-direction="1" title="Descendre">↓</button></div></td>
        <td>${formatDate(course.updatedAt)}</td>
        <td>
          <div class="row-actions">
            <button type="button" class="present-course" data-present-course="${course.id}" title="Présenter avec les ressources professeur">▶ Présenter</button>
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

  function blockCard(block, index, pageIndex, pageCount, localIndex, pageLength) {
    const type = CourseContent.TYPES[block.type];
    const imagePreviews = block.imageIds.map((imageId) => `
      <div class="block-image" data-image-id="${imageId}">
        <div class="image-loading">Chargement…</div>
        <label>Texte alternatif<input type="text" data-image-alt maxlength="160" placeholder="Décrire l’image" /></label>
        <button type="button" class="remove-image" data-remove-image="${imageId}">Retirer</button>
      </div>
    `).join("");
    return `
      <article class="block-editor block-${block.type}${block.admitted ? " admitted" : ""}" data-block-id="${block.id}">
        <header class="block-editor-header">
          <div><button type="button" class="drag-handle" draggable="true" data-drag-block aria-label="Déplacer le bloc ${index + 1}" title="Faire glisser pour déplacer">⋮⋮</button><span class="block-type-icon">${type.icon}</span><strong>${type.label}</strong><small>Bloc ${index + 1}</small></div>
          <div class="block-controls">
            <select data-move-to-page aria-label="Déplacer le bloc vers une autre page" ${pageCount < 2 ? "disabled" : ""}>${Array.from({ length: pageCount }, (_, target) => `<option value="${target}" ${target === pageIndex ? "selected" : ""}>Vers page ${target + 1}</option>`).join("")}</select>
            <button type="button" data-move-block="-1" ${localIndex === 0 ? "disabled" : ""} title="Monter le bloc dans cette page">↑</button>
            <button type="button" data-move-block="1" ${localIndex === pageLength - 1 ? "disabled" : ""} title="Descendre le bloc dans cette page">↓</button>
            <button type="button" class="danger" data-remove-block title="Supprimer le bloc">×</button>
          </div>
        </header>
        <div class="rich-toolbar" aria-label="Mise en forme">
          <span>Sélectionnez la partie importante du texte :</span>
          <button type="button" class="highlight-button" data-format="highlight">Mettre en valeur</button>
        </div>
        <div class="block-richtext" contenteditable="true" role="textbox" aria-multiline="true" data-placeholder="Écrivez le contenu de ce bloc…">${CourseContent.sanitizeHtml(block.html)}</div>
        ${block.type === "property" ? `<label class="admitted-option"><input type="checkbox" data-admitted ${block.admitted ? "checked" : ""} /> Propriété admise <small>Elle sera présentée avec un style distinct.</small></label>` : ""}
        <details class="block-settings" open>
          <summary>Réglages, images et ressource professeur</summary>
          <div class="block-options">
            <p class="break-help"><strong>Apparition différée</strong> : réserve la place du bloc et le révèle au clic. La création et la navigation entre les pages se font au-dessus du document.</p>
            <label><input type="checkbox" data-reveal-break ${block.revealBreakBefore ? "checked" : ""} /> Faire apparaître ce bloc au clic suivant</label>
          </div>
          <div class="block-images">${imagePreviews}</div>
          <label class="image-upload">Ajouter des images<input type="file" data-image-upload accept="image/png,image/jpeg,image/webp" multiple /></label>
          <p class="field-help">Les images sont automatiquement compressées. Maximum 8 par bloc.</p>
          <div class="teacher-link-fields">
            <label>Nom du lien professeur<input type="text" data-teacher-label maxlength="80" value="${escapeHtml(block.teacherLabel)}" placeholder="Ex. Animation GeoGebra" /></label>
            <label>Adresse du lien<input type="url" data-teacher-url value="${escapeHtml(block.teacherUrl)}" placeholder="https://…" /></label>
            <button type="button" class="admin-button secondary" data-test-teacher-link>Tester le lien ↗</button>
          </div>
          <p class="field-help">La ressource sera proposée dans la barre du professeur uniquement lorsque ce bloc sera visible. Elle ne figurera jamais sur la page du cours ni dans le PDF.</p>
        </details>
      </article>
    `;
  }

  function syncBlocksFromDom() {
    [...blockList.querySelectorAll("[data-block-id]")].forEach((card) => {
      const index = editorBlocks.findIndex((block) => block.id === card.dataset.blockId);
      if (index < 0) return;
      const previous = editorBlocks[index];
      editorBlocks[index] = CourseContent.normalizeBlock({
        ...previous,
        html: card.querySelector(".block-richtext").innerHTML,
        admitted: Boolean(card.querySelector("[data-admitted]")?.checked),
        revealBreakBefore: card.querySelector("[data-reveal-break]").checked,
        teacherLabel: card.querySelector("[data-teacher-label]").value,
        teacherUrl: card.querySelector("[data-teacher-url]").value,
      });
    });
  }

  function getEditorPages() {
    const pages = [];
    editorBlocks.forEach((block) => {
      if (!pages.length || (block.slideBreakBefore && pages[pages.length - 1].length)) pages.push([]);
      pages[pages.length - 1].push(block);
    });
    return pages.length ? pages : [[]];
  }

  function applyEditorPages(pages) {
    const nonEmpty = pages.filter((page) => page.length);
    editorBlocks = nonEmpty.flatMap((page, pageIndex) => page.map((block, blockIndex) => CourseContent.normalizeBlock({
      ...block,
      slideBreakBefore: pageIndex > 0 && blockIndex === 0,
    })));
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
    const pages = getEditorPages();
    editorPageIndex = Math.max(0, Math.min(editorPageIndex, pages.length - 1));
    const page = pages[editorPageIndex];
    blockList.innerHTML = `
      <div class="editor-page-navigation">
        <button type="button" data-editor-page="previous" ${editorPageIndex === 0 ? "disabled" : ""} aria-label="Page précédente">←</button>
        <select data-editor-page-select aria-label="Page affichée">${pages.map((_, index) => `<option value="${index}" ${index === editorPageIndex ? "selected" : ""}>Page ${index + 1} sur ${pages.length}</option>`).join("")}</select>
        <button type="button" data-editor-page="next" ${editorPageIndex === pages.length - 1 ? "disabled" : ""} aria-label="Page suivante">→</button>
        <button type="button" class="insert-page" data-insert-page="before">＋ Page avant</button>
        <button type="button" class="insert-page" data-insert-page="after">＋ Page après</button>
      </div>
      <section class="editor-page">
        <div class="editor-page-label"><span>Page ${editorPageIndex + 1}</span><small>Une seule page à l’écran pour éviter les longs défilements</small></div>
        <div class="editor-page-canvas">${page.map((block, localIndex) => blockCard(block, editorBlocks.findIndex((item) => item.id === block.id), editorPageIndex, pages.length, localIndex, page.length)).join("") || '<p class="table-empty">Cette page est vide. Ajoutez un bloc.</p>'}</div>
      </section>
    `;
    const count = editorBlocks.length;
    document.querySelector("#block-count").textContent = `${count} bloc${count > 1 ? "s" : ""}`;
    hydrateImages();
  }

  function addBlock(type) {
    syncBlocksFromDom();
    const block = CourseContent.normalizeBlock({ id: CourseContent.id("block"), type });
    const pages = getEditorPages();
    pages[editorPageIndex].push(block);
    applyEditorPages(pages);
    renderBlocks();
    blockList.querySelector(`[data-block-id="${block.id}"] .block-richtext`).focus();
  }

  function insertPage(position) {
    syncBlocksFromDom();
    const pages = getEditorPages();
    const target = position === "before" ? editorPageIndex : editorPageIndex + 1;
    const block = CourseContent.normalizeBlock({ id: CourseContent.id("block"), type: "text" });
    pages.splice(target, 0, [block]);
    applyEditorPages(pages);
    editorPageIndex = target;
    renderBlocks();
    blockList.querySelector(`[data-block-id="${block.id}"] .block-richtext`)?.focus();
  }

  function moveBlockToPage(blockId, targetPage) {
    syncBlocksFromDom();
    const pages = getEditorPages();
    const sourcePage = pages.findIndex((page) => page.some((block) => block.id === blockId));
    if (sourcePage < 0 || targetPage < 0 || targetPage >= pages.length || sourcePage === targetPage) return;
    const sourceIndex = pages[sourcePage].findIndex((block) => block.id === blockId);
    const [block] = pages[sourcePage].splice(sourceIndex, 1);
    if (!pages[sourcePage].length) {
      pages.splice(sourcePage, 1);
      if (targetPage > sourcePage) targetPage -= 1;
    }
    pages[targetPage].push(block);
    applyEditorPages(pages);
    editorPageIndex = targetPage;
    renderBlocks();
  }

  async function cleanupNewUploads() {
    const ids = [...uploadedDuringEdit];
    uploadedDuringEdit = new Set();
    await Promise.allSettled(ids.map((id) => CourseStore.deleteImage(id)));
  }

  function openEditor(id = "") {
    courseForm.reset();
    uploadedDuringEdit = new Set();
    editorPageIndex = 0;
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

  const formatSize = (bytes) => bytes < 1024 ? `${bytes} o` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} Ko` : `${(bytes / 1024 / 1024).toFixed(1)} Mo`;

  async function renderImageLibrary() {
    const library = document.querySelector("#image-library");
    library.innerHTML = '<p class="table-empty">Chargement des images…</p>';
    try {
      const images = await CourseStore.listImages();
      const totalBytes = images.reduce((sum, image) => sum + Math.round(String(image.dataUrl || "").length * .75), 0);
      document.querySelector("#image-library-count").textContent = `${images.length} image${images.length > 1 ? "s" : ""}`;
      document.querySelector("#image-library-size").textContent = `Environ ${formatSize(totalBytes)}`;
      library.innerHTML = images.map((image) => {
        const course = CourseStore.get(image.courseId);
        const used = course?.blocks.some((block) => block.imageIds.includes(image.id));
        return `
          <article class="library-image" data-library-image="${image.id}">
            <img src="${image.dataUrl}" alt="${escapeHtml(image.alt)}" />
            <strong>${escapeHtml(image.alt || "Image sans description")}</strong>
            <small>${course ? escapeHtml(CourseContent.displayTitle(course)) : "Aucun cours associé"} · ${formatSize(Math.round(String(image.dataUrl || "").length * .75))}</small>
            <button type="button" data-delete-library-image="${image.id}" data-image-used="${used ? "true" : "false"}">Supprimer l’image</button>
          </article>
        `;
      }).join("") || '<p class="table-empty">Aucune image enregistrée.</p>';
    } catch (error) {
      library.innerHTML = `<p class="table-empty">${escapeHtml(readableError(error))}</p>`;
    }
  }

  async function deleteLibraryImage(imageId) {
    const affected = CourseStore.all().filter((course) => course.blocks.some((block) => block.imageIds.includes(imageId)));
    const warning = affected.length
      ? `Cette image est utilisée dans « ${CourseContent.displayTitle(affected[0])} ». La supprimer la retirera aussi du cours. Continuer ?`
      : "Supprimer définitivement cette image ?";
    if (!window.confirm(warning)) return;
    for (const course of affected) {
      await CourseStore.save({ ...course, blocks: course.blocks.map((block) => ({ ...block, imageIds: block.imageIds.filter((id) => id !== imageId) })) });
    }
    await CourseStore.deleteImage(imageId).catch(() => {});
    toast("Image supprimée.");
    await renderImageLibrary();
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
      image.onload = () => {
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
      image.onerror = () => reject(new Error("Invalid image"));
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Invalid image"));
      reader.onload = () => { image.src = String(reader.result || ""); };
      reader.readAsDataURL(file);
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

  function rememberSelection(editor) {
    const selection = window.getSelection();
    if (!selection?.rangeCount || selection.isCollapsed) return;
    const range = selection.getRangeAt(0);
    const targetEditor = editor || range.commonAncestorContainer.parentElement?.closest?.(".block-richtext") || (range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE ? range.commonAncestorContainer.closest?.(".block-richtext") : null);
    if (!targetEditor || !targetEditor.contains(range.commonAncestorContainer)) return;
    savedSelectionRange = range.cloneRange();
    savedSelectionEditor = targetEditor;
  }

  function highlightSelection(editor) {
    if (!savedSelectionRange || savedSelectionEditor !== editor || !editor.contains(savedSelectionRange.commonAncestorContainer)) {
      toast("Sélectionnez d’abord les mots à mettre en valeur.");
      return;
    }
    const range = savedSelectionRange.cloneRange();
    const mark = document.createElement("mark");
    mark.dataset.tone = "yellow";
    mark.appendChild(range.extractContents());
    range.insertNode(mark);
    editor.normalize();
    const selection = window.getSelection();
    selection.removeAllRanges();
    const highlighted = document.createRange();
    highlighted.selectNodeContents(mark);
    selection.addRange(highlighted);
    savedSelectionRange = highlighted.cloneRange();
    savedSelectionEditor = editor;
  }

  blockList.addEventListener("mousedown", (event) => {
    if (event.target.closest("[data-format]")) {
      rememberSelection(event.target.closest("[data-block-id]")?.querySelector(".block-richtext"));
      event.preventDefault();
    }
  });
  blockList.addEventListener("click", async (event) => {
    const pageDirection = event.target.closest("[data-editor-page]");
    const insert = event.target.closest("[data-insert-page]");
    if (pageDirection) {
      syncBlocksFromDom();
      editorPageIndex += pageDirection.dataset.editorPage === "next" ? 1 : -1;
      renderBlocks();
      return;
    }
    if (insert) {
      insertPage(insert.dataset.insertPage);
      return;
    }
    const card = event.target.closest("[data-block-id]");
    if (!card) return;
    const move = event.target.closest("[data-move-block]");
    const remove = event.target.closest("[data-remove-block]");
    const removeImage = event.target.closest("[data-remove-image]");
    const format = event.target.closest("[data-format]");
    const testLink = event.target.closest("[data-test-teacher-link]");
    if (move) {
      syncBlocksFromDom();
      const pages = getEditorPages();
      const page = pages[editorPageIndex];
      const index = page.findIndex((block) => block.id === card.dataset.blockId);
      const target = index + Number(move.dataset.moveBlock);
      if (target >= 0 && target < page.length) [page[index], page[target]] = [page[target], page[index]];
      applyEditorPages(pages);
      renderBlocks();
    }
    if (remove && window.confirm("Supprimer ce bloc ?")) {
      syncBlocksFromDom();
      const pages = getEditorPages();
      const page = pages[editorPageIndex];
      const index = page.findIndex((block) => block.id === card.dataset.blockId);
      if (index >= 0) page.splice(index, 1);
      applyEditorPages(pages);
      editorPageIndex = Math.min(editorPageIndex, Math.max(0, getEditorPages().length - 1));
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
      if (format.dataset.format === "highlight") highlightSelection(editor);
    }
    if (testLink) {
      const url = CourseContent.safeUrl(card.querySelector("[data-teacher-url]").value);
      if (!url) toast("Saisissez d’abord une adresse commençant par https://");
      else window.open(url, "_blank", "noopener,noreferrer");
    }
  });
  document.addEventListener("selectionchange", () => rememberSelection());
  blockList.addEventListener("change", async (event) => {
    if (event.target.matches("[data-editor-page-select]")) {
      syncBlocksFromDom();
      editorPageIndex = Number(event.target.value);
      renderBlocks();
      return;
    }
    if (event.target.matches("[data-move-to-page]")) {
      moveBlockToPage(event.target.closest("[data-block-id]").dataset.blockId, Number(event.target.value));
      return;
    }
    if (event.target.matches("[data-image-upload]")) await uploadImages(event.target);
    if (event.target.matches("[data-image-alt]")) {
      const preview = event.target.closest("[data-image-id]");
      const image = await CourseStore.getImage(preview.dataset.imageId);
      if (image) await CourseStore.saveImage({ ...image, alt: event.target.value });
    }
    if (event.target.matches("[data-admitted], [data-reveal-break]")) {
      syncBlocksFromDom();
      renderBlocks();
    }
  });

  function clearDropMarkers() {
    blockList.querySelectorAll(".drop-before, .drop-after, .dragging").forEach((card) => card.classList.remove("drop-before", "drop-after", "dragging"));
  }

  blockList.addEventListener("dragstart", (event) => {
    const handle = event.target.closest("[data-drag-block]");
    if (!handle) return;
    const card = handle.closest("[data-block-id]");
    syncBlocksFromDom();
    draggedBlockId = card.dataset.blockId;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", draggedBlockId);
    requestAnimationFrame(() => card.classList.add("dragging"));
  });
  blockList.addEventListener("dragover", (event) => {
    if (!draggedBlockId) return;
    const card = event.target.closest("[data-block-id]");
    if (!card || card.dataset.blockId === draggedBlockId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    blockList.querySelectorAll(".drop-before, .drop-after").forEach((item) => item.classList.remove("drop-before", "drop-after"));
    const after = event.clientY > card.getBoundingClientRect().top + card.getBoundingClientRect().height / 2;
    card.classList.add(after ? "drop-after" : "drop-before");
  });
  blockList.addEventListener("drop", (event) => {
    const targetCard = event.target.closest("[data-block-id]");
    if (!draggedBlockId || !targetCard || targetCard.dataset.blockId === draggedBlockId) return;
    event.preventDefault();
    const after = targetCard.classList.contains("drop-after");
    const pages = getEditorPages();
    const page = pages[editorPageIndex];
    const from = page.findIndex((block) => block.id === draggedBlockId);
    let to = page.findIndex((block) => block.id === targetCard.dataset.blockId);
    if (from < 0 || to < 0) return;
    const [moved] = page.splice(from, 1);
    if (from < to) to -= 1;
    if (after) to += 1;
    page.splice(Math.max(0, Math.min(to, page.length)), 0, moved);
    applyEditorPages(pages);
    draggedBlockId = "";
    clearDropMarkers();
    renderBlocks();
  });
  blockList.addEventListener("dragend", () => {
    draggedBlockId = "";
    clearDropMarkers();
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
    const deleteImage = event.target.closest("[data-delete-library-image]");
    if (edit) openEditor(edit.dataset.editCourse);
    if (present) window.open(`presentation.html?course=${encodeURIComponent(present.dataset.presentCourse)}&mode=teacher`, "_blank");
    if (deleteImage) {
      try { await deleteLibraryImage(deleteImage.dataset.deleteLibraryImage); }
      catch (error) { toast(readableError(error)); }
    }
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
