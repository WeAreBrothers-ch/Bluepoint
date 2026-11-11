import { ButtonLink } from "@/components/ui/ButtonLink";
import { PhotoFigure } from "@/components/ui/PhotoFigure";
import { SectionHead } from "@/components/ui/SectionHead";
import { contact } from "@/data/contact";
import { PHOTOS, type Photo } from "@/data/photos";
import styles from "./HouseStory.module.css";

/** Quatre photos d'ambiance, numérotées à la suite de celles de l'accueil. */
const GALLERY: ReadonlyArray<Photo> = [PHOTOS.vigne, PHOTOS.sante, PHOTOS.aperitif, PHOTOS.blancRose];
const FIRST_INDEX = 4;

export function HouseStory() {
  return (
    <section id="maison" className={styles.section} aria-labelledby="maison-title">
      <SectionHead id="maison-title" title="La maison" />
      <div className={styles.layout}>
        <div className={styles.gallery}>
          {GALLERY.map((photo, index) => (
            <PhotoFigure
              key={photo.src}
              photo={photo}
              index={FIRST_INDEX + index}
              ratio="4 / 5"
              sizes="(min-width: 64rem) 26vw, 46vw"
            />
          ))}
        </div>

        <div className={styles.text}>
          <p className={styles.title}>Paolo, à Lutry, depuis 2003</p>
          <p>
            Paolo Pioletti importe des vins italiens depuis 2003. Après des années à chercher des
            vignerons attachés au travail artisanal, il s&apos;est ouvert aux vins suisses. Depuis
            2020, il s&apos;y consacre entièrement.
          </p>
          <p>
            De petits domaines, souvent en exclusivité pour la Suisse romande, et une relation
            directe avec chaque vigneron&nbsp;: vous achetez la bouteille qu&apos;il a goûtée chez lui.
          </p>
          <div className={styles.actions}>
            <ButtonLink href={`mailto:${contact.email}`}>Écrire à Paolo</ButtonLink>
            <ButtonLink href={contact.phoneHref} variant="trait">
              {contact.phoneDisplay}
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
