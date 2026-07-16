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
      pdf.setFont("helvetica", token.bold || token.highlight ? "bold" : token.italic ? "italic" : "normal");
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
    lines.forEach((line) => {
      let cursor = x;
      line.forEach((token) => {
        pdf.setFont("helvetica", token.bold || token.highlight ? "bold" : token.italic ? "italic" : "normal");
        pdf.setFontSize(fontSize);
        pdf.setTextColor(...(token.highlight ? [138, 60, 32] : COLORS.ink));
        if (token.highlight) {
          pdf.setDrawColor(205, 132, 34);
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
    const labelHeight = block.type === "text" ? 0 : 9.5;
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
      height: (block.type === "text" ? 6 : 12) + labelHeight + Math.max(lineHeight, lines.length * lineHeight) + imagesHeight,
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
    const plainTextBlock = block.type === "text";
    if (!plainTextBlock) {
      pdf.setDrawColor(...palette.border);
      pdf.setLineWidth(.45);
      if (block.admitted || ["warning", "reminder"].includes(block.type)) pdf.setLineDashPattern([2, 1.5], 0);
      if (block.type === "example") {
        pdf.setLineWidth(1.2);
        pdf.line(x + 2.5, y + 2, x + 2.5, y + layout.height - 2);
      } else {
        pdf.roundedRect(x, y, width, layout.height, block.type === "takeaway" ? 1 : 3, block.type === "takeaway" ? 1 : 3, "S");
      }
      pdf.setLineDashPattern([], 0);
      if (block.type === "property") {
        pdf.setLineWidth(1.8);
        pdf.line(x, y + 1.2, x + width, y + 1.2);
      } else if (block.type === "takeaway") {
        pdf.setLineWidth(.35);
        pdf.rect(x + 1.5, y + 1.5, width - 3, layout.height - 3, "S");
      } else if (block.type !== "example" && block.type !== "reminder") {
        pdf.setLineWidth(1.5);
        pdf.line(x + 2.5, y + 3, x + 2.5, y + layout.height - 3);
      }
    }
    const contentX = plainTextBlock ? x + 1 : x + 9;
    let cursorY = y + (plainTextBlock ? 4 : 8);
    if (block.type !== "text") {
      const type = CourseContent.TYPES[block.type];
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(...palette.border);
      pdf.text(`${type.label.toUpperCase()}${block.admitted ? " · ADMISE" : ""}`, x + 9, cursorY);
      const titleWidth = Math.min(62, pdf.getTextWidth(type.label.toUpperCase()) + 2);
      pdf.setLineWidth(.8);
      pdf.line(x + 9, cursorY + 2.1, x + 9 + titleWidth, cursorY + 2.1);
      cursorY += layout.labelHeight;
    }
    cursorY = drawRichLines(pdf, layout.lines, contentX, cursorY, fontSize, layout.lineHeight);
    if (layout.validImages.length) drawImageGrid(pdf, layout.validImages, plainTextBlock ? x + 1 : x + 9, cursorY + 2, plainTextBlock ? width - 2 : width - 18);
  }

  function drawDocumentHeader(pdf, course) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(...COLORS.green);
    pdf.text(course.chapterNumber ? `CHAPITRE ${course.chapterNumber}` : `${course.level}e`, 15, 17);
    pdf.setDrawColor(...COLORS.line);
    pdf.setLineWidth(.4);
    pdf.roundedRect(176, 9, 19, 11, 2.5, 2.5, "S");
    pdf.setTextColor(...COLORS.blue);
    pdf.text(`${course.level}e`, 185.5, 16, { align: "center" });
    pdf.setFontSize(22);
    pdf.setTextColor(...COLORS.ink);
    const title = pdf.splitTextToSize(course.title, 154);
    pdf.text(title, 15, 30);
    const bottom = 30 + Math.max(0, title.length - 1) * 9;
    pdf.setDrawColor(...COLORS.orange);
    pdf.setLineWidth(1.2);
    pdf.line(15, bottom + 6, 58, bottom + 6);
    return bottom + 13;
  }

  function addFooters(pdf) {
    const total = pdf.getNumberOfPages();
    for (let page = 1; page <= total; page += 1) {
      pdf.setPage(page);
      pdf.setDrawColor(...COLORS.line);
      pdf.setLineWidth(.3);
      pdf.line(15, 286, 195, 286);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);
      pdf.setTextColor(...COLORS.muted);
      pdf.text(`${page} / ${total}`, 195, 291, { align: "right" });
    }
  }

  async function createDocument(course) {
    if (!window.jspdf?.jsPDF) throw new Error("Le module PDF n’est pas disponible.");
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
    const normalized = CourseContent.normalizeCourse(course);
    const imageMap = await loadImages(normalized);
    pdf.setProperties({ title: CourseContent.displayTitle(normalized), subject: "Mathématiques" });

    const width = 180;
    const pageTop = 13;
    const pageBottom = 281;
    const baseFontSize = 10.5;
    let y = drawDocumentHeader(pdf, normalized);

    normalized.blocks.forEach((block) => {
      let fontSize = baseFontSize;
      let layout = blockLayout(pdf, block, fontSize, width, imageMap);
      const maximumBlockHeight = pageBottom - pageTop;
      if (layout.height > maximumBlockHeight) {
        fontSize = Math.max(8.5, fontSize * (maximumBlockHeight / layout.height));
        layout = blockLayout(pdf, block, fontSize, width, imageMap);
      }
      if (y + layout.height > pageBottom) {
        pdf.addPage("a4", "portrait");
        y = pageTop;
      }
      drawBlock(pdf, block, layout, 15, y, width, fontSize);
      y += layout.height + 3.2;
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
