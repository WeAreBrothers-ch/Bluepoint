# Direction artistique — BluePoint Distribution (v4, esprit No Art)

> **v4 (13/10/2026, en vigueur) — remplace les sections 3 à 7 ci-dessous.** Refonte inspirée de
> No Art (noartmusic.com) à la demande de l'agence : une seule police à chasse fixe (Geist Mono) en
> capitales, petits carrés devant les intitulés (bleu = actif), repères de cadrage aux coins de l'écran,
> en-tête en mode « différence » sur grand écran, tuiles bouteilles sur fond clair, carrousel PRÉC./SUIV.,
> pied de page en tableau avec titres entre crochets, bouton panier fixe en bas à droite.
> Les valeurs font foi dans `src/styles/tokens.css` et `src/styles/primitives.css`.

> Règle du jeu pour le design et le développement. Version 3 du 25/09/2026.
> **v3 (remplacée par la v4)** : épure demandée par le client d'après une capture de l'accueil NON
> (`references/non-accueil.png`). Blanc pur, bouteilles détourées sur blanc sans aplat, une sans-serif
> régulière en casse normale, bleu en touches seulement. Là où la suite du document décrit la v2
> (aplats par bouteille, capitales grasses, hero bleu), **les sections 3 à 6 ci-dessous font foi**.
> Référence principale : **NON** (non.world), qui remplace JNPR (version 1, rejetée par le client).
> Les valeurs vivent dans `src/styles/tokens.css` : ce document explique, le fichier fait foi.

---

## 0. Ce qui a changé et pourquoi

La v1 (« Rive bleue » : fond pierre, serif, ombres longues) a été rejetée : trop éditoriale, pas assez
« boutique ». La v2 adopte la **grammaire de NON** : une boutique franche, où la bouteille et l'achat
passent avant le récit. Ce qu'on garde de BluePoint : le **bleu du logo**, le **vrai logo vectoriel**,
les **vraies bouteilles** et les **vraies données** (noms, prix CHF, contact).

Alertes toujours valables : catalogue à ~90 % de vin (le brief parlait de spiritueux) ; photos
bouteilles hétérogènes, détourées automatiquement en attendant un shooting.

## 1. Ce qu'on reprend de NON (la méthode, jamais les textes ni les visuels)

Analyse faite le 25/09/2026 via l'outil de lecture web : l'accès réseau direct étant bloqué, la feuille de style de
NON n'a pas pu être lue, donc les observations visuelles viennent des images produit et de la structure des pages.

| Chez NON | Chez BluePoint |
|---|---|
| Fond blanc, bouteille seule, photo nette sans mise en scène | Fond blanc ; bouteille détourée seule sur un **aplat de couleur** |
| Capitales sans-serif franches pour les noms et les titres | **Archivo** en capitales grasses, légèrement élargies (largeur 108) |
| Bandeau haut « livraison offerte dès… » | « Livraison sous 48 h en Suisse · Offerte dès 24 bouteilles » (promesse réelle) |
| Nav courte, panier avec compteur | Bouteilles · Accords · La maison, panier avec compteur réel |
| Fiche : galerie à gauche, colonne d'achat à droite | Idem ; galerie = aplat bouteille + fiche d'identité sur bleu |
| Sélecteur de taille : bouteille / 6 / 12 | Format : 1 bouteille / carton de 3 / 6 / 12, **prix = unitaire × quantité**, aucune remise inventée |
| Bouton d'ajout, barre d'achat qui reste visible | Bouton principal + barre fixe en bas dès qu'il sort de l'écran |
| Blocs dépliables : Contains, About, Profile, Ingredients, Storage | Dégustation, Le domaine, Service, Conservation, Livraison |
| « Starter to dessert » : trois temps du repas | « De l'apéritif au dessert » : trois accords par bouteille |
| Accueil : la gamme en rangée, tuiles « made for starters / mains / dessert » | « Les bouteilles » en rangée ; « À chaque moment de la table » en trois tuiles |
| Ton : phrases courtes, concrètes, orientées table | Idem, en français, au nom de Paolo |

