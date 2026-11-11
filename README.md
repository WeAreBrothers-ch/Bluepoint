# BluePoint Gestion

> Ce dépôt contient aussi le **thème Shopify** de la boutique (`theme/`), ses **images de référence** (`references/`) et la
> **documentation de la marque** (`docs/` : direction artistique, produit, guide de la boutique).

App Shopify sur mesure, intégrée à l’admin de la boutique BluePoint (`5s71g8-0v.myshopify.com`).
Elle sert à l’équipe, pas aux clients :

- **Agenda** : les livraisons du jour et de la semaine, à partir des commandes et de leurs dates de livraison.
- **Nouvelle commande (téléphone)** : saisir une commande reçue par téléphone.
- **Factures** : générer les factures PDF avec QR-facture suisse (paquet local `packages/facture-qr`).
- **Clients pro** (`/app/pros`) : demandes reçues par le formulaire du site
  (`https://<boutique>/apps/bon-commande/devenir-pro`, servi par le proxy d’app dans le thème) ;
  « Accepter » crée l’entreprise (paiement à N jours), rattache la personne (rôle « Commande uniquement »),
  pose l’étiquette `pro` et envoie l’e-mail d’invitation de Shopify. « Ajouter un client pro » fait de même
  pour un pro qui appelle. Demandes en base (table `ProRequest`), bandeau dans l’agenda s’il y en a.
- **Bon de commande** côté boutique : paiement normal de Shopify. Un pro rattaché à une entreprise
  dont l’emplacement a « Net 30 » valide sa commande sans payer ; elle arrive non payée, avec ses
  conditions, et l’agenda l’affiche « Facture à 30 jours ». Le proxy `https://<boutique>/apps/bon-commande`
  mène simplement au panier.

État actuel :

- **Agenda** (`/app`) : onglets Aujourd’hui / Semaine (heure suisse), urgence (en retard, aujourd’hui,
  bientôt, planifiée, sans date), mode, client, badge Pro, ville, échéance, statut de paiement.
  Dates lues dans les métachamps `$app` (clés `livraison_*`), sinon dans les attributs du panier
  « Date de livraison souhaitée » / « Livrer au plus tard ». 300 commandes au plus par affichage
  (avis visible au-delà).
- **Marquer livrée** : crée l’expédition si besoin, puis l’événement « livrée ». Relancer ne refait rien.
  La facture est créée juste après, si les réglages sont complets.
- **Factures** (`/app/factures`) : numéro BP-AAAA-NNNN tiré dans la même transaction que la facture
  (pas de trou, pas de doublon), PDF stocké en base (table `StoredFile`), téléchargement, envoi par
  e-mail (boîte Infomaniak de BluePoint, en SMTP) et par WhatsApp (lien public signé, valable 14 jours, route `/partage/<jeton>`).
  « Envoyer par e-mail » et « Envoyer par WhatsApp » ouvrent une fenêtre avec le message déjà rédigé
  (vins de la commande lus dans Shopify, total, échéance) : on le relit, on le modifie, puis on envoie
  (route `/app/factures/:id/message` pour les brouillons ; les relances restent en un toucher).
- **Fiche commande** (`/app/commandes/:id`) : vins, prix, remise, total, client, facture. Tant que la
  commande n’est ni livrée ni facturée : « Modifier les vins » (édition de commande Shopify, remise
  automatique recalculée, stock remis ; seulement si pas encore payée) et « Annuler la commande »
  (stock remis, remboursement sur le moyen de paiement d’origine si déjà payée). Autorisation
  `write_order_edits` pour la modification.
- **Commandes** (`/app/commandes`) : toutes les commandes, les plus récentes d’abord, avec recherche (client,
  entreprise, ville, numéro) et onglets Toutes / À livrer / Livrées / Annulées ; chaque ligne ouvre la fiche
  commande de l’app. Shopify ne donne que les 60 derniers jours sans l’autorisation `read_all_orders`.
