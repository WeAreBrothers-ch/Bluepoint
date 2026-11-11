import Image from "next/image";
import type { Photo } from "@/data/photos";
import styles from "./PhotoFigure.module.css";

interface PhotoFigureProps {
  photo: Photo;
  /** Numéro affiché dans la légende : [04] À LA VIGNE. */
  index: number;
  sizes: string;
  /** Format imposé au cadre ; sans lui, la photo garde ses proportions. */
  ratio?: string;
}

/** Photo encadrée, légendée comme un inventaire, qui apparaît au défilement. */
export function PhotoFigure({ photo, index, sizes, ratio }: PhotoFigureProps) {
  return (
    <figure className={`apparition ${styles.figure}`}>
      <div className={styles.frame} style={ratio ? { aspectRatio: ratio } : undefined}>
        <Image
          src={photo.src}
          width={photo.width}
          height={photo.height}
          alt={photo.alt}
          sizes={sizes}
          className={styles.image}
          data-cadre={ratio ? "impose" : "libre"}
        />
      </div>
      <figcaption className={`ui ${styles.caption}`}>
        <span className="crochets">{String(index).padStart(2, "0")}</span>
        <span>{photo.caption}</span>
      </figcaption>
    </figure>
  );
}
