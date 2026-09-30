(function () {
  "use strict";

  const FAMILY = "DejaVuSans";
  const fonts = [
    { file: "DejaVuSans.ttf", style: "normal" },
    { file: "DejaVuSans-Bold.ttf", style: "bold" },
  ];
  const cache = new Map();

  function bufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    const chunks = [];
    for (let index = 0; index < bytes.length; index += 32768) chunks.push(String.fromCharCode(...bytes.subarray(index, index + 32768)));
    return btoa(chunks.join(""));
  }

  async function fontData(font) {
    if (!cache.has(font.file)) cache.set(font.file, fetch(`assets/fonts/${font.file}`).then(async (response) => {
      if (!response.ok) throw new Error("Police PDF indisponible");
      return { ...font, data: bufferToBase64(await response.arrayBuffer()) };
    }));
    return cache.get(font.file);
  }

  async function registerFonts(pdf) {
    for (const font of await Promise.all(fonts.map(fontData))) {
      pdf.addFileToVFS(font.file, font.data);
      pdf.addFont(font.file, FAMILY, font.style);
    }
    pdf.setFont(FAMILY, "normal");
  }

  function safeFilename(value) {
    return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9-_]+/gi, "-").replace(/(^-|-$)/g, "").toLowerCase();
  }

  function cleanText(value) {
    return String(value || "").replace(/\r/g, "").replace(/\t/g, "  ").trim();
  }

  function estimateExercise(exercise) {
    const contentLength = cleanText(exercise.content).replace(/\[\[frac:([^|\]]+)\|([^\]]+)\]\]/g, "$1 $2").length;
    const textHeight = Math.max(5, Math.ceil(contentLength / 90) * 5);
    const repeatedHeight = (exercise.repeatedItems || []).reduce((sum, item) => sum + Math.max(5, Math.ceil(cleanText(item.content).length / 78) * 5), 0);
    const figureHeight = (exercise.figures || []).reduce((sum, figure) => sum + Math.min(43, (figure.height / figure.width) * 105) + 5, 0);
    return 14 + textHeight + repeatedHeight + figureHeight + exercise.answerLines * 5.2;
  }

  function fitToSinglePage(source) {
    const exercises = [...source];
    while (exercises.length > 1 && exercises.reduce((sum, exercise) => sum + estimateExercise(exercise), 0) > 216) {
      const removable = exercises.map((exercise, index) => ({ exercise, index, height: estimateExercise(exercise) }))
        .sort((a, b) => a.exercise.importance - b.exercise.importance || b.height - a.height || a.exercise.id.localeCompare(b.exercise.id))[0];
      exercises.splice(removable.index, 1);
    }
    return exercises;
  }

  function tokenizeMath(value) {
    const source = cleanText(value);
    const tokens = [];
    const pattern = /\[\[frac:([^|\]]+)\|([^\]]+)\]\]|\n/g;
    let index = 0;
    for (const match of source.matchAll(pattern)) {
      String(source.slice(index, match.index)).split(/(\s+)/).filter(Boolean).forEach((text) => tokens.push({ type: "text", text }));
      if (match[0] === "\n") tokens.push({ type: "newline" });
      else tokens.push({ type: "fraction", numerator: match[1].trim(), denominator: match[2].trim() });
      index = match.index + match[0].length;
    }
    String(source.slice(index)).split(/(\s+)/).filter(Boolean).forEach((text) => tokens.push({ type: "text", text }));
    return tokens;
  }

  function mathLines(pdf, value, maximumWidth, fontSize) {
    pdf.setFont(FAMILY, "normal");
    pdf.setFontSize(fontSize);
    const lines = [];
    let line = [];
    let width = 0;
    let fraction = false;
    function finish() {
      if (line.length) lines.push({ tokens: line, height: fraction ? 8 : 5 });
      line = [];
      width = 0;
      fraction = false;
    }
    tokenizeMath(value).forEach((token) => {
      if (token.type === "newline") { finish(); return; }
      const tokenWidth = token.type === "fraction"
        ? Math.max(pdf.getTextWidth(token.numerator), pdf.getTextWidth(token.denominator)) + 2
        : pdf.getTextWidth(token.text);
      if (width + tokenWidth > maximumWidth && line.length) finish();
      if (!line.length && token.type === "text" && /^\s+$/.test(token.text)) return;
      line.push({ ...token, width: tokenWidth });
      width += tokenWidth;
      if (token.type === "fraction") fraction = true;
    });
    finish();
    return lines.length ? lines : [{ tokens: [{ type: "text", text: "", width: 0 }], height: 5 }];
  }

  function drawMathLines(pdf, lines, x, y, fontSize) {
    pdf.setFont(FAMILY, "normal");
    pdf.setFontSize(fontSize);
    lines.forEach((line) => {
      let cursor = x;
      line.tokens.forEach((token) => {
        if (token.type === "fraction") {
          const center = cursor + token.width / 2;
          pdf.setFontSize(Math.max(6.8, fontSize - 1));
          pdf.text(token.numerator, center, y + 2.2, { align: "center" });
          pdf.setLineWidth(.25);
          pdf.line(cursor, y + 3.2, cursor + token.width, y + 3.2);
          pdf.text(token.denominator, center, y + 6.6, { align: "center" });
          pdf.setFontSize(fontSize);
        } else {
          pdf.text(token.text, cursor, y + (line.height === 8 ? 5 : 3.8));
        }
        cursor += token.width;
      });
      y += line.height;
    });
    return y;
  }

  function drawFigure(pdf, figure, x, y, maximumWidth) {
    const scale = Math.min(maximumWidth / figure.width, 42 / figure.height);
    const width = figure.width * scale;
    const height = figure.height * scale;
    const left = x + (maximumWidth - width) / 2;
    pdf.setDrawColor(35, 67, 84);
    pdf.setTextColor(35, 67, 84);
    pdf.setLineWidth(.45);
    function label(element, labelX, labelY) {
      if (!element.label) return;
      pdf.setFont(FAMILY, "bold");
      pdf.setFontSize(7.5);
      pdf.text(element.label, left + labelX * scale, y + labelY * scale);
      pdf.setFont(FAMILY, "normal");
    }
    figure.elements.forEach((element) => {
      pdf.setLineDashPattern(element.dashed ? [2, 1.5] : [], 0);
      if (element.type === "point") {
        const px = left + element.x * scale;
        const py = y + element.y * scale;
        pdf.line(px - 1.7, py, px + 1.7, py);
        pdf.line(px, py - 1.7, px, py + 1.7);
        label(element, element.x + 10, element.y - 9);
      } else if (element.type === "segment") {
        pdf.line(left + element.x1 * scale, y + element.y1 * scale, left + element.x2 * scale, y + element.y2 * scale);
        label(element, (element.x1 + element.x2) / 2 + 7, (element.y1 + element.y2) / 2 - 8);
      } else if (element.type === "circle") {
        pdf.circle(left + element.cx * scale, y + element.cy * scale, element.r * scale);
        label(element, element.cx + element.r + 8, element.cy);
      } else if (element.type === "polygon") {
        element.points.forEach((point, index) => {
          const next = element.points[(index + 1) % element.points.length];
          pdf.line(left + point[0] * scale, y + point[1] * scale, left + next[0] * scale, y + next[1] * scale);
        });
        const centerX = element.points.reduce((sum, point) => sum + point[0], 0) / element.points.length;
        const centerY = element.points.reduce((sum, point) => sum + point[1], 0) / element.points.length;
        label(element, centerX, centerY);
      } else label(element, element.x, element.y);
    });
    pdf.setLineDashPattern([], 0);
    pdf.setFont(FAMILY, "normal");
    pdf.setFontSize(6.5);
    pdf.setTextColor(90, 108, 118);
    pdf.text(figure.description, x + maximumWidth / 2, y + height + 4, { align: "center", maxWidth: maximumWidth });
    return y + height + 7;
  }

  async function create(sheet) {
    if (!window.jspdf?.jsPDF) throw new Error("Le module PDF n’est pas disponible.");
    const pdf = new window.jspdf.jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true, putOnlyUsedFonts: true });
    await registerFonts(pdf);
    const left = 17;
    const width = 176;
    const bottom = 280;
    const exercises = fitToSinglePage(sheet.exercises);
    const estimatedTotal = exercises.reduce((sum, exercise) => sum + estimateExercise(exercise), 0);
    const compact = Math.min(1, 216 / Math.max(1, estimatedTotal));
    const bodyFontSize = Math.max(8.3, 10 * compact);
    const answerGap = Math.max(3.8, 5.2 * compact);
    let page = 1;
    let y = 16;

    function footer() {
      pdf.setDrawColor(205, 216, 221);
      pdf.setLineWidth(.25);
      pdf.line(left, 286, 193, 286);
      pdf.setFont(FAMILY, "normal");
      pdf.setFontSize(7.5);
      pdf.setTextColor(90, 108, 118);
      pdf.text(`Page ${page}`, 193, 291, { align: "right" });
    }

    function nextPage() {
      footer();
      pdf.addPage("a4", "portrait");
      page += 1;
      y = 15;
    }

    pdf.setTextColor(18, 52, 72);
    pdf.setFont(FAMILY, "bold");
    pdf.setFontSize(17);
    const documentTitle = sheet.practice ? "Feuille d’entraînement" : "Interrogation de mathématiques";
    pdf.text(documentTitle, left, y);
    pdf.setFont(FAMILY, "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(77, 98, 109);
    pdf.text(`${sheet.level}e`, left, y + 7);
    pdf.text(`Calculatrice : ${sheet.calculator === "allowed" ? "autorisée" : "non autorisée"}`, 193, y + 7, { align: "right" });
    pdf.text("Nom et prénom :", left, y + 16);
    pdf.line(left + 29, y + 16.5, 113, y + 16.5);
    pdf.text("Date :", 127, y + 16);
    pdf.line(139, y + 16.5, 193, y + 16.5);
    const usedCompetencies = window.AssessmentBank.COMPETENCIES.filter((competency) => exercises.some((exercise) => exercise.competencies.includes(competency)));
    let competencyX = left;
    pdf.setFontSize(6.6);
    usedCompetencies.forEach((competency) => {
      pdf.setDrawColor(70, 101, 113);
      pdf.rect(competencyX, y + 20, 3.5, 3.5);
      pdf.text(competency, competencyX + 5, y + 22.8);
      competencyX += 7 + pdf.getTextWidth(competency);
    });
    pdf.setDrawColor(44, 103, 120);
    pdf.setLineWidth(.7);
    pdf.line(left, y + 27, 193, y + 27);
    y += 35;

    exercises.forEach((exercise, index) => {
      pdf.setFont(FAMILY, "normal");
      pdf.setFontSize(bodyFontSize);
      if (y + Math.min(estimateExercise(exercise) * compact, 210) > bottom) nextPage();

      pdf.setFillColor(241, 247, 248);
      pdf.setDrawColor(185, 207, 213);
      pdf.roundedRect(left, y - 5, width, 9, 2, 2, "FD");
      pdf.setFont(FAMILY, "bold");
      pdf.setFontSize(10.5);
      pdf.setTextColor(23, 63, 95);
      pdf.text(`Exercice ${index + 1} - ${exercise.title}`, left + 4, y + .8);
      y += 9;
      pdf.setFont(FAMILY, "normal");
      pdf.setFontSize(bodyFontSize);
      pdf.setTextColor(18, 52, 72);
      y = drawMathLines(pdf, mathLines(pdf, exercise.content, width - 4, bodyFontSize), left + 2, y, bodyFontSize);
      (exercise.figures || []).forEach((figure) => { y = drawFigure(pdf, figure, left + 2, y + 2, width - 4); });
      (exercise.repeatedItems || []).forEach((item, itemIndex) => {
        pdf.setFont(FAMILY, "bold");
        pdf.setFontSize(bodyFontSize);
        pdf.text(`${itemIndex + 1}.`, left + 2, y + 3.8);
        pdf.setFont(FAMILY, "normal");
        y = drawMathLines(pdf, mathLines(pdf, item.content, width - 12, bodyFontSize), left + 10, y, bodyFontSize);
      });
      y += 2;
      pdf.setDrawColor(218, 225, 228);
      pdf.setLineWidth(.2);
      for (let line = 0; line < exercise.answerLines; line += 1) {
        if (y + answerGap > bottom) nextPage();
        pdf.line(left + 2, y + answerGap - 1.5, 191, y + answerGap - 1.5);
        y += answerGap;
      }
      y += 4;
    });
    footer();
    pdf.setProperties({ title: `${sheet.practice ? "Entraînement" : "Interrogation"} ${sheet.level}e`, subject: "Mathématiques" });
    return pdf;
  }

  async function download(sheet) {
    const pdf = await create(sheet);
    const url = URL.createObjectURL(pdf.output("blob"));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeFilename(`${sheet.practice ? "entrainement" : "interrogation"}-${sheet.level}e`)}.pdf`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  window.AssessmentPdf = { create, download, fitToSinglePage, estimateExercise };
})();