- **Clients** (`/app/clients`, `/app/clients/:id`) : liste et recherche (onglet Pros), fiche avec adresse,
  téléphone, e-mail, nombre de commandes et dernières commandes ; « Modifier les coordonnées »
  (`customerUpdate`, puis `customerAddressUpdate` / `customerAddressCreate`) ; « Prendre une commande »
  ouvre le formulaire avec le client déjà choisi (`/app/commande?client=…`). « Comptes pro » (`/app/pros`) est
  atteint depuis la page Clients.
- **Stock** (`/app/stock`) : bouteilles disponibles, en cave et réservées par vin, « Ajouter des
  bouteilles » (`inventoryAdjustQuantities`, raison `received`) et « Corriger le nombre »
  (`inventorySetQuantities` sur `on_hand`), avec contrôle de la quantité attendue et clé
  d’idempotence. Autorisation `write_inventory`. « Modifier le prix » (`productVariantsBulkUpdate`). « Nouveau vin » : produit actif à variante unique
  créé par `productSet` (prix, stock au dépôt), mis en vente sur les mêmes canaux que les autres vins
  (`publishablePublish`). Autorisations `write_products`, `read_locations`, `read/write_publications`.
  Photo du vin (« Nouveau vin », « Ajouter / Changer la photo ») : réduite dans le navigateur
  (1600 px, JPEG), déposée via `stagedUploadsCreate`, puis rattachée par `productSet` (liste `files`
  seule : elle remplace l’ancienne photo sans toucher au prix ni au stock). Autorisation `write_files`.
- **Réglages** (`/app/reglages`) : vendeur, TVA, IBAN / QR-IBAN, délai de paiement, automatismes.
- **Webhook `fulfillments/create`** : facture automatique si le réglage est activé.
- **Nouvelle commande (téléphone)** (`/app/commande`) : recherche du client (nom, entreprise, téléphone,
  e-mail), entreprise B2B si le client en a une (prix du catalogue via `draftOrderCalculate`), produits
  actifs avec stock (avertissement sans blocage), raccourcis cartons de 6 et 12, dates et mode de
  livraison, note interne, « bon de commande » (net N jours, N = délai des réglages) ou « payé ».
  Crée une commande provisoire étiquetée `telephone` avec les métachamps `$app`, puis la termine.
  Anti-doublon : clé générée par le navigateur et suivie en base (table `PhoneOrderRequest`).
  Si Shopify refuse les conditions de paiement, la commande reste provisoire (sinon elle serait
  marquée payée) et la page le dit.
- **Webhook `orders/create`** : recopie les attributs du panier « Date de livraison souhaitée »,
  « Livrer au plus tard » (par défaut = date souhaitée) et « Mode de livraison » dans les
  métachamps `$app`. Valeurs illisibles ignorées et journalisées ; métachamp déjà posé jamais réécrit.

## Vente par cartons de 6

Les vins se vendent **par cartons de 6 bouteilles, au minimum un carton** (6, 12, 18…), pour chaque vin.

- **Application** : « Prendre une commande » et « Modifier les vins » comptent en cartons (`app/lib/commande/cart.ts`,
  constante `CARTON_SIZE` dans `types.ts`) ; le serveur refuse toute quantité qui n’est pas un carton complet. Une
  ancienne ligne d’une commande du site (par exemple 3 bouteilles) reste telle quelle tant qu’on n’y touche pas.
- **Site** (thème) : l’ajout se fait par 6, le panier avance de 6 en 6, et « Commander » reste bloqué tant qu’une ligne
  n’est pas un carton complet. Shopify n’impose pas cette règle sur l’abonnement Basic : elle vit dans le thème.

## Noms des pages

Les noms du menu et des titres viennent d’une seule liste, `app/lib/titres.ts` : Livraisons, Prendre une commande,
Factures, Vins en cave, Clients, Toutes les commandes, Informations de l’entreprise, Aide. Les phrases d’aide les
reprennent, pour que tout le monde (le patron comme un employé) lise toujours les mêmes mots.

## Rabais carte (2 % pour un paiement par carte tout de suite)

