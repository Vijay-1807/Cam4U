"use client";

import React, { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger);

export default function ImageReveal() {
    const containerRef = useRef<HTMLDivElement>(null);

    useGSAP(
        () => {
            const lines = gsap.utils.toArray<HTMLElement>(".reveal-line");

            lines.forEach((line) => {
                const imgSpan = line.querySelector(".img-span");

                if (imgSpan) {
                    const isMobile = window.innerWidth < 768;
                    const maxImgWidth = isMobile ? 120 : 300;
                    
                    gsap.to(imgSpan, {
                        width: maxImgWidth,
                        ease: "none",
                        scrollTrigger: {
                            trigger: line,
                            start: "top 80%",
                            end: "top 30%",
                            scrub: 1,
                        },
                    });
                }
            });
        },
        { scope: containerRef }
    );

    return (
        <div ref={containerRef} className="bg-white text-black min-h-screen w-full flex flex-col justify-center items-center py-24 overflow-hidden">
            <style jsx>{`
        .line {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: clamp(8px, 2vw, 20px);
          margin-bottom: clamp(1rem, 3vw, 2rem);
          flex-wrap: wrap;
        }
        .line span {
          font-size: clamp(2rem, 8vw, 7.5rem);
          font-weight: 700;
          letter-spacing: clamp(-1px, -0.5vw, -4px);
          display: inline-block;
          overflow: hidden;
          line-height: 1;
        }
        .img-span {
          height: clamp(50px, 10vw, 110px);
          width: 0;
          border-radius: 5px;
          overflow: hidden;
          position: relative;
        }
        .img-span img {
          height: 100%;
          width: clamp(120px, 20vw, 300px);
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          border-radius: 5px;
          object-fit: cover;
          object-position: center center;
        }
      `}</style>

            <div className="reveal-container w-full max-w-7xl mx-auto">
                <div className="reveal-line line">
                    <span>We craft</span>
                    <span className="img-span">
                        <img
                            src="https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=2070&ixlib=rb-4.0.3"
                            alt="Cybersecurity"
                        />
                    </span>
                    <span>security</span>
                </div>
                <div className="reveal-line line">
                    <span>solutions</span>
                    <span className="img-span">
                        <img
                            src="https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?auto=format&fit=crop&q=80&w=2070&ixlib=rb-4.0.3"
                            alt="Code"
                        />
                    </span>
                    <span>that</span>
                </div>
                <div className="reveal-line line">
                    <span>protect</span>
                    <span className="img-span">
                        <img
                            src="https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&q=80&w=1470&ixlib=rb-4.0.3"
                            alt="Digital Lock"
                        />
                    </span>
                </div>
                <div className="reveal-line line">
                    <span>and move</span>
                </div>
                <div className="reveal-line line">
                    <span>future</span>
                    <span className="img-span">
                        <img
                            src="https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=2072&ixlib=rb-4.0.3"
                            alt="Future Tech"
                        />
                    </span>
                    <span>forward.</span>
                </div>
            </div>
        </div>
    );
}
