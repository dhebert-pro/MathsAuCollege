(function () {
  "use strict";

  function safeFilename(value) {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/(^-|-$)/g, "").toLowerCase();
  }

  function richTokens(html) {
    const root = document.createElement("div");
    root.innerHTML = CourseContent.sanitizeHtml(html);
    const tokens = [];
    function visit(node, style = {}) {
      if (node.nodeType === Node.TEXT_NODE) {
        if (node.textContent) tokens.push({ text: node.textContent, ...style });
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const tag = node.tagName.toLowerCase();
      if (tag === "br") { tokens.push({ text: "\n", ...style }); return; }
      const nextStyle = {
        bold: style.bold || tag === "strong",
        italic: style.italic || tag === "em",
        highlight: style.highlight || (tag === "mark" ? node.dataset.tone || "yellow" : ""),
      };
      if (tag === "li") tokens.push({ text: "• ", bold: true });
      [...node.childNodes].forEach((child) => visit(child, nextStyle));
      if (["p", "li", "ul", "ol"].includes(tag)) tokens.push({ text: "\n", ...style });
    }
    [...root.childNodes].forEach((node) => visit(node));
    return tokens;
  }

  function tokenLines(pdf, tokens, maxWidth, fontSize) {
    const lines = [[]];
    let width = 0;
    function font(token) {
      pdf.setFont("helvetica", token.bold ? "bold" : token.italic ? "italic" : "normal");
      pdf.setFontSize(fontSize);
    }
    tokens.forEach((token) => {
      const pieces = token.text.split(/(\s+|\n)/).filter(Boolean);
      pieces.forEach((piece) => {
        if (piece.includes("\n")) {
          if (lines[lines.length - 1].length) lines.push([]);
          width = 0;
          return;
        }
        font(token);
        const pieceWidth = pdf.getTextWidth(piece);
        if (width + pieceWidth > maxWidth && lines[lines.length - 1].length && !/^\s+$/.test(piece)) {
          lines.push([]);
          width = 0;
        }
        if (!(width === 0 && /^\s+$/.test(piece))) {
          lines[lines.length - 1].push({ ...token, text: piece, width: pieceWidth });
          width += pieceWidth;
        }
      });
    });
    while (lines.length > 1 && !lines[lines.length - 1].length) lines.pop();
    return lines;
  }

  function drawRichLines(pdf, lines, x, y, fontSize, lineHeight) {
    lines.forEach((line) => {
      let cursor = x;
      line.forEach((token) => {
        pdf.setFont("helvetica", token.bold ? "bold" : token.italic ? "italic" : "normal");
        pdf.setFontSize(fontSize);
        pdf.setTextColor(30, 36, 40);
        if (token.highlight) {
          const gray = { yellow: 226, blue: 232, green: 220, pink: 235 }[token.highlight] || 230;
          pdf.setFillColor(gray, gray, gray);
          pdf.roundedRect(cursor - 0.4, y - fontSize * 0.31, token.width + 0.8, fontSize * 0.42, 0.6, 0.6, "F");
        }
        pdf.text(token.text, cursor, y);
        cursor += token.width;
      });
      y += lineHeight;
    });
    return y;
  }

  function grayscaleImage(dataUrl) {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
        for (let index = 0; index < pixels.data.length; index += 4) {
          const gray = Math.round(pixels.data[index] * 0.299 + pixels.data[index + 1] * 0.587 + pixels.data[index + 2] * 0.114);
          pixels.data[index] = gray;
          pixels.data[index + 1] = gray;
          pixels.data[index + 2] = gray;
        }
        context.putImageData(pixels, 0, 0);
        resolve({ dataUrl: canvas.toDataURL("image/jpeg", 0.86), width: canvas.width, height: canvas.height });
      };
      image.onerror = () => resolve(null);
      image.src = dataUrl;
    });
  }

  async function loadImages(course) {
    const ids = [...new Set(course.blocks.flatMap((block) => block.imageIds))];
    const entries = await Promise.all(ids.map(async (id) => {
      try {
        const image = await CourseStore.getImage(id);
        return [id, image ? await grayscaleImage(image.dataUrl) : null];
      } catch {
        return [id, null];
      }
    }));
    return new Map(entries);
  }

  function blockLayout(pdf, block, fontSize, maxWidth, imageMap) {
    const type = CourseContent.TYPES[block.type];
    const labelHeight = block.type === "text" ? 0 : 7;
    const lineHeight = fontSize * 0.42;
    const lines = tokenLines(pdf, richTokens(block.html), maxWidth - 12, fontSize);
    const validImages = block.imageIds.map((id) => imageMap.get(id)).filter(Boolean);
    const imageRows = Math.ceil(validImages.length / 3);
    const imageHeight = imageRows * 39;
    return {
      type,
      lines,
      validImages,
      labelHeight,
      lineHeight,
      height: 10 + labelHeight + Math.max(lineHeight, lines.length * lineHeight) + imageHeight,
    };
  }

  function drawHeader(pdf, course, slideNumber, totalSlides, continuation = false) {
    pdf.setFillColor(35, 35, 35);
    pdf.rect(0, 0, 297, 8, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(45, 45, 45);
    pdf.text(`MATHS AU COLLÈGE · ${course.level}e`, 16, 16);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(100, 100, 100);
    pdf.text(`${CourseContent.displayTitle(course)}${continuation ? " · suite" : ""}`, 148.5, 16, { align: "center" });
    pdf.text(`${slideNumber} / ${totalSlides}`, 281, 16, { align: "right" });
  }

  function drawBlock(pdf, block, layout, x, y, width, fontSize) {
    const borderGray = { text: 120, definition: 80, property: 105, example: 95, takeaway: 55, warning: 35, method: 70, reminder: 130 }[block.type];
    const fillGray = { text: 252, definition: 246, property: 242, example: 248, takeaway: 239, warning: 234, method: 245, reminder: 249 }[block.type];
    pdf.setFillColor(fillGray, fillGray, fillGray);
    pdf.setDrawColor(185, 185, 185);
    pdf.roundedRect(x, y, width, layout.height, 2.5, 2.5, "FD");
    pdf.setFillColor(borderGray, borderGray, borderGray);
    pdf.rect(x, y, 3, layout.height, "F");
    let cursorY = y + 7;
    if (block.type !== "text") {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(45, 45, 45);
      pdf.text(`${layout.type.label.toUpperCase()}${block.admitted ? " · ADMISE" : ""}`, x + 7, cursorY);
      cursorY += layout.labelHeight;
    }
    cursorY = drawRichLines(pdf, layout.lines, x + 7, cursorY, fontSize, layout.lineHeight);
    if (layout.validImages.length) {
      cursorY += 3;
      layout.validImages.forEach((image, index) => {
        const column = index % 3;
        const row = Math.floor(index / 3);
        const cellWidth = (width - 18) / 3;
        const cellHeight = 35;
        const ratio = Math.min(cellWidth / image.width, cellHeight / image.height);
        const imageWidth = image.width * ratio;
        const imageHeight = image.height * ratio;
        const imageX = x + 7 + column * (cellWidth + 2) + (cellWidth - imageWidth) / 2;
        const imageY = cursorY + row * 39 + (cellHeight - imageHeight) / 2;
        pdf.addImage(image.dataUrl, "JPEG", imageX, imageY, imageWidth, imageHeight, undefined, "FAST");
      });
    }
  }

  async function createDocument(course) {
    if (!window.jspdf?.jsPDF) throw new Error("Le module PDF n’est pas disponible.");
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape", compress: true });
    const normalized = CourseContent.normalizeCourse(course);
    const slides = CourseContent.groupSlides(normalized.blocks);
    const imageMap = await loadImages(normalized);
    const totalSlides = slides.length + 1;
    pdf.setProperties({ title: CourseContent.displayTitle(normalized), subject: "Cours de mathématiques", author: "Maths au collège" });

    pdf.setFillColor(247, 247, 244);
    pdf.rect(0, 0, 297, 210, "F");
    pdf.setFillColor(35, 35, 35);
    pdf.rect(0, 0, 297, 13, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(75, 75, 75);
    pdf.setFontSize(12);
    pdf.text(normalized.chapterNumber ? `CHAPITRE ${normalized.chapterNumber}` : `MATHÉMATIQUES · ${normalized.level}e`, 148.5, 67, { align: "center" });
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(25, 25, 25);
    pdf.setFontSize(30);
    const title = pdf.splitTextToSize(normalized.title, 235);
    pdf.text(title, 148.5, 88, { align: "center" });
    pdf.setDrawColor(80, 80, 80);
    pdf.setLineWidth(1.2);
    pdf.line(112, 132, 185, 132);
    pdf.setFontSize(10);
    pdf.setTextColor(100, 100, 100);
    pdf.text("MATHS AU COLLÈGE", 148.5, 143, { align: "center" });

    slides.forEach((slide, slideIndex) => {
      pdf.addPage("a4", "landscape");
      drawHeader(pdf, normalized, slideIndex + 2, totalSlides);
      const availableHeight = 174;
      const width = 265;
      let fontSize = 11;
      let layouts = slide.map((block) => blockLayout(pdf, block, fontSize, width, imageMap));
      let required = layouts.reduce((sum, layout) => sum + layout.height, 0) + Math.max(0, layouts.length - 1) * 4;
      if (required > availableHeight) {
        fontSize = Math.max(7.5, 11 * (availableHeight / required));
        layouts = slide.map((block) => blockLayout(pdf, block, fontSize, width, imageMap));
      }
      let y = 23;
      slide.forEach((block, index) => {
        const layout = layouts[index];
        if (y + layout.height > 202 && y > 30) {
          pdf.addPage("a4", "landscape");
          drawHeader(pdf, normalized, slideIndex + 2, totalSlides, true);
          y = 23;
        }
        drawBlock(pdf, block, layout, 16, y, width, fontSize);
        y += layout.height + 4;
      });
    });
    return pdf;
  }

  window.CoursePdf = {
    filename(course) {
      return `${safeFilename(CourseContent.displayTitle(course)) || "cours"}.pdf`;
    },
    async createDownload(course) {
      const pdf = await createDocument(course);
      return { filename: this.filename(course), url: URL.createObjectURL(pdf.output("blob")) };
    },
    async download(course) {
      const pdf = await createDocument(course);
      pdf.save(this.filename(course));
    },
  };
})();
