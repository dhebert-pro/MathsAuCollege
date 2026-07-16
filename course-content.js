(function () {
  "use strict";

  const TYPES = {
    text: { label: "Texte", icon: "\u00b6" },
    definition: { label: "D\u00e9finition", icon: "D" },
    property: { label: "Propri\u00e9t\u00e9", icon: "P" },
    example: { label: "Exemple", icon: "Ex" },
    takeaway: { label: "\u00c0 retenir", icon: "\u2605" },
    warning: { label: "Attention", icon: "!" },
    method: { label: "M\u00e9thode", icon: "M" },
    reminder: { label: "Rappel", icon: "\u21ba" },
  };
  const TONES = ["yellow"];
  const LEVELS = ["6", "5", "4", "3"];
  const collator = new Intl.Collator("fr", { numeric: true, sensitivity: "base" });

  function id(prefix = "item") {
    return globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
  }

  function sanitizeHtml(value) {
    const template = document.createElement("template");
    template.innerHTML = String(value || "");

    function clean(node) {
      if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent);
      if (node.nodeType !== Node.ELEMENT_NODE) return "";
      const tag = node.tagName.toLowerCase();
      const children = [...node.childNodes].map(clean).join("");
      if (tag === "br") return "<br>";
      if (["strong", "b"].includes(tag)) return `<strong>${children}</strong>`;
      if (["em", "i"].includes(tag)) return `<em>${children}</em>`;
      if (["p", "ul", "ol", "li"].includes(tag)) return `<${tag}>${children}</${tag}>`;
      if (tag === "mark") {
        return `<mark data-tone="yellow">${children}</mark>`;
      }
      if (tag === "span" && node.style?.backgroundColor) {
        return `<mark data-tone="yellow">${children}</mark>`;
      }
      if (tag === "div") return `<p>${children}</p>`;
      return children;
    }

    return [...template.content.childNodes].map(clean).join("").trim();
  }

  function plainText(html) {
    const element = document.createElement("div");
    element.innerHTML = sanitizeHtml(html);
    return (element.innerText || element.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
  }

  function safeUrl(value) {
    try {
      const url = new URL(String(value || "").trim());
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  }

  function normalizeBlock(block = {}) {
    const type = TYPES[block.type] ? block.type : "text";
    return {
      id: String(block.id || id("block")),
      type,
      html: sanitizeHtml(block.html || block.content || ""),
      admitted: type === "property" && Boolean(block.admitted),
      slideBreakBefore: Boolean(block.slideBreakBefore),
      revealBreakBefore: Boolean(block.revealBreakBefore),
      imageIds: Array.isArray(block.imageIds) ? [...new Set(block.imageIds.map(String))].slice(0, 8) : [],
      teacherLabel: String(block.teacherLabel || "").trim().slice(0, 80),
      teacherUrl: safeUrl(block.teacherUrl),
    };
  }

  function groupSlides(blocks = []) {
    const slides = [];
    blocks.map(normalizeBlock).forEach((block) => {
      if (!slides.length || (block.slideBreakBefore && slides[slides.length - 1].length)) slides.push([]);
      slides[slides.length - 1].push(block);
    });
    return slides.length ? slides : [[]];
  }

  function normalizeCourse(course = {}) {
    const now = new Date().toISOString();
    let blocks = Array.isArray(course.blocks) ? course.blocks.map(normalizeBlock) : [];
    if (!blocks.length && course.content) blocks = [normalizeBlock({ type: "text", html: `<p>${escapeHtml(course.content).replace(/\n/g, "<br>")}</p>` })];
    const manualOrder = Number.isInteger(course.manualOrder) && course.manualOrder >= 0 ? course.manualOrder : null;
    const title = String(course.title || "").trim().slice(0, 120);
    return {
      id: String(course.id || id("course")),
      title,
      slug: String(course.slug || title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")),
      chapterNumber: String(course.chapterNumber || "").trim().slice(0, 20),
      level: LEVELS.includes(String(course.level)) ? String(course.level) : "6",
      blocks,
      slideCount: blocks.length ? groupSlides(blocks).length : Math.max(1, Number(course.slideCount) || 1),
      status: course.status === "published" ? "published" : "draft",
      manualOrder,
      createdAt: String(course.createdAt || now),
      updatedAt: String(course.updatedAt || now),
    };
  }

  function displayTitle(course) {
    return course.chapterNumber ? `${course.chapterNumber} \u2014 ${course.title}` : course.title;
  }

  function automaticCompare(a, b) {
    const aNumbered = Boolean(a.chapterNumber);
    const bNumbered = Boolean(b.chapterNumber);
    if (aNumbered !== bNumbered) return aNumbered ? -1 : 1;
    if (aNumbered) {
      const byNumber = collator.compare(a.chapterNumber, b.chapterNumber);
      if (byNumber) return byNumber;
    }
    return collator.compare(a.title, b.title);
  }

  function sortCourses(items) {
    return [...items].sort((a, b) => {
      if (a.level !== b.level) return LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level);
      const aManual = Number.isInteger(a.manualOrder);
      const bManual = Number.isInteger(b.manualOrder);
      if (aManual && bManual && a.manualOrder !== b.manualOrder) return a.manualOrder - b.manualOrder;
      if (aManual !== bManual) return aManual ? -1 : 1;
      return automaticCompare(a, b);
    });
  }

  function publicCourse(course) {
    return normalizeCourse(course);
  }

  function catalogCourse(course) {
    const normalized = publicCourse(course);
    const { blocks, ...metadata } = normalized;
    return metadata;
  }

  window.CourseContent = {
    TYPES,
    TONES,
    LEVELS,
    id,
    escapeHtml,
    sanitizeHtml,
    plainText,
    safeUrl,
    normalizeBlock,
    normalizeCourse,
    groupSlides,
    displayTitle,
    sortCourses,
    publicCourse,
    catalogCourse,
  };
})();
