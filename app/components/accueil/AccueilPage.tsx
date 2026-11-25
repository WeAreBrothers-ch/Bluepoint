import { FILL } from "../fill";
import { SHOPIFY_ADMIN_HOME, type EntryLink } from "../../lib/accueil/entree-app";
import { useFramedReturn } from "./useFramedReturn";

/**
 * Page d'accueil publique (« / »), vue seulement quand l'app s'ouvre sans le nom de la boutique. Un bouton par page du
 * menu, avec les mêmes noms. Hors de l'admin Shopify, chaque bouton ouvre Shopify directement sur la page ; dans
 * l'admin, la page recharge l'app dans son cadre (et retourne d'elle-même aux livraisons, voir `useFramedReturn`).
 */

const POLARIS_SCRIPT = "https://cdn.shopify.com/shopifycloud/polaris.js";

export const ACCUEIL_TEXTES = {
  titre: "BluePoint Gestion",
  dansShopify: "Choisissez la page de l’application à ouvrir.",
  horsShopify: "Cette application s’utilise dans Shopify. Touchez la page à ouvrir : Shopify s’ouvre directement dessus.",
  connexion: "Si Shopify vous demande de vous connecter, utilisez votre compte Shopify habituel.",
  sansBoutique: "Cette application s’utilise dans Shopify. Ouvrez Shopify, puis « bluepoint-gestion » dans le menu « Applications ».",
  ouvrirShopify: "Ouvrir Shopify",
} as const;

interface AccueilPageProps {
  /** null : la boutique n'a pas pu être lue, seul le lien vers Shopify reste. */
  readonly links: readonly EntryLink[] | null;
}

function EntryButtons({ links, framed }: { readonly links: readonly EntryLink[]; readonly framed: boolean }) {
  return (
    <s-grid gridTemplateColumns="minmax(0, 1fr)" gap="small-200">
      {links.map((link, index) => (
        <s-button key={link.path} {...FILL} variant={index === 0 ? "primary" : "secondary"} icon={link.icon} href={framed ? link.framedUrl : link.adminUrl}>
          {link.label}
        </s-button>
      ))}
    </s-grid>
  );
}

function WithoutShop() {
  return (
    <>
      <s-paragraph>{ACCUEIL_TEXTES.sansBoutique}</s-paragraph>
      <s-grid gridTemplateColumns="minmax(0, 1fr)">
        <s-button {...FILL} variant="primary" href={SHOPIFY_ADMIN_HOME}>
          {ACCUEIL_TEXTES.ouvrirShopify}
        </s-button>
      </s-grid>
    </>
  );
}

export function AccueilPage({ links }: AccueilPageProps) {
  const framed = useFramedReturn(links?.[0]?.framedUrl ?? null);
  return (
    <>
      <script src={POLARIS_SCRIPT} />
      <s-page heading={ACCUEIL_TEXTES.titre} inlineSize="small">
        <s-section>
          <s-stack direction="block" gap="base">
            {links === null ? (
              <WithoutShop />
            ) : (
              <>
                <s-paragraph>{framed ? ACCUEIL_TEXTES.dansShopify : ACCUEIL_TEXTES.horsShopify}</s-paragraph>
                <EntryButtons links={links} framed={framed} />
                {framed ? null : <s-paragraph color="subdued">{ACCUEIL_TEXTES.connexion}</s-paragraph>}
              </>
            )}
          </s-stack>
        </s-section>
      </s-page>
    </>
  );
}
