import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Packshot } from "@/components/packshot/Packshot";
import { MoreBottles } from "@/components/product/MoreBottles";
import { PairingSection } from "@/components/product/PairingSection";
import { ProductInfo } from "@/components/product/ProductInfo";
import styles from "@/components/product/ProductPage.module.css";
import { getAllBottles, getBottleBySlug } from "@/lib/catalog";

export const dynamicParams = false;

export function generateStaticParams(): Array<{ slug: string }> {
  return getAllBottles().map((bottle) => ({ slug: bottle.slug }));
}

export async function generateMetadata(props: PageProps<"/bouteilles/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const bottle = getBottleBySlug(slug);
  if (!bottle) return {};
  return {
    title: `${bottle.name}, ${bottle.producer} | BluePoint Distribution`,
    description: bottle.description,
  };
}

export default async function BottlePage(props: PageProps<"/bouteilles/[slug]">) {
  const { slug } = await props.params;
  const bottle = getBottleBySlug(slug);
  if (!bottle) notFound();
  return (
    <main className={styles.page}>
      <div className={styles.main}>
        <div className={styles.visualColumn}>
          <Packshot bottle={bottle} sizes="(min-width: 64rem) 55vw, 100vw" priority className={styles.visual} />
        </div>
        <ProductInfo bottle={bottle} />
      </div>
      <PairingSection bottle={bottle} />
      <MoreBottles currentSlug={bottle.slug} />
    </main>
  );
}
