(function () {
  "use strict";

  const compass = document.querySelector("#compass-motion");
  const arc = document.querySelector("#compass-arc");
  const pointD = document.querySelector("#point-d");
  const labelD = document.querySelector("#label-d");
  const equality = document.querySelector("#result-equality");
  const caption = document.querySelector("#step-caption");
  const stepNumber = document.querySelector("#step-number");
  const progressInput = document.querySelector("#progress");
  const playPause = document.querySelector("#play-pause");
  const stepStarts = [0, .28, .58, .84];
  const captions = [
    "On règle l’écartement du compas sur la longueur AB.",
    "On déplace le compas sans modifier son ouverture.",
    "On pique la pointe sèche en C, puis on trace un arc.",
    "L’intersection donne D : la longueur CD est égale à la longueur AB.",
  ];
  const duration = 11500;
  let progress = 0;
  let playing = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let previousTime = 0;

  function clamp(value, min = 0, max = 1) { return Math.min(max, Math.max(min, value)); }
  function ease(value) {
    const t = clamp(value);
    return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  function phase(value, start, end) { return ease((value - start) / (end - start)); }
  function currentStep(value) {
    if (value < .28) return 0;
    if (value < .58) return 1;
    if (value < .84) return 2;
    return 3;
  }

  function render() {
    const moving = phase(progress, .28, .58);
    const drawing = phase(progress, .58, .84);
    const reveal = phase(progress, .82, .96);
    const translateY = 290 * moving;
    const angle = progress < .58 ? -42 * moving : -42 + 42 * drawing;
    compass.setAttribute("transform", `translate(0 ${translateY.toFixed(2)}) rotate(${angle.toFixed(2)} 170 150)`);
    arc.style.strokeDashoffset = String(100 * (1 - drawing));
    pointD.style.opacity = String(reveal);
    labelD.style.opacity = String(reveal);
    equality.style.opacity = String(reveal);
    const step = currentStep(progress);
    stepNumber.textContent = `Étape ${step + 1} sur 4`;
    caption.textContent = captions[step];
    progressInput.value = String(Math.round(progress * 1000));
    playPause.textContent = progress >= 1 ? "Rejouer" : playing ? "Pause" : "Lecture";
  }

  function animate(time) {
    if (!previousTime) previousTime = time;
    if (playing) {
      progress = clamp(progress + (time - previousTime) / duration);
      if (progress >= 1) playing = false;
      render();
    }
    previousTime = time;
    window.requestAnimationFrame(animate);
  }

  function goToStep(direction) {
    const step = currentStep(progress);
    progress = direction > 0 ? (stepStarts[step + 1] ?? 1) : stepStarts[Math.max(0, step - 1)];
    playing = false;
    render();
  }

  document.querySelector("#previous-step").addEventListener("click", () => goToStep(-1));
  document.querySelector("#next-step").addEventListener("click", () => goToStep(1));
  document.querySelector("#restart").addEventListener("click", () => {
    progress = 0;
    playing = true;
    render();
  });
  playPause.addEventListener("click", () => {
    if (progress >= 1) progress = 0;
    playing = !playing;
    render();
  });
  progressInput.addEventListener("input", () => {
    progress = Number(progressInput.value) / 1000;
    playing = false;
    render();
  });

  render();
  window.requestAnimationFrame(animate);
}());
