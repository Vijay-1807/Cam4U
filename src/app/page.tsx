"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { Navigation, Hero } from "@/components/ui/saa-s-template";
import KineticScroll from "@/components/landing/KineticScroll";
import ImageReveal from "@/components/landing/ImageReveal";
import TextReveal from "@/components/landing/TextReveal";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import FooterSection from "@/components/ui/footer";

export default function Home() {
  useEffect(() => {
    const lenis = new Lenis();

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);
  }, []);

  return (
    <main className="bg-black min-h-screen w-full">
      <Navigation />
      <Hero />
      <div id="features">
        <FeaturesSection />
        <KineticScroll />
      </div>
      <div id="technology">
        <ImageReveal />
      </div>
      <div id="about">
        <TextReveal />
      </div>

      <FooterSection />
    </main>
  );
}
