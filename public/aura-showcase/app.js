document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", (e) => {
    const target = document.querySelector(anchor.getAttribute("href"));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth" });
    }
  });
});

const current = window.location.pathname.split("/").pop() || "index.html";
document.querySelectorAll(".site-nav a").forEach((a) => {
  const href = a.getAttribute("href");
  if (href === current || (current === "" && href === "index.html")) {
    a.setAttribute("aria-current", "page");
  }
});
