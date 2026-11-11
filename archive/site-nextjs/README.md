# BluePoint Distribution — page d'accueil

Refonte du site (vente directe aux particuliers) : page d'accueil, fiches bouteilles, panier.
Next.js 16 + TypeScript. Direction artistique : `DIRECTION-ARTISTIQUE.md` (v2, inspirée de NON).

## Voir le site en local

```bash
npm install      # la première fois seulement
npm run dev      # puis ouvrir http://localhost:3000
```

La vérification d'âge s'affiche à la première visite. La réponse est mémorisée 30 jours
dans le navigateur. Pour la revoir : navigation privée, ou effacer les données du site.

## Où modifier quoi

| Je veux changer…                         | Fichier                          |
| ---------------------------------------- | -------------------------------- |
| Une bouteille (prix, textes, accords, aplat) | `src/data/bouteilles/<nom>.ts` |
| L'ordre des bouteilles                   | `src/data/bottles.ts`            |
| Les bouteilles du hero, les tuiles d'accords | `src/data/home.ts`           |
| Les formats proposés (1, 3, 6, 12)       | `src/lib/packs.ts`               |
| Adresse, téléphone, réseaux              | `src/data/contact.ts`            |
| Les couleurs, polices, espacements       | `src/styles/tokens.css`          |
| La direction artistique (référence)      | `DIRECTION-ARTISTIQUE.md`        |

Les photos de bouteilles sont détourées (fond transparent) dans `public/assets/bouteilles-detourees/`.
Pour en ajouter une : même format (bouteille seule, fond transparent, ~1400 px de haut),
puis un fichier dans `src/data/bouteilles/` (sur le modèle des autres) avec sa largeur et sa
hauteur exactes, et une ligne dans `bottles.ts`.

## Boutique

Pas de paiement en ligne pour l'instant. Le panier est réel mais local : il est mémorisé dans
le navigateur du visiteur, puis « Envoyer ma commande » ouvre un e-mail prérempli pour Paolo.
Pour brancher Shopify ou Stripe plus tard : `src/lib/catalog.ts` (catalogue) et
`src/lib/cart/` (panier) sont les seuls fichiers à remplacer, les composants ne changent pas.

## Vérifications avant mise en ligne

```bash
npm run lint
npm run build
```

Si le serveur de développement tourne, vérifier le build dans un dossier séparé :
`NEXT_DIST_DIR=.next-verif npm run build`, puis supprimer `.next-verif`.
