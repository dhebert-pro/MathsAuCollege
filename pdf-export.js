(function () {
  "use strict";

  function safeFilename(value) {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/(^-|-$)/g, "").toLowerCase();
  }

  function createDocument(course) {
      if (!window.jspdf?.jsPDF) throw new Error("Le module PDF n’est pas disponible.");
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ unit: "mm", format: "a4" });
      const margin = 20;
      const maxWidth = 170;
      let y = 24;

      pdf.setProperties({ title: course.title, subject: course.summary || "Cours de mathématiques", author: "Maths au collège" });
      pdf.setFillColor(23, 63, 95);
      pdf.rect(0, 0, 210, 10, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(23, 63, 95);
      pdf.setFontSize(10);
      pdf.text(`MATHS AU COLLÈGE · ${course.level}e`, margin, y);
      y += 10;
      pdf.setFontSize(22);
      const titleLines = pdf.splitTextToSize(course.title, maxWidth);
      pdf.text(titleLines, margin, y);
      y += titleLines.length * 9 + 5;
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(80, 96, 108);
      pdf.setFontSize(10);
      pdf.text(`${course.category || "Cours"} · Mis à jour le ${new Intl.DateTimeFormat("fr-FR").format(new Date(course.updatedAt))}`, margin, y);
      y += 10;

      if (course.summary) {
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(23, 63, 95);
        pdf.setFontSize(12);
        const summaryLines = pdf.splitTextToSize(course.summary, maxWidth);
        pdf.text(summaryLines, margin, y);
        y += summaryLines.length * 6 + 8;
      }

      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(35, 49, 58);
      pdf.setFontSize(11);
      const paragraphs = (course.content || "Contenu à venir.").split(/\n+/);
      paragraphs.forEach((paragraph) => {
        const lines = pdf.splitTextToSize(paragraph || " ", maxWidth);
        const needed = lines.length * 6 + 4;
        if (y + needed > 277) {
          pdf.addPage();
          y = 22;
        }
        pdf.text(lines, margin, y);
        y += needed;
      });

      const pages = pdf.getNumberOfPages();
      for (let page = 1; page <= pages; page += 1) {
        pdf.setPage(page);
        pdf.setFontSize(8);
        pdf.setTextColor(120, 130, 138);
        pdf.text(`Page ${page} / ${pages}`, 190, 290, { align: "right" });
      }
      return pdf;
  }

  window.CoursePdf = {
    filename(course) {
      return `${safeFilename(course.title) || "cours"}.pdf`;
    },
    createDownload(course) {
      const pdf = createDocument(course);
      return {
        filename: this.filename(course),
        url: URL.createObjectURL(pdf.output("blob")),
      };
    },
    download(course) {
      createDocument(course).save(this.filename(course));
    },
  };
})();
