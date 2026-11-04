/**
 * Page « Aide » : les gestes de tous les jours, écrits pas à pas, dans les mots de l'application.
 * Pensée pour quelqu'un qui n'est pas à l'aise avec l'informatique : une situation = un bloc,
 * des étapes numérotées courtes, et un bouton pour aller directement au bon endroit.
 */

import { entreGuillemets, TITRES } from "../../lib/titres";

interface Recipe {
  readonly situation: string;
  readonly steps: readonly string[];
  readonly href: string;
  readonly button: string;
}

const RECIPES: readonly Recipe[] = [
  {
    situation: "Un client m’appelle pour commander",
    steps: [
      "Touchez « Prendre une commande ».",
      "Écrivez le nom du client, puis touchez son nom dans la liste. Un nouveau client ? Touchez « Nouveau client ».",
      "Choisissez les vins : touchez « Ajouter un carton de 6 » pour chaque vin demandé. Pour deux cartons, touchez « + ».",
      "Choisissez le jour de livraison, puis touchez « Enregistrer la commande ».",
    ],
    href: "/app/commande",
    button: "Prendre une commande",
  },
  {
    situation: "J’ai livré une commande",
    steps: [
      `Touchez ${entreGuillemets(TITRES.livraisons)}.`,
      "Trouvez la commande, puis touchez le bouton foncé « J’ai livré la commande ».",
      "L’application vous demande de confirmer : touchez « Oui ». La facture se fait toute seule.",
    ],
    href: "/app",
    button: "Voir les livraisons",
  },
  {
    situation: "Envoyer une facture à un client",
    steps: [
      `Touchez ${entreGuillemets(TITRES.factures)}.`,
      "Trouvez la facture du client.",
      "Touchez « WhatsApp » ou « E-mail ». Le message est déjà écrit : relisez-le.",
      "Touchez le bouton d’envoi dans la fenêtre.",
    ],
    href: "/app/factures",
    button: "Voir les factures",
  },
  {
    situation: "Un client m’a payé",
    steps: [
      `Touchez ${entreGuillemets(TITRES.factures)}.`,
      "Sur la facture, touchez « Le client a payé ».",
      "Dites comment il a payé (virement, argent liquide ou TWINT). C’est terminé : la facture passe dans « Payées ».",
    ],
    href: "/app/factures",
    button: "Voir les factures",
  },
  {
    situation: "Je reçois de nouvelles bouteilles",
    steps: [
      `Touchez ${entreGuillemets(TITRES.vins)}.`,
      "Trouvez le vin, puis touchez « Ajouter des bouteilles ».",
      "Écrivez combien de bouteilles vous avez reçues, puis touchez le bouton pour enregistrer.",
    ],
    href: "/app/stock",
    button: "Voir les vins en cave",
  },
  {
    situation: "Je veux ajouter un nouveau vin à vendre",
    steps: [
      `Touchez ${entreGuillemets(TITRES.vins)}, puis « Nouveau vin ».`,
      "Remplissez le nom, le prix et le nombre de bouteilles.",
      "Touchez « Créer le vin ». Il apparaît tout de suite sur le site.",
    ],
    href: "/app/stock",
    button: "Voir les vins en cave",
  },
  {
    situation: "Un client n’est pas là le jour prévu",
    steps: [
      `Touchez ${entreGuillemets(TITRES.livraisons)}.`,
      "Sur la commande, touchez « Changer le jour ».",
      "Choisissez le nouveau jour, puis touchez « Valider ce jour ».",
    ],
    href: "/app",
    button: "Voir les livraisons",
  },
  {
    situation: "Un professionnel demande un compte",
    steps: [
      `Une bande bleue « demande de compte pro à valider » apparaît en haut de ${entreGuillemets(TITRES.livraisons)} et de ${entreGuillemets(TITRES.clients)}.`,
      "Touchez « Voir les demandes ».",
      "Touchez « Accepter » pour lui donner les prix pros, ou « Refuser ».",
    ],
    href: "/app/pros",
    button: "Voir les demandes",
  },
  {
    situation: "Retrouver une ancienne commande ou un client",
    steps: [
      `Touchez ${entreGuillemets(TITRES.commandes)} (ou ${entreGuillemets(TITRES.clients)}).`,
      "Écrivez un nom, une ville ou un numéro dans la case en haut, puis touchez « Chercher ».",
    ],
    href: "/app/commandes",
    button: "Voir toutes les commandes",
  },
  {
    situation: "Changer mon adresse ou mon compte en banque",
    steps: [
      `Touchez ${entreGuillemets(TITRES.entreprise)}.`,
      "Corrigez ce qui a changé, puis touchez « Enregistrer ».",
    ],
    href: "/app/reglages",
    button: "Voir les informations de l’entreprise",
  },
];

function RecipeBlock({ recipe }: { readonly recipe: Recipe }) {
  return (
    <s-section heading={recipe.situation}>
      <s-stack direction="block" gap="base">
        <s-stack direction="block" gap="small-200">
          {recipe.steps.map((step, index) => (
            <s-text key={step}>{`${index + 1}.\u2002${step}`}</s-text>
          ))}
        </s-stack>
        <s-stack direction="inline">
          <s-button href={recipe.href}>{recipe.button}</s-button>
        </s-stack>
      </s-stack>
    </s-section>
  );
}

export function AidePageView() {
  return (
    <s-page heading="Aide" inlineSize="base">
      <s-banner tone="info" heading="Vous êtes perdu(e) ?">
        <s-stack direction="block" gap="small-200">
          <s-text>Pas de panique : rien ne se fait sans que l’application vous demande de confirmer.</s-text>
          <s-text>{`Pour revenir au début, touchez ${entreGuillemets(TITRES.livraisons)} dans le menu.`}</s-text>
        </s-stack>
      </s-banner>
      <s-section>
        <s-stack direction="block" gap="small-200">
          <s-heading>Que voulez-vous faire ?</s-heading>
          <s-text>Choisissez ce qui vous arrive. Les étapes sont écrites juste en dessous.</s-text>
        </s-stack>
      </s-section>
      {RECIPES.map((recipe) => (
        <RecipeBlock key={recipe.situation} recipe={recipe} />
      ))}
      <s-section heading="Quelque chose ne marche pas ?">
        <s-stack direction="block" gap="small-200">
          <s-text>Un message en rouge ou en jaune s’affiche ? Lisez-le : il dit ce qu’il faut faire.</s-text>
          <s-text>
            S’il ne suffit pas, prenez l’écran en photo et envoyez-la à la personne qui s’occupe de votre application.
          </s-text>
        </s-stack>
      </s-section>
    </s-page>
  );
}
