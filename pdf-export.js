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
    function pushText(value, style) {
      value.split(/([∈∉])/).filter(Boolean).forEach((text) => {
        if (text === "∈") tokens.push({ text, math: "belongs", ...style });
        else if (text === "∉") tokens.push({ text, math: "not-belongs", ...style });
        else tokens.push({ text, ...style });
      });
    }
    function visit(node, style = {}) {
      if (node.nodeType === Node.TEXT_NODE) {
        if (node.textContent) pushText(node.textContent, style);
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const tag = node.tagName.toLowerCase();
      if (tag === "br") { tokens.push({ text: "\n", ...style }); return; }
      if (tag === "span" && node.classList.contains("math-root")) { tokens.push({ text: node.textContent, math: "root", ...style }); return; }
      if (tag === "span" && node.classList.contains("math-angle")) { tokens.push({ text: node.textContent, math: "angle", ...style }); return; }
      const nextStyle = {
        bold: style.bold || tag === "strong",
        italic: style.italic || tag === "em",
        highlight: style.highlight || (tag === "mark" ? node.dataset.tone || "yellow" : ""),
      };
      if (tag === "li") tokens.push({ text: "- ", bold: true });
      [...node.childNodes].forEach((child) => visit(child, nextStyle));
      if (["p", "li", "ul", "ol"].includes(tag)) tokens.push({ text: "\n", ...style });
    }
    [...root.childNodes].forEach((node) => visit(node));
    return tokens;
  }

  function normalizePdfText(value) {
    return String(value || "").replace(/[\u2010-\u2015\u2212]/g, "-").replace(/\u00a0/g, " ");
  }

  function tokenLines(pdf, tokens, maxWidth, fontSize) {
    const pieces = [];
    const lines = [[]];
    let width = 0;
    function applyFont(token) {
      pdf.setFont("helvetica", token.bold || token.highlight ? "bold" : token.italic ? "italic" : "normal");
      pdf.setFontSize(fontSize);
    }
    function measure(token, text) {
      applyFont(token);
      let measured = pdf.getTextWidth(text) + (token.math === "root" ? 3 : 0);
      if (["belongs", "not-belongs"].includes(token.math)) measured = Math.max(3, pdf.getTextWidth("C")) + (token.math === "not-belongs" ? .5 : 0);
      return measured;
    }
    tokens.forEach((token) => {
      const value = ["belongs", "not-belongs"].includes(token.math) ? token.text : normalizePdfText(token.text);
      const parts = token.math ? [value] : value.split(/(\s+)/).filter(Boolean);
      parts.forEach((text) => {
        if (text.includes("\n")) pieces.push({ newline: true });
        else pieces.push({ ...token, text, width: measure(token, text), space: /^\s+$/.test(text) });
      });
    });

    function mathValue(piece) {
      return piece.text?.trim().replace(/[.;:!?]+$/, "") || "";
    }
    function isRelation(piece) {
      return ["belongs", "not-belongs"].includes(piece.math) || /^(?:=|<|>|≤|≥|≠|≈)$/.test(mathValue(piece));
    }
    function isOperator(piece) {
      return /^(?:\+|-|×|÷|±|\/\/|⟂)$/.test(mathValue(piece));
    }
    function isUnit(piece) {
      return /^(?:mm|cm|dm|m|dam|hm|km|mm²|cm²|m²|mm³|cm³|m³|°)$/.test(mathValue(piece));
    }
    function isOperand(piece) {
      if (["root", "angle"].includes(piece.math)) return true;
      const value = mathValue(piece);
      if (!value || isRelation(piece) || isOperator(piece) || isUnit(piece)) return false;
      if (/^(?:[A-ZÀ-Ÿ]{1,5}|[a-z]|\d+(?:[,.]\d+)?|\[[^\]]+\]|\([^\)]+\))$/.test(value)) return true;
      return /^[A-Za-zÀ-ÿ0-9,[\]()²³]+(?:[+\-×÷][A-Za-zÀ-ÿ0-9,[\]()²³]+)+$/.test(value);
    }
    function previousContent(index) {
      let cursor = index - 1;
      while (cursor >= 0 && pieces[cursor].space) cursor -= 1;
      return cursor;
    }

    const formulaEnds = new Map();
    for (let index = 0; index < pieces.length; index += 1) {
      if (!isRelation(pieces[index])) continue;
      const start = previousContent(index);
      if (start < 0 || !isOperand(pieces[start])) continue;
      let end = index;
      let cursor = index + 1;
      let expectsOperand = true;
      let hasRightOperand = false;
      while (cursor < pieces.length && !pieces[cursor].newline) {
        if (pieces[cursor].space) { cursor += 1; continue; }
        const piece = pieces[cursor];
        if (expectsOperand && isOperand(piece)) {
          end = cursor;
          expectsOperand = false;
          hasRightOperand = true;
          cursor += 1;
          continue;
        }
        if (!expectsOperand && (isOperator(piece) || isRelation(piece))) {
          end = cursor;
          expectsOperand = true;
          cursor += 1;
          continue;
        }
        if (!expectsOperand && isUnit(piece)) end = cursor;
        break;
      }
      if (hasRightOperand) {
        formulaEnds.set(start, end);
        index = end;
      }
    }

    function lineHasContent() {
      return lines[lines.length - 1].some((piece) => !piece.space);
    }
    function nextLine() {
      if (lines[lines.length - 1].length) lines.push([]);
      width = 0;
    }
    function append(piece) {
      if (piece.space && !lineHasContent()) return;
      if (!piece.space && width + piece.width > maxWidth && lineHasContent()) nextLine();
      if (!(piece.space && !lineHasContent())) {
        lines[lines.length - 1].push(piece);
        width += piece.width;
      }
    }

    for (let index = 0; index < pieces.length; index += 1) {
      const piece = pieces[index];
      if (piece.newline) {
        if (lineHasContent()) nextLine();
        continue;
      }
      const formulaEnd = formulaEnds.get(index);
      if (formulaEnd !== undefined) {
        const formula = pieces.slice(index, formulaEnd + 1);
        const formulaWidth = formula.reduce((sum, part) => sum + part.width, 0);
        if (formulaWidth <= maxWidth) {
          if (width + formulaWidth > maxWidth && lineHasContent()) nextLine();
          formula.forEach(append);
          index = formulaEnd;
          continue;
        }
      }
      append(piece);
    }
    while (lines.length > 1 && !lines[lines.length - 1].length) lines.pop();
    return lines;
  }

  function mathTopGap(line) {
    return line.some((token) => ["root", "angle"].includes(token.math)) ? 1.8 : 0;
  }

  function richLinesHeight(lines, lineHeight) {
    return lines.reduce((height, line) => height + lineHeight + mathTopGap(line), 0);
  }

  function drawRichLines(pdf, lines, x, y, fontSize, lineHeight) {
    lines.forEach((line) => {
      y += mathTopGap(line);
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
        if (token.math === "root") {
          pdf.setDrawColor(...COLORS.ink);
          pdf.setLineWidth(.35);
          pdf.line(cursor, y - .6, cursor + .7, y + .4);
          pdf.line(cursor + .7, y + .4, cursor + 1.7, y - fontSize * .34);
          pdf.line(cursor + 1.7, y - fontSize * .34, cursor + token.width, y - fontSize * .34);
          pdf.text(token.text, cursor + 2.3, y);
        } else if (token.math === "angle") {
          pdf.text(token.text, cursor, y);
          pdf.setDrawColor(...COLORS.ink);
          pdf.setLineWidth(.3);
          pdf.line(cursor, y - fontSize * .3, cursor + token.width / 2, y - fontSize * .43);
          pdf.line(cursor + token.width / 2, y - fontSize * .43, cursor + token.width, y - fontSize * .3);
        } else if (["belongs", "not-belongs"].includes(token.math)) {
          pdf.text("C", cursor, y);
          pdf.setDrawColor(...COLORS.ink);
          pdf.setLineWidth(.3);
          pdf.line(cursor + .45, y - fontSize * .13, cursor + token.width - .2, y - fontSize * .13);
          if (token.math === "not-belongs") pdf.line(cursor + .25, y + .55, cursor + token.width - .15, y - fontSize * .42);
        } else pdf.text(token.text, cursor, y);
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
      height: (block.type === "text" ? 6 : 12) + labelHeight + Math.max(lineHeight, richLinesHeight(lines, lineHeight)) + imagesHeight,
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
