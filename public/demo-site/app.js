const root = document.documentElement;
const button = document.getElementById("theme-toggle");
const counters = document.querySelectorAll("[data-count]");

function animateCounter(node) {
  const target = Number(node.dataset.count || "0");
  let current = 0;
  const step = Math.max(1, Math.round(target / 40));

  const tick = () => {
    current = Math.min(target, current + step);
    node.textContent = String(current);
    if (current < target) {
      requestAnimationFrame(tick);
    }
  };

  requestAnimationFrame(tick);
}

for (const counter of counters) {
  animateCounter(counter);
}

button?.addEventListener("click", () => {
  const next = root.dataset.glow === "soft" ? "" : "soft";
  if (next) {
    root.dataset.glow = next;
  } else {
    delete root.dataset.glow;
  }
});
