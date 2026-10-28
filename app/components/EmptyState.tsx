import type { ReactNode } from "react";

/** État vide d'une page : un titre, une explication et, au besoin, une action. */
interface EmptyStateProps {
  readonly heading: string;
  readonly children: ReactNode;
  readonly action?: ReactNode;
}

export function EmptyState({ heading, children, action }: EmptyStateProps) {
  return (
    <s-section>
      <s-stack direction="block" gap="base" alignItems="center" padding="large">
        <s-heading>{heading}</s-heading>
        <s-paragraph>{children}</s-paragraph>
        {action}
      </s-stack>
    </s-section>
  );
}
