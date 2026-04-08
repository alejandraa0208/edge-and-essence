"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";

const SERVICES = [
  { icon: "✦", name: "Box Braids", desc: "Knotless, classic, boho & more" },
  { icon: "✦", name: "Locs", desc: "Starter locs, retwist, detox & styling" },
  { icon: "✦", name: "Natural Hair", desc: "Wash & go, silk press, twist sets" },
  { icon: "✦", name: "Protective Styles", desc: "Crochet, faux locs, weaves & more" },
  { icon: "✦", name: "Cuts & Color", desc: "Trims, cuts, and color services" },
  { icon: "✦", name: "Hair Care", desc: "Steam treatments, scalp care & more" },
];

export default function HomePage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Jost:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; background: #faf9f7; }

        .marble-hero {
          position: relative;
          min-height: 100vh;
          background: linear-gradient(160deg, rgba(250,249,247,0.97) 0%, rgba(245,240,235,0.95) 50%, rgba(240,235,230,0.97) 100%);
          overflow: hidden;
        }
        .marble-hero::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='800'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.5' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='800' height='800' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E");
          pointer-events: none;
        }
        .marble-hero::after {
          content: '';
          position: absolute;
          top: -200px; right: -200px;
          width: 600px; height: 600px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(201,168,76,0.08) 0%, transparent 70%);
          pointer-events: none;
        }

        .nav {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 100;
          padding: 18px 40px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          transition: all 0.4s ease;
        }
        .nav.scrolled {
          background: rgba(250,249,247,0.94);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(201,168,76,0.2);
          padding: 14px 40px;
        }

        .gold-btn {
          display: inline-block;
          padding: 14px 36px;
          border-radius: 999px;
          background: linear-gradient(135deg, #C9A84C, #e8c96a);
          color: #1a1208;
          font-family: 'Jost', sans-serif;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          text-decoration: none;
          transition: all 0.3s ease;
          box-shadow: 0 4px 20px rgba(201,168,76,0.35);
        }
        .gold-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 28px rgba(201,168,76,0.45);
        }

        .outline-btn {
          display: inline-block;
          padding: 14px 36px;
          border-radius: 999px;
          border: 1px solid rgba(201,168,76,0.6);
          color: #8a6d1e;
          font-family: 'Jost', sans-serif;
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          text-decoration: none;
          transition: all 0.3s ease;
        }
        .outline-btn:hover {
          background: rgba(201,168,76,0.08);
          border-color: #C9A84C;
        }

        .service-card {
          background: white;
          border: 1px solid rgba(201,168,76,0.15);
          border-radius: 16px;
          padding: 28px 24px;
          transition: all 0.3s ease;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
        .service-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 24px rgba(201,168,76,0.15);
          border-color: rgba(201,168,76,0.4);
        }

        .why-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          text-align: center;
        }

        @keyframes floatLogo {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
      `}</style>

      {/* NAV */}
      <nav className={`nav ${scrolled ? "scrolled" : ""}`}>
        <span style={{ fontFamily: "Georgia, serif", fontSize: 16, color: "#C9A84C", letterSpacing: "0.2em" }}>
          EDGE & ESSENCE
        </span>
        <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
          <Link href="/stylists" style={{ fontFamily: "'Jost', sans-serif", fontSize: 13, color: "#7a6a5a", textDecoration: "none", letterSpacing: "0.08em" }}>
            Our Stylists
          </Link>
          <Link href="/stylists" className="gold-btn" style={{ padding: "10px 24px", fontSize: 11 }}>
            Book Now
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="marble-hero" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "120px 24px 80px" }}>
        <div style={{ textAlign: "center", maxWidth: 700, position: "relative", zIndex: 1 }}>
          <div style={{ marginBottom: 40, display: "flex", justifyContent: "center" }}>
            <div style={{ animation: "floatLogo 6s ease-in-out infinite" }}>
              <Image
                src="/logo.png"
                alt="Edge & Essence Hair Studio"
                width={200}
                height={200}
                priority
                style={{ width: "min(200px, 50vw)", height: "auto", filter: "drop-shadow(0 8px 24px rgba(201,168,76,0.25))" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 20 }}>
            <div style={{ height: 1, width: 50, background: "linear-gradient(90deg, transparent, #C9A84C)" }} />
            <span style={{ fontFamily: "'Jost', sans-serif", fontSize: 11, letterSpacing: "0.3em", color: "#C9A84C", textTransform: "uppercase" }}>
              Luxury Hair Studio · Tucson, AZ
            </span>
            <div style={{ height: 1, width: 50, background: "linear-gradient(90deg, #C9A84C, transparent)" }} />
          </div>

          <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "clamp(42px, 8vw, 72px)", fontWeight: 300, color: "#1a1208", margin: "0 0 16px", lineHeight: 1.1, letterSpacing: "0.03em" }}>
            Your Hair,<br />
            <em style={{ color: "#C9A84C" }}>Elevated.</em>
          </h1>

          <p style={{ fontFamily: "'Jost', sans-serif", fontSize: 16, color: "#7a6a5a", margin: "0 0 40px", lineHeight: 1.8, fontWeight: 300, maxWidth: 480, marginLeft: "auto", marginRight: "auto" }}>
            Specializing in braids, locs, and natural hair care.
            Expert stylists. Personalized service. Located at Park Place Mall.
          </p>

          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/stylists" className="gold-btn">Book an Appointment</Link>
            <a href="https://instagram.com/edgeandessenceaz" target="_blank" rel="noopener noreferrer" className="outline-btn">
              Follow Us
            </a>
          </div>

          <div style={{ marginTop: 64, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, opacity: 0.4 }}>
            <div style={{ width: 1, height: 40, background: "linear-gradient(180deg, transparent, #C9A84C)" }} />
            <span style={{ fontFamily: "'Jost', sans-serif", fontSize: 10, letterSpacing: "0.2em", color: "#C9A84C", textTransform: "uppercase" }}>Scroll</span>
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section style={{ background: "white", padding: "80px 24px", borderTop: "1px solid rgba(201,168,76,0.15)", borderBottom: "1px solid rgba(201,168,76,0.15)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <p style={{ fontFamily: "'Jost', sans-serif", fontSize: 11, letterSpacing: "0.3em", color: "#C9A84C", textTransform: "uppercase", marginBottom: 12 }}>What We Do</p>
            <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 400, color: "#1a1208", margin: 0 }}>Our Services</h2>
            <div style={{ height: 1, maxWidth: 160, background: "linear-gradient(90deg, transparent, rgba(201,168,76,0.5), transparent)", margin: "20px auto 0" }} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 20 }}>
            {SERVICES.map((s, i) => (
              <div key={s.name} className="service-card">
                <div style={{ color: i % 2 === 0 ? "#C9A84C" : "#4A2570", fontSize: 18, marginBottom: 12 }}>{s.icon}</div>
                <div style={{ fontFamily: "'Jost', sans-serif", fontSize: 16, fontWeight: 500, color: "#1a1208", marginBottom: 6 }}>{s.name}</div>
                <div style={{ fontFamily: "'Jost', sans-serif", fontSize: 13, color: "#9a8a7a", lineHeight: 1.6, fontWeight: 300 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY US */}
      <section style={{ padding: "80px 24px", background: "#faf9f7" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
          <p style={{ fontFamily: "'Jost', sans-serif", fontSize: 11, letterSpacing: "0.3em", color: "#C9A84C", textTransform: "uppercase", marginBottom: 12 }}>The Experience</p>
          <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 400, color: "#1a1208", margin: "0 0 20px" }}>Why Edge & Essence</h2>
          <div style={{ height: 1, maxWidth: 160, background: "linear-gradient(90deg, transparent, rgba(201,168,76,0.5), transparent)", margin: "0 auto 48px" }} />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 40 }}>
            {[
              { icon: "✦", title: "Expert Stylists", desc: "Each stylist specializes in their craft with years of experience in braiding, locs, and natural hair." },
              { icon: "◈", title: "Online Booking", desc: "Book your appointment anytime. No calls, no waiting — just pick your stylist and time." },
              { icon: "◇", title: "Deposit Protected", desc: "Secure your appointment with a small deposit. Professional policies protect everyone." },
              { icon: "✧", title: "Park Place Mall", desc: "Conveniently located at Park Place Mall in Tucson. Easy parking, easy access." },
            ].map((item, i) => (
              <div key={item.title} className="why-card">
                <div style={{
                  width: 48, height: 48, borderRadius: "50%",
                  background: i % 2 === 0 ? "rgba(201,168,76,0.1)" : "rgba(74,37,112,0.08)",
                  border: `1px solid ${i % 2 === 0 ? "rgba(201,168,76,0.25)" : "rgba(74,37,112,0.2)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: i % 2 === 0 ? "#C9A84C" : "#4A2570",
                  fontSize: 18,
                }}>
                  {item.icon}
                </div>
                <div style={{ fontFamily: "'Jost', sans-serif", fontSize: 15, fontWeight: 500, color: "#1a1208" }}>{item.title}</div>
                <div style={{ fontFamily: "'Jost', sans-serif", fontSize: 13, color: "#9a8a7a", lineHeight: 1.7, fontWeight: 300 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "80px 24px", background: "linear-gradient(135deg, #1a1208 0%, #2a1e0a 100%)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(201,168,76,0.1) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center", position: "relative", zIndex: 1 }}>
          <p style={{ fontFamily: "'Jost', sans-serif", fontSize: 11, letterSpacing: "0.3em", color: "#C9A84C", textTransform: "uppercase", marginBottom: 16 }}>Ready?</p>
          <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "clamp(32px, 6vw, 52px)", fontWeight: 300, color: "#faf9f7", margin: "0 0 16px", lineHeight: 1.2 }}>
            Book Your Visit Today
          </h2>
          <p style={{ fontFamily: "'Jost', sans-serif", fontSize: 15, color: "rgba(250,249,247,0.55)", margin: "0 0 36px", lineHeight: 1.7, fontWeight: 300 }}>
            Choose your stylist, pick a time, and leave the rest to us.
          </p>
          <Link href="/stylists" className="gold-btn">Meet Our Stylists</Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: "#1a1208", padding: "40px 24px", borderTop: "1px solid rgba(201,168,76,0.15)" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ fontFamily: "Georgia, serif", fontSize: 16, color: "#C9A84C", letterSpacing: "0.2em", marginBottom: 6 }}>EDGE & ESSENCE</div>
            <div style={{ fontFamily: "'Jost', sans-serif", fontSize: 12, color: "rgba(201,168,76,0.45)", letterSpacing: "0.1em" }}>Hair Studio · Park Place Mall · Tucson, AZ</div>
          </div>
          <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
            <a href="https://instagram.com/edgeandessenceaz" target="_blank" rel="noopener noreferrer" style={{ fontFamily: "'Jost', sans-serif", fontSize: 12, color: "rgba(201,168,76,0.6)", textDecoration: "none", letterSpacing: "0.1em" }}>
              Instagram ↗
            </a>
            <Link href="/stylists" style={{ fontFamily: "'Jost', sans-serif", fontSize: 12, color: "rgba(201,168,76,0.6)", textDecoration: "none", letterSpacing: "0.1em" }}>
              Book Now ↗
            </Link>
          </div>
        </div>
      </footer>
    </>
  );
}