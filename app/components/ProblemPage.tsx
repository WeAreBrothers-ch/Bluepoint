/**
 * Ce qu'on montre quand une page plante, à la place de la page d'erreur anglaise de React Router :
 * une phrase simple, et deux boutons (réessayer, revenir à l'agenda).
 */

interface ProblemText {
  readonly heading: string;
  readonly body: string;
}

export function problemText(notFound: boolean): ProblemText {
  return notFound
    ? {
        heading: "Cette page n’existe pas",
        body: "Le lien est peut-être ancien. Revenez à l’agenda, ou choisissez une page dans le menu de l’application.",
      }
    : {
        heading: "Cette page n’a pas pu s’afficher",
        body: "Ce n’est pas de votre faute. Touchez « Réessayer ». Si cela recommence, attendez quelques minutes\u202F: Shopify est peut-être momentanément indisponible.",
      };
}

function reload() {
  window.location.reload();
}

/** Dans l'application (menu et style Shopify disponibles). */
export function ProblemPanel({ notFound }: { readonly notFound: boolean }) {
  const text = problemText(notFound);
  return (
    <s-page heading="Un petit souci">
      <s-section>
        <s-stack direction="block" gap="base">
          <s-banner tone={notFound ? "warning" : "critical"} heading={text.heading}>
            {text.body}
          </s-banner>
          <s-stack direction="inline" gap="small-200">
            {notFound ? null : (
              <s-button variant="primary" icon="refresh" onClick={reload}>
                Réessayer
              </s-button>
            )}
            <s-button href="/app" {...(notFound ? { variant: "primary" } : {})}>
              Retour à l’agenda
            </s-button>
          </s-stack>
        </s-stack>
      </s-section>
    </s-page>
  );
}

const PLAIN_STYLES = {
  main: { fontFamily: "Inter, system-ui, sans-serif", maxWidth: "36rem", margin: "3rem auto", padding: "0 1rem", color: "#303030" },
  heading: { fontSize: "1.5rem", marginBottom: "0.75rem" },
  body: { fontSize: "1.125rem", lineHeight: 1.5 },
  button: {
    display: "inline-block",
    marginTop: "1.5rem",
    padding: "0.75rem 1.25rem",
    fontSize: "1.125rem",
    borderRadius: "0.5rem",
    background: "#303030",
    color: "#ffffff",
    border: "none",
    cursor: "pointer",
  },
} as const;

/** Hors de l'application (le style Shopify n'est pas chargé) : du HTML simple, lisible partout. */
export function PlainProblemPage({ notFound }: { readonly notFound: boolean }) {
  const text = problemText(notFound);
  return (
    <main style={PLAIN_STYLES.main}>
      <h1 style={PLAIN_STYLES.heading}>{text.heading}</h1>
      <p style={PLAIN_STYLES.body}>{text.body}</p>
      {notFound ? null : (
        <button type="button" onClick={reload} style={PLAIN_STYLES.button}>
          Réessayer
        </button>
      )}
    </main>
  );
}
