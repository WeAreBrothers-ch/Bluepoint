interface ExternalIconProps {
  className?: string;
}

/** Petite flèche « sort du site », placée devant les liens externes. */
export function ExternalIcon({ className }: ExternalIconProps) {
  return (
    <svg className={className} viewBox="0 0 12 12" width="11" height="11" aria-hidden="true">
      <path d="M5 1.5H1.5v9h9V7M7 1.5h3.5V5M10.5 1.5 5.5 6.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}