Non repris : chatbot sommelier, loterie, logos de restaurants (pas de preuve équivalente chez BluePoint),
promotions « mix & match » (commercialement inexistantes).

## 2. Le bleu signature — mesure

| Source | Méthode | Valeur |
|---|---|---|
| `https://bluepointdistribution.com/svg/logo.svg` | Lecture du code source du SVG (viewBox 0 0 1886 422, 40 tracés, **un seul** `<g fill="#1a70b7">`), confirmée par deux lectures indépendantes | **`#1A70B7`** = rgb(26, 112, 183) |
| `https://bluepointdistribution.com/favicon.ico` (48×48) | Fichier téléchargé puis histogramme des pixels avec ImageMagick : couleur dominante sur 1 903 des 2 304 pixels | `#2471B5` = rgb(36, 113, 181) |
| `https://bluepointdistribution.com/img/logo-footer.png` (207×252) | Histogramme ImageMagick | Blanc pur `#FFFFFF` sur fond transparent (version inversée du logo, sans bleu) |

**Décision : le bleu signature officiel est `#1A70B7`.** C'est la valeur vectorielle de référence du logo. L'écart du favicon (`#2471B5`, soit ΔR +10) vient de la compression ou de la conversion de l'icône. Il ne doit pas être utilisé.

---

## 3. Palette (v3)

| Jeton | Hex | Rôle |
|---|---|---|
| `--c-blanc` | `#FFFFFF` | Fond de toutes les pages, derrière toutes les bouteilles |
| `--c-craie` | `#F4F4F1` | Emplacement photo provisoire uniquement |
| `--c-encre` | `#11161C` | Texte, boutons d'achat (fond encre, texte blanc) |
| `--c-gris` | `#565E66` | Prix, texte secondaire (6,59:1 sur blanc) |
| `--c-filet` | `#D9D9D4` | Filets fins entre les niveaux d'en-tête et les blocs |
| `--c-bleu` | `#1A70B7` | **Touches seulement** : bandeau défilant, survol des liens, pastille du panier |

Aucun aplat de couleur, aucune ombre, aucun coin arrondi (sauf la pastille du panier).
Logo complet : bleu sur la vérification d'âge, encre dans le pied de page.

## 4. Typographie (v3)

Une seule famille, **Archivo**, en **graisse régulière** et **casse normale** pour les titres
(« La sélection », « À chaque moment de la table »), taille moyenne (28–40 px).
Capitales réservées au bandeau, au mot-symbole BLUEPOINT (graisse 300) et à la navigation.
Noms et prix des bouteilles : texte courant 16 px, alignés à gauche sous la bouteille, sans bouton.

## 5. Mise en page (v3)

- En-tête sur trois niveaux séparés par des filets : bandeau défilant bleu ; BLUEPOINT à gauche,
  « Suisse (CHF) » et panier (icône au trait) à droite ; navigation centrée
  (Accueil, Boutique, À propos, Accords, Contact).
- Accueil : « La sélection » + lien souligné « Toutes les bouteilles », toutes les bouteilles sur
  une rangée (6 colonnes au maximum, 2 sur mobile), puis triptyque photo bord à bord, accords, maison.
- Bouteilles : toutes à la même hauteur, sur la même ligne de base, directement sur le blanc.
- Fiche : grande bouteille sur blanc à gauche ; à droite nom, prix, format, bouton encre,
  caractéristiques et blocs dépliables séparés par des filets fins.

## 6. Mouvement (v3)

Défilement lent du bandeau (arrêté si mouvement réduit), barre d'achat fixe qui glisse depuis le bas,
couleur bleue au survol des liens, plus/moins des blocs dépliables. Rien d'autre.

## 7. Interdits

Dégradés, aplats colorés, cartes, ombres, capitales grasses, emojis, textes/visuels/logo de NON,
remises ou avis inventés, faux paiement.

## 8. Contenu réel récupéré (site actuel, 25/09/2026)

