import styles from "./Intro.module.css";

/*
 * Le bout du nez, redessiné au trait par-dessus le verre : au repos il plonge dans le verre
 * comme sur le dessin, et il reste net quand le verre s'en éloigne.
 * Il prolonge le trait du nez resté sur le fond (au-dessus du bord du verre).
 */
const NOSE_FILL = "M208.5 189C206 196 202 205 202 214C202 224 207 229 218 229C226 229 233 222 240 215C246 210 252 206 258 205H267V189Z";
const NOSE_LINE = "M208.5 189C206 196 202 205 202 214C202 224 207 229 218 229C226 229 233 222 240 215C246 210 252 206 258 205L264 206";

export function NoseOverlay() {
  return (
    <svg className={styles.overlay} viewBox="0 0 474 474" aria-hidden="true">
      <path d={NOSE_FILL} fill="#fff" />
      <path d={NOSE_LINE} fill="none" stroke="#000" strokeWidth={4.5} strokeLinecap="round" />
    </svg>
  );
}
