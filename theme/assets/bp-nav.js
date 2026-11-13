/**
 * BluePoint — grand menu de l'ordinateur (snippets/bp-nav-desktop.liquid), motif « disclosure » :
 * chaque rayon est un bouton (aria-expanded, aria-controls) qui montre ou cache son panneau.
 * - Clic, Entrée ou Espace : ouvre ou ferme le rayon.
 * - Souris : le rayon s'ouvre après un court arrêt dessus (un simple passage n'ouvre rien) ; quitter le menu
 *   le referme après un délai, pour pouvoir descendre en biais vers le panneau.
 * - Échap referme et rend le focus au bouton ; un clic ailleurs ou un focus qui sort du menu referme aussi.
 * Passer d'un rayon ouvert à un autre est immédiat (data-instant : pas de nouvelle apparition).
 */
(function () {
  "use strict";

  var OPEN_DELAY_MS = 160;
  var SWITCH_DELAY_MS = 90;
  var CLOSE_DELAY_MS = 320;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  var desktop = window.matchMedia("(min-width: 75rem)");

  function panelOf(trigger) {
    var id = trigger.getAttribute("aria-controls");
    return id ? document.getElementById(id) : null;
  }

  function setupNav(nav) {
    if (nav.hasAttribute("data-bp-ready")) return;
    nav.setAttribute("data-bp-ready", "");

    var current = null;
    var openedByHover = false;
    var timer = 0;

    function show(trigger, isOpen) {
      var panel = panelOf(trigger);
      if (panel) panel.hidden = !isOpen;
      trigger.setAttribute("aria-expanded", isOpen ? "true" : "false");
    }

    function close(returnFocus) {
      window.clearTimeout(timer);
      openedByHover = false;
      if (!current) return;
      var closing = current;
      current = null;
      show(closing, false);
      nav.removeAttribute("data-instant");
      if (returnFocus) closing.focus();
    }

    function open(trigger, byHover) {
      window.clearTimeout(timer);
      openedByHover = byHover;
      if (current === trigger) return;
      // Un panneau déjà ouvert : le suivant le remplace sans animation.
      if (current) {
        nav.setAttribute("data-instant", "");
        show(current, false);
      }
      current = trigger;
      show(trigger, true);
    }

    // Dès qu'on s'apprête à ouvrir un rayon, les images de son panneau (caché, donc en attente) se chargent.
    function preload(trigger) {
      var panel = panelOf(trigger);
      if (!panel) return;
      panel.querySelectorAll("img[loading='lazy']").forEach(function (image) {
        image.loading = "eager";
      });
    }

    function later(action, delay) {
      window.clearTimeout(timer);
      timer = window.setTimeout(action, delay);
    }

    nav.querySelectorAll("[data-bp-nav-trigger]").forEach(function (trigger) {
      trigger.addEventListener("focus", function () {
        preload(trigger);
        // Au clavier, arriver sur un autre rayon referme le panneau précédent.
        if (current && current !== trigger) close(false);
      });
      trigger.addEventListener("click", function () {
        // Un clic juste après une ouverture au survol confirme le rayon au lieu de le refermer.
        if (current === trigger && !openedByHover) close(false);
        else open(trigger, false);
      });
      trigger.addEventListener("pointerenter", function (event) {
        if (event.pointerType !== "mouse" || !finePointer.matches) return;
        preload(trigger);
        later(function () {
          open(trigger, true);
        }, current ? SWITCH_DELAY_MS : OPEN_DELAY_MS);
      });
      // Passage rapide sur le bouton : l'ouverture prévue est annulée.
      trigger.addEventListener("pointerleave", function (event) {
        if (event.pointerType !== "mouse" || current === trigger) return;
        window.clearTimeout(timer);
      });
    });

    nav.addEventListener("pointerleave", function (event) {
      if (event.pointerType === "mouse" && current) later(close, CLOSE_DELAY_MS);
    });
    nav.addEventListener("pointerenter", function (event) {
      if (event.pointerType === "mouse" && current) window.clearTimeout(timer);
    });

    nav.addEventListener("focusout", function (event) {
      var next = event.relatedTarget;
      if (next instanceof Node && !nav.contains(next)) close(false);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && current) close(true);
    });

    document.addEventListener("click", function (event) {
      if (current && event.target instanceof Node && !nav.contains(event.target)) close(false);
    });

    // Fenêtre réduite sous la largeur d'un ordinateur : le menu du téléphone prend le relais.
    desktop.addEventListener("change", function (event) {
      if (!event.matches) close(false);
    });
  }

  function init(scope) {
    scope.querySelectorAll("[data-bp-nav]").forEach(setupNav);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      init(document);
    });
  } else {
    init(document);
  }

  // Éditeur de thème : l'en-tête rechargé doit retrouver son menu.
  document.addEventListener("shopify:section:load", function (event) {
    if (event.target instanceof Element) init(event.target);
  });
})();
