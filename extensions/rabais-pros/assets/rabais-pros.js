/* Bandeau « Rabais paiement rapide » : le bouton « × » le masque pour la suite de la visite. */
(function () {
  var CLE = "bp-rabais-ferme";

  function lire() {
    try {
      return window.sessionStorage.getItem(CLE) === "1";
    } catch (erreur) {
      return false;
    }
  }

  function noter() {
    try {
      window.sessionStorage.setItem(CLE, "1");
    } catch (erreur) {
      /* Navigation privée : le bandeau reviendra à la prochaine page, sans gravité. */
    }
  }

  function demarrer() {
    var bandeau = document.querySelector("[data-bp-rabais]");
    if (!bandeau) return;
    if (lire()) {
      bandeau.hidden = true;
      return;
    }
    var fermer = bandeau.querySelector("[data-bp-rabais-fermer]");
    if (!fermer) return;
    fermer.addEventListener("click", function () {
      bandeau.hidden = true;
      noter();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", demarrer);
  else demarrer();
})();
