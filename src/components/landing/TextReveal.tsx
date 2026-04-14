"use client";

import React, { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger);

export default function TextReveal() {
    const containerRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLSpanElement>(null);

    useGSAP(
        () => {
            if (textRef.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
                gsap.to(textRef.current, {
                    backgroundSize: "200% 200%",
                    ease: "none",
                    scrollTrigger: {
                        trigger: containerRef.current,
                        start: "top 80%",
                        end: "bottom 10%",
                        scrub: true,
                    },
                });
            }
        },
        { scope: containerRef }
    );

    return (
        <div ref={containerRef} className="page min-h-[50vh] flex flex-col items-center justify-center bg-black text-white font-sans py-16 md:py-20 px-4 md:px-6 overflow-hidden">
            <style jsx>{`
        .fill-text {
          margin: 0;
          font-size: clamp(22px, 4vw, 48px);
          font-weight: 600;
          line-height: 1.15;
          letter-spacing: -0.01em;
          text-wrap: pretty;
          text-align: center;
          max-width: 980px;
        }

        .fill-text > span {
          -webkit-background-clip: text;
          background-clip: text;
          background-color: #3f434a;
          background-image: linear-gradient(135deg, #f3f4f6 50%, #3f434a 60%);
          background-position: 0 0;
          background-repeat: no-repeat;
          background-size: 0% 200%;
          color: transparent;
          display: inline;
          will-change: background-size;
        }
      `}</style>

            <section className="hero max-w-[980px]">
                <p className="fill-text js-fill">
                    <span ref={textRef}>
                        Cam4U bridges the gap between passive recording and active intelligence. Powered by a custom YOLO26m architecture and state-of-the-art I3D neural networks, we process both spatial objects and temporal movement in real-time. From detecting harmful objects to recognizing dangerous anomalies, Cam4U instantly evaluates threats, secures the evidence via cloud infrastructure, and alerts you instantly. It's not just surveillance; it's total peace of mind.
                    </span>
                </p>
            </section>

            <div className="mt-32">
                <a className="credit inline-block px-4 py-2 rounded-full bg-white/10 backdrop-blur-md text-xs uppercase tracking-wider text-gray-400 hover:text-white transition-colors" href="#" target="_blank" rel="noopener">
                    Powered by Cam4U AI
                </a>
            </div>
        </div>
    );
}
