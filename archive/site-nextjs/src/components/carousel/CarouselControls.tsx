import styles from "./Carousel.module.css";

interface CarouselControlsProps {
  count: number;
  index: number;
  canPrev: boolean;
  canNext: boolean;
  onMove: (direction: 1 | -1) => void;
}

/** « ‹ PRÉC. », une réglette de traits (le trait plein marque la position), « SUIV. › ». */
export function CarouselControls({ count, index, canPrev, canNext, onMove }: CarouselControlsProps) {
  return (
    <div className={`ui ${styles.controls}`}>
      <button type="button" className={styles.button} onClick={() => onMove(-1)} disabled={!canPrev}>
        <span aria-hidden="true">‹</span> Préc.
      </button>
      <span className={styles.ticks} aria-hidden="true">
        {Array.from({ length: count }, (_, tick) => (
          <span key={tick} className={styles.tick} data-actif={tick === index} />
        ))}
      </span>
      <span className="sr-only" aria-live="polite">
        {`Position ${Math.min(index + 1, count)} sur ${count}`}
      </span>
      <button type="button" className={styles.button} onClick={() => onMove(1)} disabled={!canNext}>
        Suiv. <span aria-hidden="true">›</span>
      </button>
    </div>
  );
}
