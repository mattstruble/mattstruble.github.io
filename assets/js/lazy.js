var observer;

function loadImage(image) {
  var i = new Image();
  i.onload = function () {
    image.classList.add("lazy-loaded");
    image.src = image.dataset.lazySrc;
  };
  i.onerror = function () {
    image.classList.add("lazy-error");
  };
  i.src = image.dataset.lazySrc;
}

function onIntersection(entries) {
  for (var e in entries) {
    if (entries[e].intersectionRatio <= 0) continue;
    observer.unobserve(entries[e].target); // Stop watching
    loadImage(entries[e].target);
  }
}

var images = document.querySelectorAll("img[data-lazy-src]");
if ("IntersectionObserver" in window) {
  observer = new IntersectionObserver(onIntersection, { rootMargin: "250px" });
  for (var i in images) {
    if (
      typeof images[i] === "object" &&
      "classList" in images[i] &&
      !images[i].classList.contains("lazy-loaded") &&
      !images[i].classList.contains("lazy-error")
    ) {
      observer.observe(images[i]);
    }
  }
} else {
  for (var image in images) loadImage(image);
}
