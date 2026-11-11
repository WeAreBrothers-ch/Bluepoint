/**
 * BluePoint — photos de la fiche bouteille (snippets/bp-product-gallery.liquid).
 * Affiche les vignettes (masquées sans script) et montre la photo choisie dans la grande tuile.
 * La vignette active porte aria-pressed="true" ; « Photo 2 sur 3 » est annoncé et affiché.
 */
(function () {
  "use strict";

  function setup(gallery) {
    var thumbs = gallery.querySelectorAll("[data-bp-gallery-thumb]");
    var slides = gallery.querySelectorAll(".bp-gallery__slide");
    var count = gallery.querySelector("[data-bp-gallery-count]");
    var strip = gallery.querySelector("[data-bp-gallery-thumbs]");
    if (!strip || thumbs.length < 2 || thumbs.length !== slides.length) return;

    function show(index) {
      Array.prototype.forEach.call(slides, function (slide, i) {
        slide.hidden = i !== index;
      });
      Array.prototype.forEach.call(thumbs, function (thumb, i) {
        thumb.setAttribute("aria-pressed", i === index ? "true" : "false");
      });
      if (count) count.textContent = "Photo " + (index + 1) + " sur " + thumbs.length;
    }

    Array.prototype.forEach.call(thumbs, function (thumb, index) {
      thumb.addEventListener("click", function () {
        show(index);
      });
    });

    strip.hidden = false;
    if (count) count.hidden = false;
  }

  function init() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-bp-gallery]"), setup);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
