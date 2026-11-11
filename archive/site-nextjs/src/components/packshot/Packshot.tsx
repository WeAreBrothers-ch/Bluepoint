import Image from "next/image";
import type { Bottle } from "@/data/types";
import styles from "./Packshot.module.css";

interface PackshotProps {
  bottle: Bottle;
  /** Largeur affichée du cadre, pour que le navigateur choisisse le bon fichier. */
  sizes: string;
  priority?: boolean;
  className?: string;
}

/**
 * Le visuel d'une bouteille dans sa tuile. Si une photo de mise en scène existe,
 * elle remplit la tuile ; sinon, la bouteille détourée est posée sur la ligne de base.
 */
export function Packshot({ bottle, sizes, priority = false, className }: PackshotProps) {
  const visual = bottle.photo ?? bottle.image;
  return (
    <div className={[styles.frame, className].filter(Boolean).join(" ")}>
      <Image
        className={bottle.photo ? styles.photo : styles.bottle}
        src={visual.src}
        width={visual.width}
        height={visual.height}
        alt={visual.alt}
        sizes={sizes}
        priority={priority}
      />
    </div>
  );
}
