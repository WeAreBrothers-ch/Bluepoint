/**
 * BluePoint — fiche bouteille : menus déroulants des textes (snippets/bp-product-blocks.liquid).
 * Fermés sur téléphone pour garder la fiche courte, ouverts sur grand écran où la place ne manque pas.
 * Suit les changements de taille d'écran (rotation d'une tablette). Sans script, ils restent fermés et s'ouvrent au toucher.
 */
(function () {
  "use strict";

  var GRAND_ECRAN = window.matchMedia("(min-width: 64rem)");

  function syncOpenState() {
    document.querySelectorAll("[data-bp-pli]").forEach(function (block) {
      block.open = GRAND_ECRAN.matches;
    });
  }

  syncOpenState();
  GRAND_ECRAN.addEventListener("change", syncOpenState);
})();