Règle du caviste : **2 % de rabais en plus du prix pro, seulement si le client paie par carte au moment de la
commande sur le site.** Un paiement plus tard (facture à 30 jours, virement, espèces, TWINT…) n’y donne pas droit.

- **Dans Shopify** : code de réduction `CARTE2` (« Paiement par carte −2 % (pros) »), −2 % sur la commande, réservé au
  segment « Clients pro » ; la remise automatique « Prix pro −15 % » et ce code se cumulent (les deux sont réglés
  pour se combiner). Valeurs et code dans `app/lib/rabais/carte.ts`.
- **Sur le site** : sur la page panier, un client pro voit deux choix : « Payer par carte maintenant : −2 % »
  (le lien `/discount/CARTE2?redirect=/checkout` applique le code puis ouvre le paiement) et « Commander sur facture
  (30 jours) » sans rabais. Le bandeau de l’extension `rabais-pros` et la page « Espace pro » l’annoncent aussi.
- **Garde-fou** : Shopify ne peut pas limiter une remise à un moyen de paiement. Si une commande utilise `CARTE2` sans
  être payée (statut « en attente »), la carte de l’agenda affiche « Rabais carte à vérifier » : le rabais n’est pas dû.

## Litres vendus

Page « Litres vendus » (`/app/litres`) : combien de litres de vin ont été vendus dans l’année, par sorte (rouge, blanc, rosé,
champagne…) et par pays (France, Italie, Suisse), vin par vin et mois par mois, avec une **feuille à imprimer** (A4,
`/app/litres/feuille`). Le Contrôle suisse du commerce des vins (CSCV) demande à toute entreprise qu’il suit de déclarer le volume
d’affaires en litres de l’année civile avant le 31 janvier, et d’avoir sous la main le détail par produit ; les bouteilles se
convertissent en litres avec leur contenance (guide CSCV « Comptabilité de cave pour le commerce de bouteilles »). Dire si BluePoint
est suivi par le CSCV revient à la fiduciaire.

- **Calcul** (`app/lib/litres/`) : bouteilles vendues × contenance, en millilitres entiers. Commandes annulées et d’essai exclues ;
  une ligne retirée d’une commande modifiée n’est pas comptée ; les remboursements ne sont pas déduits. Les spiritueux sont comptés à
  part, hors du total du vin. Le champagne (sorte « Champagne » du formulaire, rangée avec les effervescents, ou appellation
  « Champagne ») est toujours compté comme venant de France.
- **Où sont les données** : dans les étiquettes Shopify du vin, comme `pays:` et `region:` pour le menu du site :
  `contenance:75` (en cl, `37.5` pour une demi), `millesime:2022`, `appellation:Dézaley AOC`. « Nouveau vin » (page Vins en cave) demande
  le pays et la contenance et écrit ces étiquettes. Un vin sans contenance est compté à 75 cl et signalé ; un vin sans pays est classé
  « Pays non renseigné ». La page propose de les compléter vin par vin (écrit dans Shopify, autorisation `write_products`).
- **Limite importante** : sans l’autorisation `read_all_orders`, Shopify ne donne que les 60 derniers jours de commandes. La page
  l’affiche en rouge et la feuille le répète : les chiffres ne sont alors pas utilisables pour une déclaration. L’autorisation est
  à demander à Shopify, puis à ajouter à `scopes` dans `shopify.app.toml` une fois accordée (la déclarer avant fait échouer le déploiement).

## Technique

| Élément | Choix |
| --- | --- |
| Base | Gabarit officiel `Shopify/shopify-app-template-react-router` |
| Framework | React Router 7, TypeScript strict |
| Interface | Polaris web components + App Bridge |
| Admin API | GraphQL, version `2026-10` |
| Sessions | Prisma + PostgreSQL (Neon) |
| Hébergement | Vercel (Fluid compute, Node). `Dockerfile` gardé en solution de repli |

Organisation du code :

