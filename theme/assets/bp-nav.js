/**
 * BluePoint — grand menu de l'ordinateur (snippets/bp-nav-desktop.liquid).
 * Un rayon s'ouvre au clic ou au clavier (Entrée, Espace), et à la souris après un court survol.
 * Il se ferme avec Échap (le focus revient sur le rayon), en cliquant ailleurs ou quand le focus sort du menu.
 * Sans script, chaque panneau reste caché et la boutique reste accessible par le lien « Boutique ».
 */
(function () {
  "use strict";

  var OPEN_DELAY_MS = 120;
  var CLOSE_DELAY_MS = 250;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");

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

    function close(returnFocus) {
      if (!current) return;
      var panel = panelOf(current);
      if (panel) panel.hidden = true;
      current.setAttribute("aria-expanded", "false");
      if (returnFocus) current.focus();
      current = null;
    }

    function open(trigger, byHover) {
      openedByHover = byHover;
      if (current === trigger) return;
      close(false);
      var panel = panelOf(trigger);
      if (!panel) return;
      panel.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      current = trigger;
    }

    function schedule(action) {
      window.clearTimeout(timer);
      timer = window.setTimeout(action, action === close ? CLOSE_DELAY_MS : OPEN_DELAY_MS);
    }

    nav.querySelectorAll("[data-bp-nav-trigger]").forEach(function (trigger) {
      trigger.addEventListener("click", function () {
        window.clearTimeout(timer);
        // Un clic juste après une ouverture au survol confirme le rayon au lieu de le refermer.
        if (current === trigger && !openedByHover) close(false);
        else open(trigger, false);
      });
      trigger.addEventListener("mouseenter", function () {
        if (!finePointer.matches) return;
        schedule(function () {
          open(trigger, true);
        });
      });
    });

    // Survoler un lien simple de la barre (Boutique, Espace pro) referme le panneau ouvert.
    nav.querySelectorAll(".bp-nav__bar a").forEach(function (link) {
      link.addEventListener("mouseenter", function () {
        if (finePointer.matches && current) schedule(close);
      });
    });

    nav.addEventListener("mouseleave", function () {
      if (finePointer.matches && current) schedule(close);
    });
    nav.addEventListener("mouseenter", function () {
      window.clearTimeout(timer);
    });

    nav.addEventListener("focusout", function (event) {
      var next = event.relatedTarget;
      if (next instanceof Node && nav.contains(next)) return;
      if (next) close(false);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && current) close(true);
    });

    document.addEventListener("click", function (event) {
      if (current && event.target instanceof Node && !nav.contains(event.target)) close(false);
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
