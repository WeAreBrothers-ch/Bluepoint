/**
 * BluePoint — page panier : −/+ et « Retirer » instantanés.
 * Intercepte les petits formulaires POST /cart/change (repérés par la clé de ligne, item.key),
 * passe par /cart/change.js et récupère le HTML à jour de la section dans la même réponse
 * (Section Rendering API). Sans script, les formulaires suffisent.
 */
(function () {
  "use strict";

  var ROOT = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || "/";
  var UNAVAILABLE = "Le panier ne répond pas. Réessayez dans un instant.";
  var NNBSP = " "; // espace fine insécable, avant les deux-points

  function readJson(response) {
    if (window.BluePointCart && window.BluePointCart.readJson) return window.BluePointCart.readJson(response);
    return response.json().then(function (body) {
      if (!response.ok) throw new Error(UNAVAILABLE);
      return body;
    });
  }

  function replaceSection(sectionId, html) {
    var container = document.getElementById("shopify-section-" + sectionId);
    if (!container || !html) return false;
    var parsed = new DOMParser().parseFromString(html, "text/html");
    var fresh = parsed.getElementById("shopify-section-" + sectionId);
    if (!fresh) return false;
    var express = container.querySelector("[data-bp-cart-express]");
    container.innerHTML = fresh.innerHTML;
    keepExpressButtons(container, express);
    return true;
  }

  /* Les boutons de paiement express sont dessinés par le script de Shopify au chargement :
     on remet les anciens (déjà prêts) à la place des nouveaux, encore vides. Panier vidé : plus rien. */
  function keepExpressButtons(container, express) {
    var slot = container.querySelector("[data-bp-cart-express]");
    if (express && slot) slot.replaceWith(express);
  }

  /* Après le remplacement du HTML, le focus clavier revient sur le même bouton (ou sur le titre). */
  function restoreFocus(index) {
    var buttons = document.querySelectorAll("[data-bp-cart-step]");
    var target = buttons[index] || document.querySelector(".bp-cart__title");
    if (!target) return;
    if (!(target instanceof HTMLButtonElement)) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  }

  function message(name, quantity) {
    if (quantity === 0) return name + " retiré du panier.";
    return name + NNBSP + ": " + quantity + " bouteille" + (quantity > 1 ? "s" : "") + ".";
  }

  function showError(cart, text) {
    var error = cart.querySelector("[data-bp-cart-error]");
    if (!error) return;
    error.textContent = text;
    error.hidden = false;
  }

  function change(form, button) {
    var cart = form.closest("[data-bp-cart]");
    if (!cart || cart.getAttribute("aria-busy") === "true") return;
    var focusIndex = Array.prototype.indexOf.call(document.querySelectorAll("[data-bp-cart-step]"), button);
    var sectionId = cart.getAttribute("data-section-id");
    var idInput = form.querySelector('input[name="id"]');
    var quantity = Number(button.value);
    var name = form.getAttribute("data-name") || "La bouteille";
    cart.setAttribute("aria-busy", "true");

    fetch(ROOT + "cart/change.js", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        id: idInput ? idInput.value : "",
        quantity: quantity,
        sections: sectionId,
        sections_url: window.location.pathname,
      }),
    })
      .then(readJson, function () {
        throw new Error(UNAVAILABLE);
      })
      .then(function (body) {
        if (window.BluePointCart) window.BluePointCart.notify(body.item_count);
        if (!replaceSection(sectionId, body.sections && body.sections[sectionId])) {
          window.location.reload();
          return;
        }
        document.dispatchEvent(new CustomEvent("bp:cart-rendered"));
        restoreFocus(focusIndex);
        if (window.BluePointCart && window.BluePointCart.announce) {
          window.BluePointCart.announce(message(name, quantity));
        }
      })
      .catch(function (error) {
        cart.removeAttribute("aria-busy");
        showError(cart, (error && error.message) || UNAVAILABLE);
      });
  }

  document.addEventListener("submit", function (event) {
    var form = event.target instanceof Element ? event.target.closest("[data-bp-cart-change]") : null;
    if (!form) return;
    event.preventDefault();
    var button = event.submitter instanceof HTMLButtonElement ? event.submitter : form.querySelector("button");
    if (button) change(form, button);
  });
})();
