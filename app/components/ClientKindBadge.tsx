import type { CSSProperties } from "react";

/**
 * Pastille « Pro » (bleue) ou « Particulier » (rose), identique partout dans l'app : on voit d'un coup d'œil
 * à qui on a affaire (un pro se facture, un particulier paie à la livraison).
 * Les couleurs sont celles demandées par BluePoint ; texte foncé sur fond clair pour rester lisible.
 */
export type ClientKind = "pro" | "particulier";

interface KindColors {
  readonly label: string;
  /** Couleur franche : liseré, point devant le texte. */
  readonly accent: string;
  /** Fond pâle de la pastille et du bandeau. */
  readonly tint: string;
  /** Texte de la pastille. */
  readonly text: string;
}

export const KIND_COLORS: Readonly<Record<ClientKind, KindColors>> = {
  pro: { label: "Client pro", accent: "#2563eb", tint: "#dbeafe", text: "#1e3a8a" },
  particulier: { label: "Particulier", accent: "#db2777", tint: "#fce7f3", text: "#9d174d" },
};

export function clientKind(isPro: boolean): ClientKind {
  return isPro ? "pro" : "particulier";
}

const PILL_STYLE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.4em",
  padding: "0.15em 0.7em",
  borderRadius: "999px",
  fontSize: "0.8125rem",
  fontWeight: 650,
  lineHeight: 1.4,
  whiteSpace: "nowrap",
};

const DOT_STYLE: CSSProperties = { width: "0.6em", height: "0.6em", borderRadius: "50%", flex: "none" };

interface ClientKindBadgeProps {
  readonly isPro: boolean;
  /** Précision après le type, ex. « Retrait au dépôt » : « Particulier · Retrait au dépôt ». */
  readonly detail?: string;
}

export function ClientKindBadge({ isPro, detail }: ClientKindBadgeProps) {
  const colors = KIND_COLORS[clientKind(isPro)];
  const text = detail === undefined ? colors.label : `${colors.label} · ${detail}`;
  return (
    <span style={{ ...PILL_STYLE, background: colors.tint, color: colors.text }}>
      <span aria-hidden="true" style={{ ...DOT_STYLE, background: colors.accent }} />
      {text}
    </span>
  );
}
