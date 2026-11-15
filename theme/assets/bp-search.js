/**
 * BluePoint — barre de recherche des vins (snippets/bp-search-dialog.liquid), ouverte par « Chercher » dans l'en-tête
 * ou « Chercher un vin » dans le menu du téléphone.
 * - <dialog> natif : Échap referme (même depuis le champ), le focus reste dedans ; un clic sur le fond assombri referme aussi.
 * - Pendant la frappe (dès 2 lettres, après une courte pause), les suggestions viennent de Shopify
 *   (recherche prédictive, rendue par sections/bp-search-suggest.liquid) ; la demande précédente est annulée.
 * - Flèches haut et bas : du champ aux suggestions et entre elles. Entrée envoie vers la page des résultats.
 * - Si Shopify ne répond pas, un message le dit ; Entrée mène toujours à la page des résultats.
 */
(function () {
  "use strict";

  var MIN_LETTERS = 2;
  var PAUSE_MS = 180;
  var MAX_BOTTLES = 6;

  function setupSearch(scope) {
    var dialog = scope.querySelector("[data-bp-search]");
    if (!(dialog instanceof HTMLDialogElement) || dialog.hasAttribute("data-bp-ready")) return;
    dialog.setAttribute("data-bp-ready", "");

    var input = dialog.querySelector("[data-bp-search-input]");
    var results = dialog.querySelector("[data-bp-search-results]");
    var status = dialog.querySelector("[data-bp-search-status]");
    var openButtons = document.querySelectorAll("[data-bp-search-open]");
    if (!(input instanceof HTMLInputElement) || !results || !status) return;

    var suggestUrl = dialog.getAttribute("data-suggest-url") || "/search/suggest";
    var cache = new Map();
    var pending = null;
    var timer = 0;
    var returnTo = null;

    function setExpanded(isOpen) {
      openButtons.forEach(function (button) {
        button.setAttribute("aria-expanded", isOpen ? "true" : "false");
      });
    }

    function open(event) {
      if (dialog.open) return;
      // Depuis le menu du téléphone : le menu se ferme d'abord, sinon il rendrait le focus à « Menu » par-dessus la recherche.
      var trigger = event && event.currentTarget instanceof Element ? event.currentTarget : null;
      var host = trigger ? trigger.closest("dialog") : null;
      if (host && host.open) host.close();
      returnTo = host ? document.querySelector("[data-bp-menu-open]") : null;
      dialog.showModal();
      setExpanded(true);
      input.focus();
      input.select();
    }

    function clear() {
      results.replaceChildren();
      results.hidden = true;
      status.textContent = "";
    }

    function show(fragment, count) {
      results.replaceChildren(fragment.cloneNode(true));
      results.hidden = false;
      if (count === 0) status.textContent = "Aucun vin trouvé.";
      else if (count === 1) status.textContent = "1 vin trouvé. Flèche du bas pour le choisir.";
      else status.textContent = count + " vins trouvés. Flèche du bas pour les parcourir.";
    }

    function showError() {
      var message = document.createElement("p");
      message.className = "bp-search__none";
      message.textContent = "Les suggestions ne répondent pas. Appuyez sur Entrée pour voir les résultats.";
      results.replaceChildren(message);
      results.hidden = false;
      status.textContent = message.textContent;
    }

    function parse(html) {
      var page = new DOMParser().parseFromString(html, "text/html");
      var root = page.querySelector("[data-bp-search-count]");
      if (!root) return null;
      var fragment = document.createDocumentFragment();
      Array.prototype.slice.call(root.childNodes).forEach(function (node) {
        fragment.appendChild(document.importNode(node, true));
      });
      return { fragment: fragment, count: parseInt(root.getAttribute("data-bp-search-count"), 10) || 0 };
    }

    function suggest(terms) {
      var known = cache.get(terms);
      if (known) {
        show(known.fragment, known.count);
        return;
      }
      if (pending) pending.abort();
      pending = new AbortController();
      var params = new URLSearchParams({
        q: terms,
        "resources[type]": "product",
        "resources[limit]": String(MAX_BOTTLES),
        "resources[options][unavailable_products]": "last",
        section_id: "bp-search-suggest"
      });
      fetch(suggestUrl + "?" + params.toString(), { signal: pending.signal })
        .then(function (response) {
          if (!response.ok) throw new Error("HTTP " + response.status);
          return response.text();
        })
        .then(function (html) {
          var parsed = parse(html);
          if (!parsed) throw new Error("Réponse illisible");
          cache.set(terms, parsed);
          // Une réponse arrivée après une nouvelle frappe ne remplace pas la plus récente.
          if (input.value.trim() === terms) show(parsed.fragment, parsed.count);
        })
        .catch(function (error) {
          if (error && error.name === "AbortError") return;
          if (input.value.trim() === terms) showError();
        });
    }

    input.addEventListener("input", function () {
      window.clearTimeout(timer);
      var terms = input.value.trim();
      if (terms.length < MIN_LETTERS) {
        if (pending) pending.abort();
        clear();
        return;
      }
      timer = window.setTimeout(function () {
        suggest(terms);
      }, PAUSE_MS);
    });

    // Flèches : le champ, puis chaque suggestion, puis le lien vers tous les résultats.
    dialog.addEventListener("keydown", function (event) {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      var links = Array.prototype.slice.call(results.querySelectorAll("a"));
      if (results.hidden || links.length === 0) return;
      var stops = [input].concat(links);
      var index = stops.indexOf(document.activeElement);
      if (index === -1) return;
      event.preventDefault();
      var next = event.key === "ArrowDown" ? Math.min(index + 1, stops.length - 1) : Math.max(index - 1, 0);
      stops[next].focus();
    });

    openButtons.forEach(function (button) {
      button.addEventListener("click", open);
    });

    dialog.addEventListener("click", function (event) {
      var target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      // Le fond assombri (le dialogue lui-même, hors de son contenu) et « Fermer » referment.
      if (target === dialog || target.closest("[data-bp-search-close]")) dialog.close();
    });

    // Échap ferme tout de suite (sinon le champ de recherche se vide d'abord, et il faut appuyer deux fois).
    input.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      dialog.close();
    });

    dialog.addEventListener("close", function () {
      setExpanded(false);
      // Ouverte depuis le menu (fermé entre-temps) : le focus revient sur « Menu », pas en haut de la page.
      if (returnTo instanceof HTMLElement) returnTo.focus();
      returnTo = null;
    });
  }

  function init() {
    setupSearch(document);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Éditeur de thème : l'en-tête rechargé doit retrouver sa recherche.
  document.addEventListener("shopify:section:load", function (event) {
    if (event.target instanceof Element) setupSearch(event.target);
  });
})();
