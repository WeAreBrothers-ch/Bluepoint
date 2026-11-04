/**
 * Titre d'un groupe de cartes (« En retard (2) », « À livrer aujourd'hui (3) ») posé sur le fond de la page,
 * entre les cartes : un client = une carte, et le titre dit de quel groupe on parle.
 */
interface GroupTitleProps {
  readonly title: string;
  /** Une phrase sous le titre : ce qu'il faut faire de ce groupe. */
  readonly hint?: string;
}

export function GroupTitle({ title, hint }: GroupTitleProps) {
  return (
    <s-box paddingBlockStart="large-100" paddingBlockEnd="small-200">
      <s-stack direction="block" gap="small-100">
        <s-heading>{title}</s-heading>
        {hint === undefined ? null : <s-text color="subdued">{hint}</s-text>}
      </s-stack>
    </s-box>
  );
}
