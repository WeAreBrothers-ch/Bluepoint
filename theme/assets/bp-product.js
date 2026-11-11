/**
 * BluePoint — fiche bouteille.
 * - Le prix affiché suit le format choisi (1, 3, 6 ou 12 bouteilles).
 * - L'ajout passe par window.BluePointCart (assets/bp-cart.js) sans quitter la page ;
 *   sans script, le formulaire Shopify ajoute au panier normalement.
 * - Quand le bouton principal est passé au-dessus de l'écran, la barre d'achat fixe prend le relais.
 */
(function () {
  "use strict";

  var CONFIRMATION_MS = 2600;
  var BAR_ERROR_MS = 4000;

  function plural(count, word) {
    return count + " " + word + (count > 1 ? "s" : "");
  }

  function setAdded(buttons, added) {
    buttons.forEach(function (button) {
      button.setAttribute("data-actif", added ? "true" : "false");
      var text = button.querySelector("[data-bp-add-text]");
      if (text) text.textContent = text.getAttribute(added ? "data-done" : "data-idle");
    });
  }

  function setBusy(buttons, busy) {
    buttons.forEach(function (button) {
      button.disabled = busy;
      button.setAttribute("aria-busy", busy ? "true" : "false");
    });
  }

  function showAdded(status, quantity) {
    if (!status) return;
    status.removeAttribute("data-etat");
    status.textContent = plural(quantity, "bouteille") + " " + (quantity > 1 ? "ajoutées" : "ajoutée") + ". ";
    var link = document.createElement("a");
    link.href = status.getAttribute("data-cart-url") || "/cart";
    link.className = "bp-buy-box__status-link";
    link.textContent = "Voir le panier";
    status.appendChild(link);
  }

  function showError(status, message) {
    if (!status) return;
    status.setAttribute("data-etat", "erreur");
    status.textContent = message;
  }

  function clearStatus(status) {
    if (!status) return;
    status.removeAttribute("data-etat");
    status.textContent = "";
  }

  /* Erreur venue de la barre fixe : le message s'affiche dans la barre, à la place du nom. */
  function showBarError(root, message) {
    var title = root.querySelector("[data-bp-bar-title]");
    if (!title) return;
    var original = title.getAttribute("data-nom") || title.textContent;
    title.setAttribute("data-nom", original);
    title.setAttribute("data-etat", "erreur");
    title.textContent = message;
    window.clearTimeout(title._bpTimer);
    title._bpTimer = window.setTimeout(function () {
      title.textContent = original;
      title.removeAttribute("data-etat");
    }, BAR_ERROR_MS);
  }

  function setupPrice(root, form) {
    var prices = root.querySelectorAll("[data-bp-pack-price]");
    form.addEventListener("change", function (event) {
      var input = event.target;
      if (!(input instanceof HTMLInputElement) || input.name !== "quantity") return;
      var price = input.getAttribute("data-price") || "";
      prices.forEach(function (node) {
        node.textContent = price;
      });
    });
  }

  function setupSubmit(root, form) {
    var buttons = Array.prototype.slice.call(root.querySelectorAll("[data-bp-add-button]"));
    var status = root.querySelector("[data-bp-buy-status]");
    var timer = 0;

    form.addEventListener("submit", function (event) {
      if (!window.BluePointCart) return; // Pas de script panier : envoi classique du formulaire.
      event.preventDefault();
      var submitter = event.submitter instanceof Element ? event.submitter : null;
      var fromBar = !!(submitter && submitter.closest("[data-bp-buy-bar]"));
      var data = new FormData(form);
      var quantity = Number(data.get("quantity")) || 1;

      window.clearTimeout(timer);
      clearStatus(status);
      setBusy(buttons, true);
      window.BluePointCart.add(data.get("id"), quantity)
        .then(function () {
          setAdded(buttons, true);
          showAdded(status, quantity);
          // Le bouton redevient « Ajouter », mais la phrase de confirmation et le lien « Voir le panier »
          // restent affichés jusqu'au prochain ajout : on ne la fait pas disparaître sous les yeux de l'acheteur.
          timer = window.setTimeout(function () {
            setAdded(buttons, false);
          }, CONFIRMATION_MS);
        })
        .catch(function (error) {
          var message = (error && error.message) || "Ajout impossible pour le moment. Réessayez.";
          showError(status, message);
          if (fromBar) showBarError(root, message);
        })
        .finally(function () {
          setBusy(buttons, false);
        });
    });
  }

  function setupBar(root) {
    var bar = root.querySelector("[data-bp-buy-bar]");
    var mainButton = root.querySelector("[data-bp-main-add]");
    if (!bar || !mainButton || typeof IntersectionObserver === "undefined") return;

    var observer = new IntersectionObserver(function (entries) {
      var entry = entries[0];
      // Visible seulement quand le bouton principal est passé au-dessus de l'écran.
      var visible = !!entry && !entry.isIntersecting && entry.boundingClientRect.top < 0;
      if (!visible && bar.contains(document.activeElement)) mainButton.focus({ preventScroll: true });
      bar.setAttribute("data-visible", visible ? "true" : "false");
      bar.setAttribute("data-barre-achat", visible ? "visible" : "masquee");
      bar.setAttribute("aria-hidden", visible ? "false" : "true");
      bar.inert = !visible;
    });
    observer.observe(mainButton);
  }

  function init(scope) {
    var context = scope && scope.querySelectorAll ? scope : document;
    context.querySelectorAll("[data-bp-product]").forEach(function (root) {
      if (root.hasAttribute("data-bp-ready")) return;
      var form = root.querySelector("[data-bp-buy-form]");
      if (!form) return;
      root.setAttribute("data-bp-ready", "");
      setupPrice(root, form);
      setupSubmit(root, form);
      setupBar(root);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      init(document);
    });
  } else {
    init(document);
  }

  // Éditeur de thème : une section rechargée retrouve son comportement.
  document.addEventListener("shopify:section:load", function (event) {
    init(event.target);
  });
})();
