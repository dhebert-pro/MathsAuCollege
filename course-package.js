(function () {
  "use strict";

  const FORMAT = "maths-au-college/course-package";
  const VERSION = 1;
  const MAX_PACKAGE_BYTES = 8 * 1024 * 1024;
  const MAX_IMAGE_DATA_LENGTH = 650000;
  const MAX_PDF_DATA_LENGTH = 870000;

  function invalid(message) {
    const error = new Error(message);
    error.code = "invalid-course-package";
    throw error;
  }

  function cleanText(value, maximum, field) {
    const text = String(value || "").trim();
    if (!text || text.length > maximum) invalid(`${field} est absent ou trop long.`);
    return text;
  }

  function validateDataUrl(value, prefix, maximum, field) {
    const dataUrl = String(value || "");
    if (!dataUrl.toLowerCase().startsWith(prefix) || dataUrl.length > maximum) invalid(`${field} n’est pas un fichier valide ou dépasse la taille autorisée.`);
    let binary;
    try {
      const encoded = dataUrl.slice(dataUrl.indexOf(",") + 1);
      if (!encoded || !/^[a-z0-9+/]+={0,2}$/i.test(encoded)) invalid(`${field} n’est pas correctement encodé.`);
      binary = atob(encoded);
    } catch {
      invalid(`${field} n’est pas correctement encodé.`);
    }
    if (prefix === "data:application/pdf;base64," && !binary.startsWith("%PDF-")) invalid(`${field} ne contient pas un véritable PDF.`);
    return dataUrl;
  }

  function validateImage(image, blockNumber, imageNumber) {
    const dataUrl = String(image?.dataUrl || "");
    const type = dataUrl.match(/^data:image\/(png|jpeg|webp);base64,/i)?.[1]?.toLowerCase();
    if (!type || dataUrl.length > MAX_IMAGE_DATA_LENGTH) {
      invalid(`L’image ${imageNumber} du bloc ${blockNumber} est invalide ou trop lourde.`);
    }
    let binary;
    try {
      const encoded = dataUrl.slice(dataUrl.indexOf(",") + 1);
      if (!encoded || !/^[a-z0-9+/]+={0,2}$/i.test(encoded)) invalid(`L’image ${imageNumber} du bloc ${blockNumber} n’est pas correctement encodée.`);
      binary = atob(encoded);
    } catch {
      invalid(`L’image ${imageNumber} du bloc ${blockNumber} n’est pas correctement encodée.`);
    }
    const validSignature = type === "png"
      ? binary.startsWith("\x89PNG\r\n\x1a\n")
      : type === "jpeg"
        ? binary.startsWith("\xff\xd8\xff")
        : binary.startsWith("RIFF") && binary.slice(8, 12) === "WEBP";
    if (!validSignature) invalid(`L’image ${imageNumber} du bloc ${blockNumber} ne correspond pas au format annoncé.`);
    return {
      dataUrl,
      alt: cleanText(image?.alt || `Illustration du bloc ${blockNumber}`, 160, `Le texte alternatif de l’image ${imageNumber}`),
    };
  }

  function validateLink(link, blockNumber, linkNumber) {
    const url = CourseContent.safeUrl(link?.url);
    if (!url) invalid(`Le lien ${linkNumber} du bloc ${blockNumber} doit commencer par https:// ou http://.`);
    return {
      id: CourseContent.id("link"),
      label: cleanText(link?.label || `Ressource ${linkNumber}`, 80, `Le nom du lien ${linkNumber}`),
      url,
    };
  }

  function validateBlock(block, index) {
    const blockNumber = index + 1;
    if (!CourseContent.TYPES[block?.type]) invalid(`Le type du bloc ${blockNumber} est inconnu.`);
    if (block.slideBreakBefore && block.revealBreakBefore) invalid(`Le bloc ${blockNumber} ne peut pas commencer à la fois une page et une révélation.`);
    const images = Array.isArray(block.images) ? block.images : [];
    const links = Array.isArray(block.links) ? block.links : [];
    if (images.length > 8) invalid(`Le bloc ${blockNumber} contient plus de 8 images.`);
    if (links.length > 8) invalid(`Le bloc ${blockNumber} contient plus de 8 liens.`);
    const html = CourseContent.sanitizeHtml(String(block.html || ""));
    if (!CourseContent.plainText(html) && !images.length) invalid(`Le bloc ${blockNumber} est vide.`);
    if (html.length > 30000) invalid(`Le texte du bloc ${blockNumber} est trop long.`);
    return {
      id: CourseContent.id("block"),
      type: block.type,
      html,
      admitted: block.type === "property" && Boolean(block.admitted),
      slideBreakBefore: index > 0 && Boolean(block.slideBreakBefore),
      revealBreakBefore: index > 0 && Boolean(block.revealBreakBefore),
      images: images.map((image, imageIndex) => validateImage(image, blockNumber, imageIndex + 1)),
      links: links.map((link, linkIndex) => validateLink(link, blockNumber, linkIndex + 1)),
    };
  }

  function validate(value) {
    if (!value || typeof value !== "object") invalid("Le fichier ne contient pas un paquet de cours.");
    if (value.format !== FORMAT || Number(value.version) !== VERSION) invalid("Le format du paquet n’est pas reconnu.");
    const source = value.course;
    if (!source || typeof source !== "object") invalid("La section course est absente.");
    const blocks = Array.isArray(source.blocks) ? source.blocks : [];
    if (!blocks.length || blocks.length > 200) invalid("Le cours doit contenir entre 1 et 200 blocs.");
    const exercisePdf = value.exercisePdf ? {
      name: cleanText(value.exercisePdf.name || "fiche-exercices.pdf", 160, "Le nom du PDF").replace(/\.pdf$/i, "") + ".pdf",
      dataUrl: validateDataUrl(value.exercisePdf.dataUrl, "data:application/pdf;base64,", MAX_PDF_DATA_LENGTH, "La fiche d’exercices"),
    } : null;
    const level = String(source.level || "");
    if (!CourseContent.LEVELS.includes(level)) invalid("Le niveau doit être 6, 5, 4 ou 3.");
    return {
      title: cleanText(source.title, 120, "Le nom du chapitre"),
      chapterNumber: String(source.chapterNumber || "").trim().slice(0, 20),
      level,
      blocks: blocks.map(validateBlock),
      exercisePdf,
    };
  }

  async function read(file) {
    if (!file || file.size > MAX_PACKAGE_BYTES) invalid("Le paquet dépasse la limite de 8 Mo.");
    let parsed;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      invalid("Le fichier n’est pas un JSON valide.");
    }
    return validate(parsed);
  }

  function download(value, filename) {
    validate(value);
    const json = JSON.stringify(value, null, 2);
    if (new TextEncoder().encode(json).length > MAX_PACKAGE_BYTES) invalid("Le paquet dépasse la limite de 8 Mo.");
    const url = URL.createObjectURL(new Blob([json], { type: "application/json;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = String(filename || "cours.mathscours").replace(/[^a-z0-9._-]+/gi, "-");
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  window.CoursePackage = { FORMAT, VERSION, read, validate, download };
})();
