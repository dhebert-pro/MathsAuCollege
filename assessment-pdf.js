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

  async function create(sheet) {
    if (!window.jspdf?.jsPDF) throw new Error("Le module PDF n’est pas disponible.");
    const pdf = new window.jspdf.jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true, putOnlyUsedFonts: true });
    await registerFonts(pdf);
    const left = 17;
    const width = 176;
    const bottom = 279;
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
    pdf.text(`${sheet.level}e - Durée indicative : ${sheet.estimatedMinutes} min`, left, y + 7);
    pdf.text("Nom et prénom :", left, y + 16);
    pdf.line(left + 29, y + 16.5, 113, y + 16.5);
    pdf.text("Date :", 127, y + 16);
    pdf.line(139, y + 16.5, 193, y + 16.5);
    pdf.setDrawColor(44, 103, 120);
    pdf.setLineWidth(.7);
    pdf.line(left, y + 22, 193, y + 22);
    y += 31;

    sheet.exercises.forEach((exercise, index) => {
      pdf.setFont(FAMILY, "normal");
      pdf.setFontSize(10.3);
      const paragraphs = cleanText(exercise.content).split(/\n+/).flatMap((paragraph) => pdf.splitTextToSize(paragraph || " ", width - 10));
      const textHeight = Math.max(1, paragraphs.length) * 5.1;
      const answerHeight = exercise.answerLines * 6;
      const totalHeight = 13 + textHeight + answerHeight;
      if (y + Math.min(totalHeight, 80) > bottom) nextPage();

      pdf.setFillColor(241, 247, 248);
      pdf.setDrawColor(185, 207, 213);
      pdf.roundedRect(left, y - 5, width, 9, 2, 2, "FD");
      pdf.setFont(FAMILY, "bold");
      pdf.setFontSize(10.5);
      pdf.setTextColor(23, 63, 95);
      pdf.text(`Exercice ${index + 1} - ${exercise.title}`, left + 4, y + .8);
      y += 9;
      pdf.setFont(FAMILY, "normal");
      pdf.setFontSize(10.3);
      pdf.setTextColor(18, 52, 72);
      paragraphs.forEach((line) => {
        if (y + 5 > bottom) nextPage();
        pdf.text(line, left + 2, y);
        y += 5.1;
      });
      y += 2;
      pdf.setDrawColor(218, 225, 228);
      pdf.setLineWidth(.2);
      for (let line = 0; line < exercise.answerLines; line += 1) {
        if (y + 6 > bottom) nextPage();
        pdf.line(left + 2, y + 3, 191, y + 3);
        y += 6;
      }
      y += 5;
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
    link.download = `${safeFilename(`${sheet.practice ? "entrainement" : "interrogation"}-${sheet.level}e-${sheet.estimatedMinutes}min`)}.pdf`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  window.AssessmentPdf = { create, download };
})();