```
app/
  routes/            pages (app._index = Agenda, app.commande, app.factures), webhooks, proxy
  components/        composants d’interface réutilisables
  lib/core/          Result, journal serveur, variables d’environnement
  lib/shopify/       helpers GraphQL typés, identifiants Shopify
  lib/metafields/    métachamps « livraison » (reflet de shopify.app.toml)
  lib/agenda/        agenda : requête, regroupement, urgence (heure suisse)
  lib/livraison/     « Marquer livrée » (expédition + événement livrée)
  lib/factures/      factures : numérotation, génération, envoi, liens signés
  lib/reglages/      réglages de facturation (validation zod)
  lib/format/        montants CHF, dates jj.mm.aaaa, typographie suisse
  lib/commande/      types de la commande par téléphone
  lib/webhooks/      lecture sûre des données reçues par webhook
```

Les métachamps de commande (`date_souhaitee`, `date_limite`, `mode`) sont **déclarés dans
`shopify.app.toml`** : Shopify les crée à chaque `shopify app deploy`. Ils vivent dans l’espace
de noms réservé à l’app, `$app`, avec des clés préfixées `livraison_` (seul espace accepté dans le TOML).

## Mise en route

Prérequis : Node 22.12 ou plus, la CLI Shopify (`npm install -g @shopify/cli`), un compte
Shopify Partner avec accès à la boutique.

