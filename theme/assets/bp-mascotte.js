/**
 * BluePoint — Paolo surgit en bas de l’écran, un peu à gauche du centre (ou du haut de la barre d’achat
 * quand elle est affichée), après chaque ajout au panier (événement « bp:cart-added »
 * émis par bp-cart.js). Un nouvel ajout pendant l’apparition prolonge sa présence.
 * Il redescend aussitôt si l’on fait vraiment défiler la page, ou si on la quitte.
 */
(function () {
  "use strict";

  var VISIBLE_MS = 2200;
  /* Un ajout peut décaler la page de quelques pixels (message de confirmation) :
     seul un vrai défilement, au-delà de ce seuil, fait redescendre Paolo. */
  var SCROLL_THRESHOLD_PX = 48;
  var EDGE_MARGIN_PX = 12;
  var timer = 0;
  var startY = 0;

  function mascotte() {
    return document.querySelector("[data-bp-mascotte]");
  }

  /* Le bord d’où il sort : le haut de la barre d’achat si elle est visible, sinon le bas de l’écran. */
  function alignOnEdge(element) {
    var bar = document.querySelector('[data-barre-achat="visible"]');
    var bottom = bar ? document.documentElement.clientHeight - bar.getBoundingClientRect().top : 0;
    element.style.setProperty("--bp-mascotte-bas", Math.max(0, Math.round(bottom)) + "px");
  }

  /* Décale la bulle horizontalement pour qu’elle reste entière dans l’écran. */
  function keepBubbleOnScreen(element) {
    var bubble = element.querySelector(".bp-mascotte__bubble");
    var body = element.querySelector(".bp-mascotte__body");
    if (!bubble || !body) return;
    var left = body.getBoundingClientRect().left + bubble.offsetLeft;
    var right = left + bubble.offsetWidth;
    var maxRight = document.documentElement.clientWidth - EDGE_MARGIN_PX;
    var shift = 0;
    if (left < EDGE_MARGIN_PX) shift = EDGE_MARGIN_PX - left;
    else if (right > maxRight) shift = maxRight - right;
    bubble.style.setProperty("--bp-bulle-x", Math.round(shift) + "px");
  }

  function hide() {
    var element = mascotte();
    window.clearTimeout(timer);
    if (element) element.setAttribute("data-visible", "false");
  }

  function show() {
    var element = mascotte();
    if (!element) return;
    alignOnEdge(element);
    keepBubbleOnScreen(element);
    startY = window.scrollY;
    element.setAttribute("data-visible", "true");
    window.clearTimeout(timer);
    timer = window.setTimeout(hide, VISIBLE_MS);
  }

  function hideOnScroll() {
    var element = mascotte();
    if (!element || element.getAttribute("data-visible") !== "true") return;
    if (Math.abs(window.scrollY - startY) > SCROLL_THRESHOLD_PX) hide();
  }

  document.addEventListener("bp:cart-added", show);
  window.addEventListener("scroll", hideOnScroll, { passive: true });
  window.addEventListener("pagehide", hide);
})();
