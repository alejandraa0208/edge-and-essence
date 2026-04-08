"use client";

import Image from "next/image";
import { useState } from "react";

export default function HomePage() {
  const [hovered, setHovered] = useState(false);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "radial-gradient(circle at center, #111 0%, #000 70%)",
        display: "grid",
        placeItems: "center",
        padding: 24,
        overflow: "hidden",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 980, width: "100%" }}>
        {/* 3D space */}
        <div
          style={{
            perspective: "1200px",
            width: "100%",
            display: "flex",
            justifyContent: "center",
          }}
        >
          {/* Constant elegant 3D spin */}
          <div
            style={{
              transformStyle: "preserve-3d",
              animation: "spin3d 16s linear infinite, breatheGlow 3.6s ease-in-out infinite",
              willChange: "transform",
            }}
          >
            <Image
              src="/logo.png"
              alt="Edge & Essence Hair Studio"
              width={800}
              height={800}
              priority
              style={{
                width: "min(520px, 85vw)",
                height: "auto",
                display: "block",
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
                filter: "drop-shadow(0 0 28px rgba(212,175,55,0.22))",
              }}
            />
          </div>
        </div>

        {/* Divider line */}
        <div
          style={{
            height: 1,
            width: "min(560px, 82vw)",
            margin: "4px auto 0",
            background:
              "linear-gradient(90deg, rgba(212,175,55,0) 0%, rgba(212,175,55,0.7) 40%, rgba(212,175,55,0.7) 60%, rgba(212,175,55,0) 100%)",
            opacity: 0.9,
          }}
        />

        <h1
          style={{
            marginTop: 6,
            marginBottom: 10,
            letterSpacing: 10,
            color: "#d4af37",
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: 34,
            fontWeight: 500,
          }}
        >
          COMING SOON
        </h1>

        <p
          style={{
            margin: 0,
            color: "#caa64a",
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: 18,
            opacity: 0.9,
          }}
        >
          Luxury Braiding & Natural Hair Studio
        </p>

        <p
          style={{
            marginTop: 12,
            marginBottom: 0,
            color: "rgba(212, 175, 55, 0.85)",
            fontFamily: "Gerogia, 'Times New Roman', serif",
            fontSize: 16,
            letterSpacing: 1.5,
          }}
        >
          Park Place Mall
        </p>

        <p
          style={{
            marginTop: 10,
            marginBottom: 0,
            color: "rgba(212,175,55,0.65)",
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: 14,
            letterSpacing: 1.2,
          }}
        >
          Tucson, Arizona
        </p>

        <div style={{ marginTop: 34, display: "flex", justifyContent: "center" }}>
          <a
            href="https://instagram.com/edgeandessencetucson"
            target="_blank"
            rel="noopener noreferrer"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
              padding: "14px 30px",
              borderRadius: 999,
              border: "1px solid rgba(212,175,55,0.75)",
              color: hovered ? "#000" : "rgba(212,175,55,0.95)",
              background: hovered ? "rgba(212,175,55,0.95)" : "transparent",
              textDecoration: "none",
              fontFamily: "Georgia, 'Times New Roman', serif",
              letterSpacing: 2.4,
              fontSize: 13,
              transition: "all 420ms ease",
              boxShadow: hovered ? "0 10px 30px rgba(212,175,55,0.18)" : "none",
            }}
          >
            FOLLOW ON INSTAGRAM
          </a>
        </div>

        <style jsx>{`
          @keyframes spin3d {
            0% {
              transform: rotateY(0deg) rotateX(0deg);
            }
            100% {
              transform: rotateY(360deg) rotateX(0deg);
            }
          }

          @keyframes breatheGlow {
            0% {
              filter: drop-shadow(0 0 16px rgba(212, 175, 55, 0.14));
            }
            50% {
              filter: drop-shadow(0 0 34px rgba(212, 175, 55, 0.26));
            }
            100% {
              filter: drop-shadow(0 0 16px rgba(212, 175, 55, 0.14));
            }
          }
        `}</style>
      </div>
    </main>
  );
}
