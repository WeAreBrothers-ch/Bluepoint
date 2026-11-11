import { Hero } from "@/components/home/Hero";
import { HouseStory } from "@/components/home/HouseStory";
import { Manifesto } from "@/components/home/Manifesto";
import { Selection } from "@/components/home/Selection";
import { TableMoments } from "@/components/home/TableMoments";
import { Intro } from "@/components/intro/Intro";

export default function HomePage() {
  return (
    <main>
      <Intro />
      <Hero />
      <Selection />
      <Manifesto />
      <TableMoments />
      <HouseStory />
    </main>
  );
}
