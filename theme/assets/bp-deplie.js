/**
 * BluePoint — dépliage doux des menus déroulants natifs (<details data-bp-deplie>) : fiche bouteille, questions
 * fréquentes, « Lire la suite » de l'accueil. Au toucher, la hauteur suit en 280 ms à l'ouverture et 200 ms à la
 * fermeture (la sortie est plus vive que l'entrée), et le texte apparaît en fondu. Un second toucher pendant le
 * mouvement le renverse depuis là où il en est.
 * Sans script, ou avec le mouvement réduit demandé par l'appareil, le menu s'ouvre d'un coup comme avant.
 * Les ouvertures faites par le code (bp-product-blocks.js sur grand écran) ne passent pas par ici : pas d'animation.
 */
(function () {
  "use strict";

  var OUVERTURE_MS = 280;
  var FERMETURE_MS = 200;
  var COURBE = "cubic-bezier(0.23, 1, 0.32, 1)";
  var MOUVEMENT_REDUIT = window.matchMedia("(prefers-reduced-motion: reduce)");

  function contentOf(details) {
    return Array.prototype.filter.call(details.children, function (child) {
      return child.tagName !== "SUMMARY";
    });
  }

  function finish(details) {
    details.style.height = "";
    details.style.overflow = "";
    details.bpAnimation = null;
  }

  function run(details, from, to, duration, opening) {
    if (details.bpAnimation) details.bpAnimation.cancel();
    details.style.overflow = "hidden";

    var animation = details.animate(
      { height: [from + "px", to + "px"] },
      { duration: duration, easing: COURBE }
    );
    details.bpAnimation = animation;

    contentOf(details).forEach(function (child) {
      child.animate(
        { opacity: opening ? [0, 1] : [1, 0] },
        { duration: duration, easing: COURBE, fill: "forwards" }
      ).finished.then(function (fade) { fade.cancel(); }, function () {});
    });

    animation.onfinish = function () {
      if (!opening) details.open = false;
      finish(details);
    };
    animation.oncancel = function () {
      if (details.bpAnimation === animation) finish(details);
    };
  }

  // Hauteur du menu fermé : l'intitulé, plus le cadre et les marges intérieures du menu.
  function closedHeight(details, summary) {
    var style = getComputedStyle(details);
    var frame = ["borderTopWidth", "borderBottomWidth", "paddingTop", "paddingBottom"].reduce(function (sum, key) {
      return sum + (parseFloat(style[key]) || 0);
    }, 0);
    return summary.offsetHeight + frame;
  }

  function toggle(details, summary) {
    // La hauteur affichée à l'instant (en plein mouvement si on retouche), puis la hauteur naturelle sans animation.
    var current = details.offsetHeight;
    if (details.bpAnimation) details.bpAnimation.cancel();
    var closing = details.open && !details.bpClosing;

    if (closing) {
      details.bpClosing = true;
      run(details, current, closedHeight(details, summary), FERMETURE_MS, false);
      return;
    }

    details.bpClosing = false;
    details.open = true;
    var target = details.offsetHeight;
    details.style.height = current + "px";
    run(details, current, target, OUVERTURE_MS, true);
  }

  function attach(details) {
    var summary = details.querySelector(":scope > summary");
    if (!summary) return;

    summary.addEventListener("click", function (event) {
      if (MOUVEMENT_REDUIT.matches) return;
      event.preventDefault();
      toggle(details, summary);
    });

    details.addEventListener("toggle", function () {
      if (details.open) details.bpClosing = false;
    });
  }

  document.querySelectorAll("details[data-bp-deplie]").forEach(attach);
})();
