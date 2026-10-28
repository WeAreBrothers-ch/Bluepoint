# BluePoint Gestion

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
  e-mail (Resend) et par WhatsApp (lien public signé, valable 14 jours, route `/partage/<jeton>`).
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

1. Importer le dépôt dans Vercel. L'app est à la racine du dépôt : laisser **Root Directory**
   vide (framework détecté : React Router). Le projet Vercel est relié à
   `WeAreBrothers-ch/Bluepoint` : un envoi sur `main` met l'app en production.
2. Dans l’onglet *Storage*, ajouter **Neon** depuis le Marketplace et le lier au projet :
   `DATABASE_URL` et `DATABASE_URL_UNPOOLED` sont ajoutées automatiquement. Choisir la région
   Francfort pour Neon et pour les fonctions Vercel (au plus près de la Suisse).
3. Ajouter les autres variables de `.env.example` (`SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`,
   `SCOPES` (copie exacte de la ligne `scopes` de `shopify.app.toml`),
   `SHOPIFY_APP_URL` = URL de production Vercel, `RESEND_API_KEY` et `RESEND_FROM`
   (expéditeur d’un domaine vérifié chez Resend, ex. `Blue Point Distribution <factures@…>`).
   Sans ces deux dernières, le bouton « Envoyer par e-mail » explique que l’envoi n’est pas configuré.
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
- **Cadre « BluePoint » sur la page de commande Shopify** (extension `extensions/commande-bluepoint`) :
  quand livrer, comment, paiement, facture et prochaine étape, d’après `/api/resume-commande`.
  À épingler une fois sur la page d’une commande (section des applis, en bas).
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
