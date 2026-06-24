const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector(".site-nav");

if (navToggle && siteNav) {
  navToggle.addEventListener("click", () => {
    const isOpen = siteNav.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });
}

const slides = [...document.querySelectorAll(".slide")];
const nextButton = document.querySelector("[data-next]");
const prevButton = document.querySelector("[data-prev]");
let activeSlide = 0;
let sliderTimer;

function showSlide(index) {
  if (!slides.length) return;
  activeSlide = (index + slides.length) % slides.length;
  slides.forEach((slide, slideIndex) => {
    slide.classList.toggle("is-active", slideIndex === activeSlide);
  });
}

function restartSlider() {
  window.clearInterval(sliderTimer);
  sliderTimer = window.setInterval(() => showSlide(activeSlide + 1), 4600);
}

if (slides.length) {
  nextButton?.addEventListener("click", () => {
    showSlide(activeSlide + 1);
    restartSlider();
  });

  prevButton?.addEventListener("click", () => {
    showSlide(activeSlide - 1);
    restartSlider();
  });

  restartSlider();
}

const revealItems = [...document.querySelectorAll("[data-reveal]")];

if (revealItems.length) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.18, rootMargin: "0px 0px -40px 0px" }
  );

  revealItems.forEach((item, index) => {
    item.style.transitionDelay = `${Math.min(index * 45, 220)}ms`;
    revealObserver.observe(item);
  });
}
