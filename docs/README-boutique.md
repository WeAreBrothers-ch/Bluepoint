# BluePoint Distribution

Boutique en ligne de BluePoint (vente directe aux particuliers et aux pros), sur Shopify.
Direction artistique : `docs/DIRECTION-ARTISTIQUE.md`. Public et objectifs : `docs/PRODUCT.md`.

> Reprise depuis l'ancien dépôt `bluepoint2.0` (branche `app-depuis-wab`). L'app de gestion est ici à la racine du dépôt
> (et non plus dans `admin-app/`) ; le thème est dans `theme/`.

## Ce que contient ce dossier

| Dossier       | Rôle                                                                 |
| ------------- | -------------------------------------------------------------------- |
| `theme/`      | Le thème Shopify de la boutique (Liquid, CSS, JS).                   |
| `app/` et le reste de la racine | L'app de gestion intégrée à l'admin Shopify (voir le `README.md` du dépôt). |
| `references/` | Inspirations, photos du site précédent, photos et logos de la marque. |

## Voir le thème

Thème brouillon (la boutique publique ne change pas) :
https://5s71g8-0v.myshopify.com?preview_theme_id=192329253188

Les couleurs, polices et espacements du thème sont dans `theme/assets/bp-base.css`.

## Images

`references/images/` garde les photos d'ambiance, les bouteilles détourées et les logos.
Les photos des produits de la boutique se gèrent dans l'admin Shopify (fiche de chaque produit).

## Ranger une bouteille (menu par type et par région)

Le menu du site et les pastilles de la boutique se construisent tout seuls à partir des produits.
Pour qu'une nouvelle bouteille arrive dans le bon rayon, dans l'admin Shopify (fiche produit) :

| Champ | Ce qu'on écrit | Exemple |
|---|---|---|
| Type de produit | Rouge, Blanc, Rosé, Orange, Effervescent ou Spiritueux | `Rouge` |
| Étiquette du type | le type en minuscules | `rouge` |
| Étiquette du pays | `pays:` puis le pays | `pays:Italie` |
| Étiquette de la région | `region:` puis la région (facultatif) | `region:Piémont` |
| Contenance de la bouteille (en cl) | `contenance:` puis le nombre de cl | `contenance:75` (`contenance:37.5` pour une demi) |
| Année (facultatif) | `millesime:` puis l’année | `millesime:2022` |
| Appellation (facultatif) | `appellation:` puis l’appellation (`appellation:Champagne` pour le champagne) | `appellation:Dézaley AOC` |

Ces trois étiquettes servent à compter les litres vendus (page « Litres vendus » de l’app de gestion). « Nouveau vin » dans l’app les écrit tout seul.
- Le rayon « Rouges » apparaît dès qu'une bouteille de type Rouge existe, et disparaît s'il n'y en a plus.
- Adresses des rayons : `/collections/all/rouge`, `/collections/all/region-piemont`, `/collections/all/rouge+pays-italie`.
- Limite actuelle : les rayons sont calculés sur les 50 premières bouteilles de la boutique.
