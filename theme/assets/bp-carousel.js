/**
 * BluePoint — carrousel à aimantation native (scroll-snap).
 * Les commandes PRÉC. / SUIV. et la réglette n'apparaissent que si la rangée déborde.
 * Les boutons restent focalisables en bout de rangée (aria-disabled plutôt que disabled).
 * La position n'est annoncée aux lecteurs d'écran qu'après un clic sur PRÉC. / SUIV.
 */
(function () {
  "use strict";

  var instances = new WeakMap();

  function stepOf(track) {
    var first = track.firstElementChild;
    if (!(first instanceof HTMLElement)) return 1;
    var gap = parseFloat(getComputedStyle(track).columnGap || "0") || 0;
    return Math.max(first.offsetWidth + gap, 1);
  }

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function setDisabled(button, disabled) {
    button.setAttribute("aria-disabled", disabled ? "true" : "false");
  }

  function setup(root) {
    if (instances.has(root)) return;
    var track = root.querySelector("[data-bp-carousel-track]");
    var controls = root.querySelector("[data-bp-carousel-controls]");
    var prev = root.querySelector("[data-bp-carousel-prev]");
    var next = root.querySelector("[data-bp-carousel-next]");
    var ticksHost = root.querySelector("[data-bp-carousel-ticks]");
    var status = root.querySelector("[data-bp-carousel-status]");
    if (!track || !controls || !prev || !next || !ticksHost) return;

    var count = track.children.length;
    var ticks = [];
    ticksHost.textContent = "";
    for (var i = 0; i < count; i += 1) {
      var tick = document.createElement("span");
      tick.className = "bp-carousel__tick";
      ticksHost.appendChild(tick);
      ticks.push(tick);
    }

    var lastIndex = -1;
    var announce = false;

    function currentIndex() {
      return Math.min(Math.round(track.scrollLeft / stepOf(track)), count - 1);
    }

    function update() {
      var maxScroll = track.scrollWidth - track.clientWidth;
      var index = currentIndex();
      controls.hidden = maxScroll <= 2;
      setDisabled(prev, track.scrollLeft <= 2);
      setDisabled(next, track.scrollLeft >= maxScroll - 2);
      if (index === lastIndex) return;
      lastIndex = index;
      ticks.forEach(function (item, position) {
        item.setAttribute("data-actif", position === index ? "true" : "false");
      });
    }

    function onScrollEnd() {
      update();
      if (!announce || !status) return;
      announce = false;
      status.textContent = "Position " + (currentIndex() + 1) + " sur " + count;
    }

    function move(button, direction) {
      if (button.getAttribute("aria-disabled") === "true") return;
      announce = true;
      track.scrollBy({ left: direction * stepOf(track), behavior: prefersReducedMotion() ? "auto" : "smooth" });
      // Navigateurs sans « scrollend » : annonce après la fin probable du défilement.
      if (!("onscrollend" in window)) window.setTimeout(onScrollEnd, 400);
    }

    function onPrev() {
      move(prev, -1);
    }
    function onNext() {
      move(next, 1);
    }

    prev.addEventListener("click", onPrev);
    next.addEventListener("click", onNext);
    track.addEventListener("scroll", update, { passive: true });
    track.addEventListener("scrollend", onScrollEnd);
    var observer = "ResizeObserver" in window ? new ResizeObserver(update) : null;
    if (observer) observer.observe(track);
    update();

    instances.set(root, {
      destroy: function () {
        if (observer) observer.disconnect();
        prev.removeEventListener("click", onPrev);
        next.removeEventListener("click", onNext);
        track.removeEventListener("scroll", update);
        track.removeEventListener("scrollend", onScrollEnd);
        instances.delete(root);
      },
    });
  }

  function within(event, callback) {
    var target = event.target instanceof Element ? event.target : null;
    if (target) target.querySelectorAll("[data-bp-carousel]").forEach(callback);
  }

  function init() {
    document.querySelectorAll("[data-bp-carousel]").forEach(setup);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Éditeur de thème : une section rechargée retrouve son carrousel, une section retirée le libère.
  document.addEventListener("shopify:section:load", function (event) {
    within(event, setup);
  });
  document.addEventListener("shopify:section:unload", function (event) {
    within(event, function (root) {
      var instance = instances.get(root);
      if (instance) instance.destroy();
    });
  });
})();