1. **Créer l’app** dans le [Dev Dashboard](https://dev.shopify.com) : *Create app* → nom
   « BluePoint Gestion ». Dans *Distribution*, choisir **Custom distribution** et saisir
   `5s71g8-0v.myshopify.com`. Le tableau de bord fournit un **lien d’installation** à ouvrir
   (ou à envoyer au propriétaire de la boutique).
2. **Données client protégées** : dans les réglages de l’app, déclarer l’usage des données
   client (nom, adresse, téléphone). Sans cela, le webhook `orders/create` et la lecture des
   clients sont refusés.
3. **Installer les dépendances** : `npm install`
4. **Lier la configuration** : `shopify app config link`, puis choisir l’app créée.
   Vérifier ensuite avec `git diff shopify.app.toml` que les sections `[app_proxy]`, les
   webhooks et `[order.metafields…]` sont toujours là (les restaurer si besoin). Alternative
   plus simple : coller l’ID client dans `client_id` de `shopify.app.toml`.
5. **Variables d’environnement** : copier `.env.example` en `.env` et remplir les valeurs.
   Pour le développement, utiliser une branche Neon de développement (ou un PostgreSQL local).
6. **Lancer** : `npm run dev`. La CLI ouvre un tunnel, applique les migrations Prisma et
   donne le lien pour ouvrir l’app dans l’admin.

## Mise en ligne (Vercel + Neon)

1. Importer le dépôt dans Vercel, avec `admin-app` comme **Root Directory**
   (framework détecté : React Router).
2. Dans l’onglet *Storage*, ajouter **Neon** depuis le Marketplace et le lier au projet :
   `DATABASE_URL` et `DATABASE_URL_UNPOOLED` sont ajoutées automatiquement. Choisir la région
   Francfort pour Neon et pour les fonctions Vercel (au plus près de la Suisse).
3. Ajouter les autres variables de `.env.example` (`SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`,
   `SCOPES` (copie exacte de la ligne `scopes` de `shopify.app.toml`),
   `SHOPIFY_APP_URL` = URL de production Vercel, `SMTP_USER` (adresse complète
   d’une boîte Infomaniak du domaine, ex. `factures@bluepointdistribution.com`) et `SMTP_PASSWORD`
   (son mot de passe, ou un mot de passe d’application si la double authentification est active).
   Facultatif : `EMAIL_FROM_NAME` (nom affiché, « Blue Point Distribution » par défaut),
   `SMTP_HOST` / `SMTP_PORT` (`mail.infomaniak.com` / `465` par défaut).
   Sans `SMTP_USER` et `SMTP_PASSWORD`, le bouton « Envoyer par e-mail » explique que l’envoi n’est pas configuré.
4. Déployer. Le script `vercel-build` génère Prisma, applique les migrations puis construit
   l’app avec le preset Vercel.
5. Dans `shopify.app.toml`, remplacer `https://example.com` par l’URL Vercel
   (`application_url`, `redirect_urls`, `app_proxy.url`), passer
   `automatically_update_urls_on_dev` à `false`, puis lancer **`shopify app deploy`** : cela
   publie les autorisations, les webhooks, le proxy et les métachamps.

## Publier la configuration Shopify (sans ordinateur)

Un changement de `shopify.app.toml` (autorisations, webhooks, proxy, métachamps) doit être publié chez
Shopify. Le workflow GitHub **« Configuration Shopify »** le fait (`.github/workflows/shopify-config.yml`) :

1. Dev Dashboard › l’app › **Settings** › **App Automation Token** : créer un jeton.
2. GitHub › le dépôt › **Settings** › **Secrets and variables** › **Actions** › *New repository secret* :
   nom `SHOPIFY_APP_AUTOMATION_TOKEN`, valeur = le jeton. Ne jamais le coller ailleurs.
3. GitHub › **Actions** › « Configuration Shopify » › **Run workflow**.
4. Ouvrir l’app dans l’admin Shopify : accepter les nouvelles autorisations si Shopify le demande.

## Commandes utiles

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Développement avec la CLI Shopify |
| `npm run check` | Vérification des types, lint, tests et build |
| `npm test` | Tests unitaires (vitest) de la logique pure |
| `npm run deploy` | `shopify app deploy` (configuration Shopify) |
| `npm run setup` | Génère Prisma et applique les migrations |

## Points d’attention

- **Conditions de paiement (bon de commande)** : les autorisations `read_payment_terms,write_payment_terms`
  sont déclarées dans `shopify.app.toml` (à recopier dans `SCOPES`). Si l’offre Shopify ne les
  permet pas, les commandes « bon de commande » restent en commande provisoire, à terminer dans Shopify.
- **B2B** : sur l’abonnement Basic, les entreprises et leurs conditions de paiement fonctionnent, mais
  pas les catalogues attribués aux entreprises (refus `UNPERMITTED_ENTITLEMENTS_DIRECT_CATALOG_ASSIGNMENT`).
  Les prix pros passent donc par la remise automatique « Prix pro -15 % » (segment « Clients pro »,
  étiquette `pro`) : elle s’applique au panier et au paiement, et aux commandes par téléphone
  (`acceptAutomaticDiscounts`), une seule fois, entreprise ou non.
- **Attributs de panier écrits par le thème** : de préférence lisibles, car ils s’affichent tels quels
  dans « Détails supplémentaires » : dates `03.11.2026`, mode `Livraison BluePoint`,
  `Envoi par la Poste` ou `Retrait au dépôt` (les codes `livraison` / `poste` / `retrait` restent acceptés).
- **Commande du site sans date** : l’agenda la range dans « Jour de livraison à choisir » ; le bouton
  « Choisir le jour » pose les métachamps `livraison_date_souhaitee` (et recopie la date limite connue).
- **Commandes de plus de 60 jours** : il faudra l’autorisation `read_all_orders`, à demander à
  Shopify depuis le Dev Dashboard.
- **Copie panier → commande** des métachamps (`cart_to_order_copyable`) : la valeur doit être
  posée sur le panier avec le même espace de noms et la même clé. L’espace `$app`
  n’est pas modifiable par le JavaScript du thème : il faudra passer par l’app (Storefront API
  ou extension) quand le choix de la date sera ajouté à la boutique.
- Les secrets restent côté serveur : seule la clé API publique est envoyée au navigateur.
- **Moteur de facture** : `@bluepoint/facture-qr` est installé en lien local et compilé dans le
  bundle serveur (`ssr.noExternal`). Ses polices sont intégrées à son propre code
  (`src/pdf/polices-integrees.ts`) : aucune lecture de fichier, rien à copier au déploiement.
  `pdfkit`, `swissqrbill` et `zod` sont des dépendances directes de l’app, aux mêmes versions.
- **Fuseau horaire** : un jour = jour civil à Zurich ; aucune date n’est convertie en UTC.
