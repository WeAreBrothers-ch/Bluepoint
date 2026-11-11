/**
 * BluePoint — interactions communes à toutes les pages :
 * menu plein écran (mobile) et vérification d’âge.
 */
(function () {
  "use strict";

  var AGE_STORAGE_KEY = "bp-age-ok";
  var AGE_ATTRIBUTE = "data-age-ok";

  /* ---------- Menu mobile (<dialog> natif : Échap et focus gérés par le navigateur) ---------- */

  function setupMenu(scope) {
    var dialog = scope.querySelector("[data-bp-menu]");
    var openButton = scope.querySelector("[data-bp-menu-open]");
    if (!(dialog instanceof HTMLDialogElement) || !openButton) return;
    if (dialog.hasAttribute("data-bp-ready")) return;
    dialog.setAttribute("data-bp-ready", "");

    openButton.addEventListener("click", function () {
      dialog.showModal();
    });
    dialog.addEventListener("click", function (event) {
      var target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      // Fermer au clic sur « Fermer » ou sur un lien (ancre de la même page comprise).
      if (target.closest("[data-bp-menu-close]") || target.closest("a")) dialog.close();
    });
  }

  /* ---------- Vérification d’âge ---------- */

  function rememberAge() {
    try {
      window.localStorage.setItem(AGE_STORAGE_KEY, String(Date.now()));
    } catch (error) {
      // Stockage indisponible : la confirmation vaut pour la page en cours uniquement.
    }
    document.documentElement.setAttribute(AGE_ATTRIBUTE, "");
  }

  function showRefusal(gate) {
    var question = gate.querySelector("[data-bp-age-question]");
    var refused = gate.querySelector("[data-bp-age-refused]");
    var template = gate.querySelector("[data-bp-age-refused-template]");
    if (!refused || !(template instanceof HTMLTemplateElement)) return;
    if (question) question.hidden = true;
    refused.replaceChildren(template.content.cloneNode(true));
    refused.focus();
  }

  function setupAgeGate() {
    var gate = document.querySelector("[data-bp-age-gate]");
    if (!(gate instanceof HTMLDialogElement)) return;

    if (document.documentElement.hasAttribute(AGE_ATTRIBUTE)) {
      gate.close();
      return;
    }

    // Rendue ouverte dans le HTML ; on la rouvre en modale pour rendre le fond inerte.
    gate.close();
    gate.showModal();
    gate.addEventListener("cancel", function (event) {
      event.preventDefault();
    });

    var confirmButton = gate.querySelector("[data-bp-age-confirm]");
    var refuseButton = gate.querySelector("[data-bp-age-refuse]");

    if (confirmButton) {
      confirmButton.addEventListener("click", function () {
        rememberAge();
        gate.close();
        document.dispatchEvent(new CustomEvent("bp:age-confirmed"));
      });
    }
    if (refuseButton) {
      refuseButton.addEventListener("click", function () {
        showRefusal(gate);
      });
    }
  }

  function init() {
    setupMenu(document);
    setupAgeGate();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Éditeur de thème : l’en-tête rechargé doit retrouver son menu.
  document.addEventListener("shopify:section:load", function (event) {
    if (event.target instanceof Element) setupMenu(event.target);
  });
})();
