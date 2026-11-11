import styles from "./CornerMarks.module.css";

const POSITIONS = ["haut-gauche", "haut-droite", "bas-gauche", "bas-droite", "milieu-gauche", "milieu-droite"] as const;

/** Repères de cadrage aux bords de l'écran, comme dans un viseur. Purement décoratifs. */
export function CornerMarks() {
  return (
    <div className={styles.marks} aria-hidden="true">
      {POSITIONS.map((position) => (
        <span key={position} className={styles.mark} data-position={position} />
      ))}
    </div>
  );
}
