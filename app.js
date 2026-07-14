const chapters = {
  6: [
    { icon: "123", title: "Nombres entiers et décimaux", description: "Lire, écrire, comparer et ranger les nombres.", tags: ["Cours", "Exercices"] },
    { icon: "½", title: "Fractions", description: "Comprendre une fraction et la placer sur une droite graduée.", tags: ["Méthode", "Quiz"] },
    { icon: "×", title: "Calcul et priorités", description: "Choisir la bonne opération et organiser ses calculs.", tags: ["Cours", "Exercices"] },
    { icon: "∠", title: "Angles", description: "Nommer, mesurer et construire des angles.", tags: ["Méthode", "Activité"] },
    { icon: "▱", title: "Périmètres et aires", description: "Calculer des longueurs et des surfaces usuelles.", tags: ["Cours", "Quiz"] },
    { icon: "◎", title: "Symétrie axiale", description: "Reconnaître et construire le symétrique d’une figure.", tags: ["Activité", "Exercices"] },
  ],
  4: [
    { icon: "±", title: "Nombres relatifs", description: "Calculer avec des nombres positifs et négatifs.", tags: ["Cours", "Exercices"] },
    { icon: "10ⁿ", title: "Puissances", description: "Utiliser les puissances de 10 et l’écriture scientifique.", tags: ["Méthode", "Quiz"] },
    { icon: "x", title: "Calcul littéral", description: "Réduire, développer et utiliser une expression littérale.", tags: ["Cours", "Exercices"] },
    { icon: "%", title: "Proportionnalité", description: "Résoudre des problèmes de pourcentage et de vitesse.", tags: ["Méthode", "Activité"] },
    { icon: "△", title: "Théorème de Pythagore", description: "Calculer une longueur et reconnaître un triangle rectangle.", tags: ["Cours", "Quiz"] },
    { icon: "↗", title: "Fonctions", description: "Lire et représenter une dépendance entre deux grandeurs.", tags: ["Activité", "Exercices"] },
  ],
};

const normalize = (value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function renderChapters(level, query = "") {
  const container = document.querySelector(`[data-chapters="${level}"]`);
  const emptyState = document.querySelector(`[data-empty="${level}"]`);
  const filtered = chapters[level].filter((chapter) =>
    normalize(`${chapter.title} ${chapter.description}`).includes(normalize(query)),
  );

  container.innerHTML = filtered.map((chapter) => `
    <article class="chapter-card">
      <span class="chapter-icon" aria-hidden="true">${chapter.icon}</span>
      <h2>${chapter.title}</h2>
      <p>${chapter.description}</p>
      <div class="tags">${chapter.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}</div>
    </article>
  `).join("");
  emptyState.hidden = filtered.length !== 0;
}

function showPage() {
  const route = window.location.hash.slice(1) || "accueil";
  const validRoute = document.querySelector(`[data-page="${route}"]`) ? route : "accueil";

  document.querySelectorAll("[data-page]").forEach((page) => {
    const isActive = page.dataset.page === validRoute;
    page.hidden = !isActive;
    page.classList.toggle("active", isActive);
  });
  document.querySelectorAll("[data-route]").forEach((link) => {
    const isActive = link.dataset.route === validRoute;
    link.classList.toggle("active", isActive);
    if (isActive) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  document.querySelector(".navigation").classList.remove("open");
  document.querySelector(".menu-button").setAttribute("aria-expanded", "false");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateNetworkStatus() {
  const online = navigator.onLine;
  document.querySelector("#network-label").textContent = online ? "En ligne" : "Hors connexion";
  document.querySelector("#network-status").classList.toggle("offline", !online);
}

document.querySelectorAll("[data-search]").forEach((input) => {
  input.addEventListener("input", (event) => renderChapters(event.target.dataset.search, event.target.value));
});

document.querySelector(".menu-button").addEventListener("click", (event) => {
  const navigation = document.querySelector(".navigation");
  const open = navigation.classList.toggle("open");
  event.currentTarget.setAttribute("aria-expanded", String(open));
});

window.addEventListener("hashchange", showPage);
window.addEventListener("online", updateNetworkStatus);
window.addEventListener("offline", updateNetworkStatus);

renderChapters("6");
renderChapters("4");
showPage();
updateNetworkStatus();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
}
