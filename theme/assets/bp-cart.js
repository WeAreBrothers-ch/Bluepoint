/**
 * BluePoint — panier Shopify (API Ajax du panier).
 * Point d’accès unique pour ajouter une bouteille et tenir à jour le bouton panier.
 * Expose window.BluePointCart :
 *   add(variantId, quantity) → Promise<{ itemCount }>
 *   refresh() → Promise<cart>, notify(itemCount), announce(text), readJson(response)
 * Émet « bp:cart-updated » (detail.itemCount) après chaque changement,
 * et « bp:cart-added » après chaque ajout réussi (Paolo surgit : bp-mascotte.js).
 */
(function () {
  "use strict";

  var ROOT = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || "/";
  var UNAVAILABLE = "Le panier ne répond pas. Réessayez dans un instant.";
  var CONFIRMATION_MS = 1600;
  var NNBSP = " "; // espace fine insécable, avant les deux-points

  /* Réponse de Shopify → objet, ou erreur en français (jamais un message technique). */
  function readJson(response) {
    return response
      .json()
      .catch(function () {
        return null;
      })
      .then(function (body) {
        if (response.ok && body) return body;
        var message = body && (body.description || body.message);
        throw new Error(typeof message === "string" && message ? message : UNAVAILABLE);
      });
  }

  /* Coupure réseau : même message que pour une réponse illisible. */
  function request(url, options) {
    return fetch(url, options).then(readJson, function () {
      throw new Error(UNAVAILABLE);
    });
  }

  function fetchCart() {
    return request(ROOT + "cart.js", { headers: { Accept: "application/json" } });
  }

  /* Zone d’annonce permanente (layout) : vidée puis remplie pour que le texte soit relu. */
  function announce(text) {
    var live = document.querySelector("[data-bp-live]");
    if (!live) return;
    live.textContent = "";
    window.requestAnimationFrame(function () {
      live.textContent = text;
    });
  }

  function label(count) {
    if (count === 0) return "Panier, vide";
    return "Panier, " + count + " bouteille" + (count > 1 ? "s" : "");
  }

  function renderCount(itemCount, changed) {
    document.querySelectorAll("[data-bp-floating-cart]").forEach(function (link) {
      link.setAttribute("data-actif", itemCount > 0 ? "true" : "false");
      link.setAttribute("aria-label", label(itemCount));
      var count = link.querySelector("[data-bp-cart-count]");
      if (!count) return;
      // Un nœud neuf marqué data-maj rejoue le bref fondu du compteur.
      var fresh = count.cloneNode(false);
      fresh.textContent = String(itemCount);
      if (changed) fresh.setAttribute("data-maj", "");
      count.replaceWith(fresh);
    });
  }

  function notify(itemCount) {
    renderCount(itemCount, true);
    document.dispatchEvent(new CustomEvent("bp:cart-updated", { detail: { itemCount: itemCount } }));
    return { itemCount: itemCount };
  }

  function add(variantId, quantity) {
    var id = Number(variantId);
    var qty = Math.max(1, Math.round(Number(quantity) || 1));
    if (!id) return Promise.reject(new Error("Bouteille introuvable."));
    return request(ROOT + "cart/add.js", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ items: [{ id: id, quantity: qty }] }),
    })
      .then(fetchCart)
      .then(function (cart) {
        document.dispatchEvent(new CustomEvent("bp:cart-added", { detail: { quantity: qty } }));
        return notify(cart.item_count);
      });
  }

  /* ---------- Bouton « + » des cartes bouteille : ajoute une bouteille sans quitter la page ---------- */

  var timers = new WeakMap();

  function showQuickAddError(meta, message) {
    var error = meta && meta.querySelector("[data-bp-quick-add-error]");
    if (!error) return;
    error.textContent = message;
    error.hidden = false;
  }

  function hideQuickAddError(meta) {
    var error = meta && meta.querySelector("[data-bp-quick-add-error]");
    if (!error) return;
    error.hidden = true;
    error.textContent = "";
  }

  function onQuickAdd(button) {
    var meta = button.parentElement;
    var status = meta && meta.querySelector("[data-bp-quick-add-status]");
    var name = button.getAttribute("data-product-name") || "Bouteille";
    button.disabled = true;
    add(button.getAttribute("data-variant-id"), 1)
      .then(function () {
        hideQuickAddError(meta);
        button.setAttribute("data-ajoute", "true");
        if (status) status.textContent = name + NNBSP + ": ajouté au panier.";
        window.clearTimeout(timers.get(button));
        timers.set(
          button,
          window.setTimeout(function () {
            button.setAttribute("data-ajoute", "false");
            if (status) status.textContent = "";
          }, CONFIRMATION_MS)
        );
      })
      .catch(function (error) {
        button.setAttribute("data-ajoute", "false");
        showQuickAddError(meta, error.message);
      })
      .finally(function () {
        button.disabled = false;
      });
  }

  document.addEventListener("click", function (event) {
    var target = event.target instanceof Element ? event.target.closest("[data-bp-quick-add]") : null;
    if (target) onQuickAdd(target);
  });

  // Page restaurée depuis le cache du navigateur (bouton retour) : le nombre peut être périmé.
  window.addEventListener("pageshow", function (event) {
    if (!event.persisted) return;
    fetchCart()
      .then(function (cart) {
        renderCount(cart.item_count, false);
      })
      .catch(function () {
        // Sans réseau, on garde le nombre affiché : il sera juste au prochain chargement.
      });
  });

  window.BluePointCart = {
    add: add,
    refresh: fetchCart,
    notify: notify,
    announce: announce,
    readJson: readJson,
  };
})();