**Identité**
- Raison sociale : **Blue Point Distribution Sàrl** (le site écrit aussi « Bluepoint Distribution »).
- Positionnement actuel : « Bienvenue chez Bluepoint Distribution, importateur direct de producteurs italiens et distributeur de vins suisses. »
- Accroche : **« Les vignerons d'exception directement à votre maison! »**
- Promesses : **« Livraison sous 48h par PlanetExpress »** ; **« Livraison offerte dès 24 bouteilles »**.
- Mention légale : « L'accès à ce site est strictement réservé aux personnes majeures. L'ABUS D'ALCOOL EST DANGEREUX POUR LA SANTÉ, à consommer avec modération. »
- Copyright : « © Bluepoint Distribution 2026. Tous droits réservés. » Site actuel développé par bee interactive.

**Histoire (page À propos, reformulée par l'outil de lecture, verbatim à reprendre sur la page)**
Paolo Pioletti importe et distribue des vins italiens depuis 2003, en parallèle d'une autre activité. Après des années à chercher des vignerons d'exception attachés au travail artisanal et à la qualité, il s'est ouvert aux vins suisses. Depuis 2020, il se consacre exclusivement à cette passion.
**Valeurs** : qualité du produit ; valeur du travail et passion ; petits producteurs et relations humaines ; exclusivité pour la Suisse ou la Suisse romande ; proximité (Vaud) et racines italiennes.

**Contact**
- Rue du Châtelard 44, 1095 Lutry, Suisse
- +41 (79) 606 33 22
- info@bluepointdistribution.com
- Facebook : https://www.facebook.com/profile.php?id=100051131204556
- Instagram : https://www.instagram.com/bluepointdistribution
- Bar à vin lié : **Vintage Wine Bar**, http://vintagewinebar.ch
- (Coordonnées bancaires BCV présentes sur la page contact : **à ne pas reprendre** sur l'accueil B2C.)

**Navigation actuelle** : Accueil · À propos · Nos vins · Wine bar · Évènement · Contact · Panier.
**Événement en ligne** : « Vingt producteurs sélectionnés par Bluepoint Distribution ».

**Producteurs et cuvées (22 producteurs, prix en CHF)**
- **Campo alla Sughera** (Bolgheri, Toscane) : Adèo Bolgheri DOC 2023 (30), Campo alla Sughera IGT 2009 (80), Arnione Bolgheri Superiore DOCG 2021 (49)
- **Varramista** (Toscane) : Sterpato IGT 2021 (18), Varramista IGT 2019 (49), Frasca IGT 2021 (28)
- **Anzivino** (Gattinara, Piémont) : Gattinara DOCG 2022 (24), Riserva Gattinara Cesare DOCG 2020 (65)
- **Bianchi** (Tessin) : Alma Bio IGT (28), Merlot del Ticino Picaia 2022 Bio Suisse (24), Sambi Bio Suisse (4), Piaz Merlot Bio (35)
- **Cava d'Onice** (Montalcino) : Brunello di Montalcino DOCG 2020 (47), Micolore (16), Rosso di Montalcino 2022 (25)
- **Gabriele Scaglione** (Langhe, Piémont) : Barolo DOCG Passione di Re (45), Barbera d'Alba DOC I Quattro Conigli bianchi (22), Barbaresco DOCG Come un Volo (35), Moscato d'Asti DOCG Un Buon Momento (16), Roero Arneis DOCG Ottimo con il pesce (20), Barbaresco DOCG Come un volo Riserva (67)
- **Deux Frères** (spiritueux et rosé) : Deux Frères Dry Gin (54), Helvetico Vermouth Bianco / Rosso / Dry (26 chacun), L'été avec Deux Frères Bio Provence 2023 (24.90)
- **Corte Moschina** (Vénétie) : Mosca Bianca 2022 (16), I Tarai Soave Superiore 2020 (22), Colle Alto Cabernet 2019 (25), Moscarossa 2022 (16), Ripasso Valpolicella Superiore 2022 (35), Mosca Rosa (14), Terra Rubea IGT (25), Amarone Classico DOCG (26)
- **Poggio Bonelli** (Chianti) : Chianti Classico DOCG 2022 (22), Riserva Chianti Classico DOCG 2018 (28), Poggiassai 2019 (35)
- **Salvioni** (Montalcino) : Brunello di Montalcino (120), Rosso di Montalcino (65)
- **Andreola** (Valdobbiadene) : Col del Forno Prosecco Valdobbiadene (18), Bollé Rosé (14)
- **Bernard Gorjat** (Villette, Lavaux) : Villette les Chenalettes 2024 (15), Viognier de Villette 2022 50 cl (16), Robe Rouge de Villette 2019 (23), Merlot de Villette 2021 (28)
- **Cantina Canneddu** (Sardaigne) : Zimo' Bio (22), Zibbo DOC (28)
- **Vini Centanni** (Marches) : Canapale Bio (20), Primodelia (36)
- **Champagne Eric Legrand** : Brut Réserve (35), Prestige Blanc de Blanc (40), Rosé Eric Legrand (37)
- **Edmund Mach** (Trentin) : Lagrein (20), Chardonnay 2024 (18), Pinot Grigio DOC 2025 (18), Gewürztraminer 2021 (22), Riserva Monastero (25)
- **Arthur Duplan** (Lavaux) : Dézaley de la Tour Marsens (25)
- **Tenuta Scuotto** (Campanie) : Falanghina IGP (18), Oi-Ni' Fiano di Avellino (22), Taurasi DOCG (29)
- **Tenuta di Biserno** (Bolgheri) : Il Pino di Biserno (45), Biserno (130)
- **Fiona Fischer** : Nautilea (22), Pythagora (35), Laurona Plini (42), Laurona Mitic (28)
- **Vincent Graenicher** : Merlot réserve (28), Pinot noir réserve (24), À L'Origine (16)
- **Le Crocine** : Le Crocine (33), Eva (59)

Également vus en page d'accueil : OT 2016 (36), Frasca IGT 2021 (28), Dézaley de la Tour Marsens (25), Bollé Rosé (14), Pinot Grigio DOC 2025 (18).
*Les régions entre parenthèses sont déduites des appellations. Ce n'est pas un texte du client : à valider.* Coquilles à corriger au passage : « rèserve » → « réserve », « Gewürtztraminer » → « Gewürztraminer », « Blanc de Blanc » → « Blanc de Blancs ».

---

## 9. Visuels récupérables (URLs exactes)

**Logo et marque**
- Logo principal (vectoriel, bleu `#1A70B7`, 1886×422) : https://bluepointdistribution.com/svg/logo.svg
- Logo pied de page (PNG blanc sur transparent, 207×252, bouteille au trait + « BLUEPOINT DISTRIBUTION ») : https://bluepointdistribution.com/img/logo-footer.png
- Favicon (ICO 48/32/16, bouteille au trait sur fond bleu) : https://bluepointdistribution.com/favicon.ico
- ⚠ Demander au client **les fichiers sources du logo** (AI/EPS/SVG en version verticale bleue). La version verticale n'existe en ligne qu'en PNG blanc 207 px, insuffisant.

**Photos d'ambiance**
- https://bluepointdistribution.com/img/wines.jpg (grappes bleu-noir, panoramique, 1980×426)
- https://bluepointdistribution.com/img/abouts.png (vigne et grappes, panoramique, 1300×280)
- https://bluepointdistribution.com/img/bluepointdistribution-vins-qualite.jpg
- https://bluepointdistribution.com/img/events.png
- https://bluepointdistribution.com/content/777e026827f980a4cf201c2add3cc0fd/conversions/6278a750-72a4-4222-b0fe-92c9aa74073d-cropped-webp.webp (événement « Vingt producteurs »)

**Bouteilles (WebP, non détourées ; qualité vérifiée sur les deux premières)**
- Barolo DOCG Passione di Re (1000×1500, fond studio gris) : https://bluepointdistribution.com/content/aa973ea4c8487033cefc686af6c0590d/conversions/thumbnail-original-webp.webp
- Adèo Bolgheri DOC (2221×2961, fond blanc smartphone) : https://bluepointdistribution.com/content/6316f20d65d2fb6f4abdee6d60e24e9d/conversions/ad542eb4-2d59-4930-b0d3-72a0b5611583-original-webp.webp
- Frasca IGT 2021 : https://bluepointdistribution.com/content/f9fc8dfab6958f9632d2b19705293f68/conversions/af2c6bfd-f2be-4578-a374-d34d2951143c-original-webp.webp
- Riserva Gattinara Cesare DOCG 2020 : https://bluepointdistribution.com/content/e2888d0eff666fa08d5620d746d4d924/conversions/1a5860ce-92e5-43dc-b6d1-67288c70424f-original-webp.webp
- Dézaley de la Tour Marsens : https://bluepointdistribution.com/content/d8f064ee1a94085eb8971902f7f279d1/conversions/thumbnail-original-webp.webp
- Bollé Rosé : https://bluepointdistribution.com/content/47231c0b690e8e8a0d0f4fb5b9ec0a05/conversions/thumbnail-original-webp.webp
- Pinot Grigio DOC 2025 : https://bluepointdistribution.com/content/3ed5ddf84ba768445a833d6f1bc4e131/conversions/thumbnail-original-webp.webp
- Arnione Bolgheri Superiore : https://bluepointdistribution.com/content/45eed182b860191faf131ca0820ea120/conversions/4cb3443b-7eae-40c7-bfaa-b8d9449c7a1c-original-webp.webp
- Barbaresco Come un volo Riserva : https://bluepointdistribution.com/content/405f7754b163bdcedfbda1ff73a16432/conversions/a221af5d-9256-4c6d-96b8-85cdfa835c0c-original-webp.webp
- Brunello di Montalcino Salvioni : https://bluepointdistribution.com/content/03297c5c1810c25b9b1d515429883b88/conversions/thumbnail-original-webp.webp
- Biserno : https://bluepointdistribution.com/content/be8d9a3244c618ad4ffba80b74584f09/conversions/b6489bed-65ed-4053-a5b3-c37a105d67f4-original-webp.webp
- Il Pino di Biserno : https://bluepointdistribution.com/content/671343e881e62e87d59c694fed1578dd/conversions/01b86ab2-efd5-4da8-8e09-96d77203715a-original-webp.webp
- Col del Forno Prosecco : https://bluepointdistribution.com/content/08a221bc160606a7d0693dc310c1b13e/conversions/f4035ad4-dd99-4974-b382-596d9ecd3496-original-webp.webp
- Deux Frères Dry Gin : https://bluepointdistribution.com/content/df5e45929d67a3e49fde6495ab1a36f6/conversions/ceb2d783-262c-43b4-82a1-835341007ba9-original-webp.webp
- Helvetico Vermouth Rosso : https://bluepointdistribution.com/content/aa5dd306f1631063ba649dbf149b8f29/conversions/thumbnail-original-webp.webp
- Amarone Classico DOCG : https://bluepointdistribution.com/content/ca47222fd9796d4111d7085c87386534/conversions/b30dc28e-425e-47ba-b82d-40edbfa419f8-original-webp.webp
- Taurasi DOCG : https://bluepointdistribution.com/content/f9fe68ce91f0a1884b3dc4084f89957a/conversions/8910d961-8e5b-4134-b0b8-bff9558ebc08-original-webp.webp
- Toutes les autres cuvées suivent le motif `https://bluepointdistribution.com/content/{hash}/conversions/…-original-webp.webp` ; la liste complète se trouve sur https://bluepointdistribution.com/nos-vins.

**Références JNPR (analyse uniquement, jamais réutilisées)**
- Packshot : https://www.jnprspirits.com/cdn/shop/files/JNPR3_neutral_HD.jpg
- Hero : https://www.jnprspirits.com/cdn/shop/files/HERO_PIC_HP.jpg
- Planches identité : https://morganepichard.fr/wp-content/uploads/2022/09/identite-de-marque-JNPR-designer-graphique.jpg · https://morganepichard.fr/wp-content/uploads/2022/09/brochure-jnpr.jpg

---
