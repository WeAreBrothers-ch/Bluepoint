/**
 * BluePoint — bloc « Livraison » du panier (snippets/bp-cart-delivery.liquid).
 * - Date minimale : aujourd’hui à Zurich + N jours ouvrables (samedi et dimanche sautés).
 * - Envoi par la Poste : pas de date, le champ disparaît et l’attribut est vidé.
 * - Chaque changement est enregistré dans les attributs du panier (/cart/update.js), après une courte pause.
 * - Une date trop proche affiche une erreur et n’est pas enregistrée.
 * Sans script, les champs partent simplement avec le formulaire « Commander ».
 */
(function () {
  "use strict";

  var ROOT = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || "/";
  var MODE_KEY = "Mode de livraison";
  var DATE_KEY = "Date de livraison souhaitée";
  var DELAY = 400;
  var UNAVAILABLE = "Le choix de livraison n’a pas pu être enregistré. Réessayez dans un instant.";
  var timer = null;
  var chosen = null; // Dernier choix du client, réappliqué si le panier est redessiné avant l’enregistrement.

  function pad(value) {
    return (value < 10 ? "0" : "") + value;
  }

  /* Date du jour à Zurich, quelle que soit l’heure de l’appareil. */
  function todayInZurich() {
    try {
      var parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Zurich",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(new Date());
      var get = function (type) {
        return Number(parts.filter(function (part) { return part.type === type; })[0].value);
      };
      return new Date(Date.UTC(get("year"), get("month") - 1, get("day")));
    } catch (error) {
      var now = new Date();
      return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    }
  }

  function addWorkingDays(date, count) {
    var result = new Date(date.getTime());
    var added = 0;
    while (added < count) {
      result.setUTCDate(result.getUTCDate() + 1);
      var day = result.getUTCDay();
      if (day !== 0 && day !== 6) added += 1;
    }
    return result;
  }

  function toIso(date) {
    return date.getUTCFullYear() + "-" + pad(date.getUTCMonth() + 1) + "-" + pad(date.getUTCDate());
  }

  function toSwiss(iso) {
    var bits = iso.split("-");
    return bits[2] + "." + bits[1] + "." + bits[0];
  }

  function parts(block) {
    return {
      modes: block.querySelectorAll("[data-bp-livraison-mode]"),
      field: block.querySelector("[data-bp-livraison-date-field]"),
      date: block.querySelector("[data-bp-livraison-date]"),
      hint: block.querySelector("[data-bp-livraison-hint]"),
      error: block.querySelector("[data-bp-livraison-error]"),
    };
  }

  function currentMode(el) {
    var checked = Array.prototype.filter.call(el.modes, function (input) { return input.checked; })[0];
    return checked ? checked.value : "";
  }

  function setError(el, text) {
    if (!el.error || !el.date) return;
    el.error.textContent = text;
    el.error.hidden = !text;
    if (text) el.date.setAttribute("aria-invalid", "true");
    else el.date.removeAttribute("aria-invalid");
  }

  /* Valide la date ; renvoie false (et affiche l’erreur) si elle est avant la date minimale. */
  function validate(el) {
    if (!el.date || el.date.disabled || !el.date.value) {
      setError(el, "");
      return true;
    }
    if (el.date.value < el.date.min) {
      setError(el, "Cette date est trop proche. Choisissez le " + toSwiss(el.date.min) + " ou plus tard.");
      return false;
    }
    setError(el, "");
    return true;
  }

  /* La Poste expédie sans date : le champ est masqué et désactivé (il ne part pas avec le formulaire). */
  function syncDateField(el) {
    if (!el.field || !el.date) return;
    var isPost = currentMode(el) === "poste";
    el.field.hidden = isPost;
    el.date.disabled = isPost;
    if (isPost) {
      el.date.value = "";
      setError(el, "");
    }
  }

  /* Erreur réseau : affichée dans le bandeau d’erreur du panier (toujours visible, même sans champ date). */
  function showCartError(block) {
    var cart = block.closest("[data-bp-cart]");
    var error = cart ? cart.querySelector("[data-bp-cart-error]") : null;
    if (!error) return;
    error.textContent = UNAVAILABLE;
    error.hidden = false;
  }

  function save(block) {
    var el = parts(block);
    if (!validate(el)) return;
    var mode = currentMode(el);
    var attributes = {};
    attributes[MODE_KEY] = mode;
    attributes[DATE_KEY] = mode === "poste" || !el.date ? "" : el.date.value;

    fetch(ROOT + "cart/update.js", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ attributes: attributes }),
    })
      .then(function (response) {
        if (!response.ok) throw new Error(UNAVAILABLE);
        if (chosen && chosen.mode === mode && chosen.date === attributes[DATE_KEY]) chosen = null;
      })
      .catch(function () {
        showCartError(block);
      });
  }

  function schedule(block) {
    var el = parts(block);
    chosen = { mode: currentMode(el), date: el.date && !el.date.disabled ? el.date.value : "" };
    window.clearTimeout(timer);
    timer = window.setTimeout(function () {
      save(block);
    }, DELAY);
  }

  function init(block) {
    var el = parts(block);
    if (chosen) {
      Array.prototype.forEach.call(el.modes, function (input) { input.checked = input.value === chosen.mode; });
      if (el.date) el.date.value = chosen.date;
    }
    if (el.date) {
      var min = toIso(addWorkingDays(todayInZurich(), Number(block.getAttribute("data-lead-days")) || 0));
      el.date.min = min;
      if (el.hint) el.hint.textContent = "Au plus tôt le " + toSwiss(min);
    }
    syncDateField(el);
    validate(el);
  }

  function initAll() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-bp-livraison]"), init);
  }

  document.addEventListener("change", function (event) {
    var target = event.target instanceof Element ? event.target : null;
    var block = target ? target.closest("[data-bp-livraison]") : null;
    if (!block) return;
    var el = parts(block);
    if (target.hasAttribute("data-bp-livraison-mode")) syncDateField(el);
    validate(el);
    schedule(block);
  });

  /* Le panier est redessiné après chaque −/+ (assets/bp-cart-page.js) : on réinitialise le bloc. */
  document.addEventListener("bp:cart-rendered", initAll);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initAll);
  else initAll();
})();
