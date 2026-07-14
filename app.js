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

document.querySelector(".menu-button").addEventListener("click", (event) => {
  const navigation = document.querySelector(".navigation");
  const open = navigation.classList.toggle("open");
  event.currentTarget.setAttribute("aria-expanded", String(open));
});

window.addEventListener("hashchange", showPage);
window.addEventListener("online", updateNetworkStatus);
window.addEventListener("offline", updateNetworkStatus);

showPage();
updateNetworkStatus();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
}
