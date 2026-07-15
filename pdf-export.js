(function () {
  "use strict";

  const COLORS = {
    ink: [16, 47, 67],
    blue: [23, 63, 95],
    green: [71, 125, 115],
    orange: [239, 167, 70],
    muted: [96, 114, 125],
    line: [211, 222, 225],
  };
  const BLOCK_COLORS = {
    text: { border: [112, 133, 143], fill: [250, 251, 250] },
    definition: { border: [52, 122, 152], fill: [240, 248, 251] },
    property: { border: [112, 83, 160], fill: [247, 243, 251] },
    example: { border: [63, 131, 106], fill: [241, 248, 244] },
    takeaway: { border: [202, 139, 32], fill: [255, 248, 229] },
    warning: { border: [186, 82, 58], fill: [255, 241, 236] },
    method: { border: [40, 106, 162], fill: [239, 247, 252] },
    reminder: { border: [101, 114, 122], fill: [245, 247, 248] },
  };

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
    function applyFont(token) {
      pdf.setFont("helvetica", token.bold ? "bold" : token.italic ? "italic" : "normal");
      pdf.setFontSize(fontSize);
    }
    tokens.forEach((token) => {
      token.text.split(/(\s+|\n)/).filter(Boolean).forEach((piece) => {
        if (piece.includes("\n")) {
          if (lines[lines.length - 1].length) lines.push([]);
          width = 0;
          return;
        }
        applyFont(token);
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
    const highlightColors = { yellow: [255, 229, 165], blue: [220, 236, 242], green: [217, 238, 229], pink: [247, 222, 218] };
    const highlightLines = { yellow: [196, 139, 38], blue: [65, 128, 151], green: [68, 128, 104], pink: [178, 104, 92] };
    lines.forEach((line) => {
      let cursor = x;
      line.forEach((token) => {
        pdf.setFont("helvetica", token.bold ? "bold" : token.italic ? "italic" : "normal");
        pdf.setFontSize(fontSize);
        pdf.setTextColor(...COLORS.ink);
        if (token.highlight) {
          const fill = highlightColors[token.highlight] || highlightColors.yellow;
          const stroke = highlightLines[token.highlight] || highlightLines.yellow;
          pdf.setFillColor(...fill);
          pdf.roundedRect(cursor - .4, y - fontSize * .31, token.width + .8, fontSize * .43, .6, .6, "F");
          pdf.setDrawColor(...stroke);
          pdf.setLineWidth(.35);
          pdf.line(cursor, y + .7, cursor + token.width, y + .7);
        }
        pdf.text(token.text, cursor, y);
        cursor += token.width;
      });
      y += lineHeight;
    });
    return y;
  }

  function inspectImage(dataUrl) {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve({ dataUrl, width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => resolve(null);
      image.src = dataUrl;
    });
  }

  async function loadImages(course) {
    const ids = [...new Set(course.blocks.flatMap((block) => block.imageIds))];
    const entries = await Promise.all(ids.map(async (id) => {
      try {
        const image = await CourseStore.getImage(id);
        return [id, image ? await inspectImage(image.dataUrl) : null];
      } catch {
        return [id, null];
      }
    }));
    return new Map(entries);
  }

  function blockLayout(pdf, block, fontSize, width, imageMap) {
    const labelHeight = block.type === "text" ? 0 : 8;
    const lineHeight = fontSize * .43;
    const lines = tokenLines(pdf, richTokens(block.html), width - 16, fontSize);
    const validImages = block.imageIds.map((id) => imageMap.get(id)).filter(Boolean);
    const imageRows = Math.ceil(validImages.length / 2);
    const imagesHeight = imageRows ? imageRows * 53 + 3 : 0;
    return {
      lines,
      validImages,
      labelHeight,
      lineHeight,
      height: 12 + labelHeight + Math.max(lineHeight, lines.length * lineHeight) + imagesHeight,
    };
  }

  function drawImageGrid(pdf, images, x, y, width) {
    if (!images.length) return;
    const gap = 5;
    const cellWidth = (width - gap) / 2;
    const cellHeight = 48;
    images.forEach((image, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const ratio = Math.min(cellWidth / image.width, cellHeight / image.height);
      const imageWidth = image.width * ratio;
      const imageHeight = image.height * ratio;
      const imageX = x + column * (cellWidth + gap) + (cellWidth - imageWidth) / 2;
      const imageY = y + row * 53 + (cellHeight - imageHeight) / 2;
      pdf.setFillColor(255, 255, 255);
      pdf.setDrawColor(...COLORS.line);
      pdf.roundedRect(x + column * (cellWidth + gap), y + row * 53, cellWidth, cellHeight, 2, 2, "FD");
      pdf.addImage(image.dataUrl, "JPEG", imageX, imageY, imageWidth, imageHeight, undefined, "FAST");
    });
  }

  function drawBlock(pdf, block, layout, x, y, width, fontSize) {
    const palette = BLOCK_COLORS[block.type];
    pdf.setFillColor(...palette.fill);
    pdf.setDrawColor(...COLORS.line);
    pdf.setLineWidth(.35);
    if (block.admitted) pdf.setLineDashPattern([2, 1.5], 0);
    pdf.roundedRect(x, y, width, layout.height, 3, 3, "FD");
    pdf.setLineDashPattern([], 0);
    pdf.setFillColor(...palette.border);
    pdf.roundedRect(x, y, 4, layout.height, 3, 0, "F");
    let cursorY = y + 8;
    if (block.type !== "text") {
      const type = CourseContent.TYPES[block.type];
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9.5);
      pdf.setTextColor(...palette.border);
      pdf.text(`${type.label.toUpperCase()}${block.admitted ? " · ADMISE" : ""}`, x + 9, cursorY);
      cursorY += layout.labelHeight;
    }
    cursorY = drawRichLines(pdf, layout.lines, x + 9, cursorY, fontSize, layout.lineHeight);
    if (layout.validImages.length) drawImageGrid(pdf, layout.validImages, x + 9, cursorY + 2, width - 18);
  }

  function drawPageHeader(pdf, course, slideNumber, continuation = false) {
    pdf.setFillColor(...COLORS.blue);
    pdf.rect(0, 0, 210, 18, "F");
    pdf.setFillColor(...COLORS.orange);
    pdf.rect(0, 0, 7, 18, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(255, 255, 255);
    pdf.text(`MATHS AU COLLÈGE · ${course.level}e`, 15, 8);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(210, 226, 234);
    pdf.text(`DIAPO ${slideNumber}${continuation ? " · SUITE" : ""}`, 195, 8, { align: "right" });
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.setTextColor(...COLORS.ink);
    const title = pdf.splitTextToSize(CourseContent.displayTitle(course), 178);
    pdf.text(title, 15, 29);
    pdf.setDrawColor(...COLORS.line);
    pdf.line(15, 35, 195, 35);
  }

  function drawCover(pdf, course) {
    pdf.setFillColor(...COLORS.blue);
    pdf.rect(0, 0, 210, 297, "F");
    pdf.setFillColor(...COLORS.orange);
    pdf.rect(0, 0, 9, 297, "F");
    pdf.setFillColor(31, 84, 113);
    pdf.circle(190, 260, 66, "F");
    pdf.setDrawColor(87, 134, 155);
    pdf.setLineWidth(1);
    pdf.circle(190, 260, 80, "S");
    pdf.circle(190, 260, 94, "S");
    pdf.setFillColor(255, 255, 255);
    pdf.roundedRect(22, 30, 18, 18, 4, 4, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(15);
    pdf.setTextColor(...COLORS.blue);
    pdf.text("M", 31, 42, { align: "center" });
    pdf.setFontSize(11);
    pdf.setTextColor(255, 211, 149);
    pdf.text(course.chapterNumber ? `CHAPITRE ${course.chapterNumber}` : `MATHÉMATIQUES · ${course.level}e`, 22, 78);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(31);
    pdf.setTextColor(255, 255, 255);
    const title = pdf.splitTextToSize(course.title, 160);
    pdf.text(title, 22, 101);
    const titleBottom = 101 + title.length * 13;
    pdf.setFillColor(...COLORS.orange);
    pdf.roundedRect(22, titleBottom + 9, 56, 3, 1.5, 1.5, "F");
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    pdf.setTextColor(201, 222, 232);
    pdf.text(`Cours de mathématiques · Classe de ${course.level}e`, 22, titleBottom + 27);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(255, 255, 255);
    pdf.text("MATHS AU COLLÈGE", 22, 276);
  }

  function addFooters(pdf) {
    const total = pdf.getNumberOfPages();
    for (let page = 2; page <= total; page += 1) {
      pdf.setPage(page);
      pdf.setDrawColor(...COLORS.line);
      pdf.line(15, 282, 195, 282);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(...COLORS.muted);
      pdf.text("Maths au collège · Document élève", 15, 288);
      pdf.text(`${page} / ${total}`, 195, 288, { align: "right" });
    }
  }

  async function createDocument(course) {
    if (!window.jspdf?.jsPDF) throw new Error("Le module PDF n’est pas disponible.");
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
    const normalized = CourseContent.normalizeCourse(course);
    const slides = CourseContent.groupSlides(normalized.blocks);
    const imageMap = await loadImages(normalized);
    pdf.setProperties({ title: CourseContent.displayTitle(normalized), subject: "Cours de mathématiques", author: "Maths au collège" });
    drawCover(pdf, normalized);

    slides.forEach((slide, slideIndex) => {
      pdf.addPage("a4", "portrait");
      drawPageHeader(pdf, normalized, slideIndex + 1);
      const width = 180;
      const availableHeight = 238;
      let fontSize = 11.5;
      let layouts = slide.map((block) => blockLayout(pdf, block, fontSize, width, imageMap));
      let required = layouts.reduce((sum, layout) => sum + layout.height, 0) + Math.max(0, layouts.length - 1) * 5;
      if (required > availableHeight) {
        fontSize = Math.max(9, fontSize * (availableHeight / required));
        layouts = slide.map((block) => blockLayout(pdf, block, fontSize, width, imageMap));
      }
      let y = 42;
      slide.forEach((block, index) => {
        const layout = layouts[index];
        if (y + layout.height > 278 && y > 48) {
          pdf.addPage("a4", "portrait");
          drawPageHeader(pdf, normalized, slideIndex + 1, true);
          y = 42;
        }
        drawBlock(pdf, block, layout, 15, y, width, fontSize);
        y += layout.height + 5;
      });
    });
    addFooters(pdf);
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
      const url = URL.createObjectURL(pdf.output("blob"));
      const link = document.createElement("a");
      link.href = url;
      link.download = this.filename(course);
      document.body.append(link);
      window.setTimeout(() => {
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      }, 0);
    },
  };
})();
