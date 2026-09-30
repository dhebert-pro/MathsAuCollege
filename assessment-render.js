(function () {
  "use strict";

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  }

  function richText(value) {
    const source = String(value || "");
    const pattern = /\[\[frac:([^|\]]+)\|([^\]]+)\]\]/g;
    let html = "";
    let index = 0;
    for (const match of source.matchAll(pattern)) {
      html += escapeHtml(source.slice(index, match.index));
      html += `<span class="math-fraction"><span>${escapeHtml(match[1].trim())}</span><span>${escapeHtml(match[2].trim())}</span></span>`;
      index = match.index + match[0].length;
    }
    html += escapeHtml(source.slice(index));
    return html.replace(/\n/g, "<br>");
  }

  function labelSvg(element, x, y) {
    return element.label ? `<text x="${x}" y="${y}" class="figure-label">${escapeHtml(element.label)}</text>` : "";
  }

  function figureSvg(figure) {
    const elements = figure.elements.map((element) => {
      const dashed = element.dashed ? ' stroke-dasharray="8 6"' : "";
      if (element.type === "point") return `<g><line x1="${element.x - 6}" y1="${element.y}" x2="${element.x + 6}" y2="${element.y}"/><line x1="${element.x}" y1="${element.y - 6}" x2="${element.x}" y2="${element.y + 6}"/>${labelSvg(element, element.x + 9, element.y - 9)}</g>`;
      if (element.type === "segment") return `<g><line x1="${element.x1}" y1="${element.y1}" x2="${element.x2}" y2="${element.y2}"${dashed}/>${labelSvg(element, (element.x1 + element.x2) / 2 + 7, (element.y1 + element.y2) / 2 - 8)}</g>`;
      if (element.type === "circle") return `<g><circle cx="${element.cx}" cy="${element.cy}" r="${element.r}"${dashed}/>${labelSvg(element, element.cx + element.r + 8, element.cy)}</g>`;
      if (element.type === "polygon") {
        const points = element.points.map((point) => point.join(",")).join(" ");
        const centerX = element.points.reduce((sum, point) => sum + point[0], 0) / element.points.length;
        const centerY = element.points.reduce((sum, point) => sum + point[1], 0) / element.points.length;
        return `<g><polygon points="${points}"${dashed}/>${labelSvg(element, centerX, centerY)}</g>`;
      }
      return labelSvg(element, element.x, element.y);
    }).join("");
    return `<figure class="assessment-vector-figure" role="img" aria-label="${escapeHtml(figure.description)}"><svg viewBox="0 0 ${figure.width} ${figure.height}" xmlns="http://www.w3.org/2000/svg">${elements}</svg><figcaption>${escapeHtml(figure.description)}</figcaption></figure>`;
  }

  function exerciseHtml(exercise) {
    const repeated = exercise.repeatedItems?.length
      ? `<ol class="assessment-repeated-items">${exercise.repeatedItems.map((item) => `<li>${richText(item.content)}</li>`).join("")}</ol>`
      : "";
    return `<div class="assessment-rich-text">${richText(exercise.content)}</div>${(exercise.figures || []).map(figureSvg).join("")}${repeated}`;
  }

  window.AssessmentRender = { richText, figureSvg, exerciseHtml };
})();
