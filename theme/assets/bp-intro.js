/**
 * BluePoint — intro animée de l’accueil.
 * Le mouvement est entièrement en CSS (bp-intro.css) : il démarre de lui-même quand l’intro
 * devient visible, c’est-à-dire une fois l’âge confirmé. Ce script :
 * - rend le reste de la page inerte pendant l’intro (clavier, lecteurs d’écran) et place le focus sur « Passer » ;
 * - retient que l’intro a été vue (fin du rideau ou bouton « Passer ») et libère la page.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "bp-intro-vue";
  var ROOT_ATTRIBUTE = "data-intro-vue";
  var AGE_ATTRIBUTE = "data-age-ok";
  var BEHIND_SELECTOR = [
    ".bp-header-section",
    "#MainContent > .shopify-section:not(.bp-intro-section)",
    ".bp-footer-section",
    "[data-bp-floating-cart]",
  ].join(", ");

  var root = document.documentElement;

  function setBehindInert(inert) {
    document.querySelectorAll(BEHIND_SELECTOR).forEach(function (element) {
      element.inert = inert;
    });
  }

  function markIntroSeen() {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, "1");
    } catch (error) {
      // Stockage indisponible : l’intro pourra se rejouer au prochain chargement, sans gravité.
    }
    root.setAttribute(ROOT_ATTRIBUTE, "");
    setBehindInert(false);
  }

  function isPlaying(intro) {
    return Boolean(intro) && root.hasAttribute(AGE_ATTRIBUTE) && !root.hasAttribute(ROOT_ATTRIBUTE);
  }

  /* Intro à l’écran : la page dessous devient inerte, le focus va sur « Passer ». */
  function lockWhilePlaying(intro) {
    if (!isPlaying(intro)) return;
    setBehindInert(true);
    var skip = intro.querySelector("[data-bp-intro-skip]");
    if (skip) skip.focus({ preventScroll: true });
  }

  function init() {
    var intro = document.querySelector("[data-bp-intro]");
    if (!intro) return;

    // Seule la fin du rideau (animation du bloc lui-même) compte, pas celles de ses enfants.
    intro.addEventListener("animationend", function (event) {
      if (event.target === intro) markIntroSeen();
    });

    var skip = intro.querySelector("[data-bp-intro-skip]");
    if (skip) skip.addEventListener("click", markIntroSeen);

    lockWhilePlaying(intro);
  }

  /* Éditeur de thème : sélectionner la section « Intro animée » la rejoue. */
  function replay(event) {
    var target = event.target instanceof Element ? event.target : null;
    var intro = target ? target.querySelector("[data-bp-intro]") : null;
    if (!intro) return;
    root.removeAttribute(ROOT_ATTRIBUTE);
    var fresh = intro.cloneNode(true);
    intro.replaceWith(fresh);
    init();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // L’âge vient d’être confirmé : l’intro apparaît, on verrouille la page dessous.
  document.addEventListener("bp:age-confirmed", function () {
    lockWhilePlaying(document.querySelector("[data-bp-intro]"));
  });
  document.addEventListener("shopify:section:select", replay);
  document.addEventListener("shopify:section:load", replay);
})();
