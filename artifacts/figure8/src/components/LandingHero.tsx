import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import MainPhoto from "@assets/Main_Profile_Photo_1776198255495.jpg";

export function LandingHero() {
  const [scrollY, setScrollY] = useState(0);
  const [progress, setProgress] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let animating = true;
    const start = Date.now();
    const duration = 2800;
    const tick = () => {
      if (!animating) return;
      const elapsed = Date.now() - start;
      setProgress(Math.min(elapsed / duration, 1));
      if (elapsed < duration) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return () => { animating = false; };
  }, []);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const parallaxY = scrollY * 0.3;

  return (
    <section
      ref={ref}
      style={{ height: "100vh", position: "relative", overflow: "hidden", background: "#0d0806" }}
    >
      {/* Background — Main Photo with parallax */}
      <div
        style={{
          position: "absolute",
          inset: "-10% 0",
          transform: `translateY(${parallaxY}px)`,
          willChange: "transform",
        }}
      >
        <img
          src={MainPhoto}
          alt="Figure 8 Collection"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center top",
            opacity: visible ? 1 : 0,
            transition: "opacity 1.2s ease",
          }}
        />
      </div>

      {/* Dark gradient overlay */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: "linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.55) 100%)",
      }} />

      {/* Top thin progress bar */}
      <div style={{
        position: "absolute",
        top: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: "120px",
        height: "1.5px",
        background: "rgba(255,255,255,0.2)",
        zIndex: 10,
      }}>
        <div style={{
          height: "100%",
          background: "rgba(255,255,255,0.85)",
          width: `${progress * 100}%`,
          transition: "width 0.05s linear",
        }} />
      </div>

      {/* Top navigation */}
      <nav style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        padding: "2rem 2.5rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        zIndex: 20,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(-10px)",
        transition: "opacity 0.8s 0.4s ease, transform 0.8s 0.4s ease",
      }}>
        {/* Logo */}
        <div style={{
          fontFamily: "'Georgia', 'Times New Roman', serif",
          fontStyle: "italic",
          fontWeight: 400,
          fontSize: "clamp(1.1rem, 2vw, 1.4rem)",
          color: "#fff",
          letterSpacing: "0.05em",
          userSelect: "none",
        }}>
          figure 8.
        </div>

        {/* Nav links */}
        <div style={{ display: "flex", gap: "2.5rem", alignItems: "center" }}>
          <Link href="/shop">
            <span style={{
              fontFamily: "sans-serif",
              fontSize: "0.7rem",
              fontWeight: 600,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "#fff",
              cursor: "pointer",
            }}>
              Shop Now
            </span>
          </Link>
          <Link href="/cart">
            <span style={{
              fontFamily: "sans-serif",
              fontSize: "0.7rem",
              fontWeight: 600,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "#fff",
              cursor: "pointer",
            }}>
              Cart
            </span>
          </Link>
        </div>
      </nav>

      {/* Left — 01 label */}
      <div
        style={{
          position: "absolute",
          left: "2rem",
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 10,
          opacity: visible ? 1 : 0,
          transition: "opacity 0.8s 0.6s ease",
        }}
      >
        <span style={{
          fontFamily: "'Georgia', serif",
          fontStyle: "italic",
          fontSize: "0.8rem",
          color: "rgba(255,255,255,0.6)",
          letterSpacing: "0.1em",
        }}>01</span>
      </div>

      {/* Right — 03 label */}
      <div
        style={{
          position: "absolute",
          right: "4rem",
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 10,
          opacity: visible ? 1 : 0,
          transition: "opacity 0.8s 0.7s ease",
        }}
      >
        <span style={{
          fontFamily: "'Georgia', serif",
          fontStyle: "italic",
          fontSize: "0.8rem",
          color: "rgba(255,255,255,0.6)",
          letterSpacing: "0.1em",
        }}>03</span>
      </div>

      {/* Far right — Scroll label (rotated) */}
      <div
        style={{
          position: "absolute",
          right: "1.5rem",
          top: "50%",
          transform: "translateY(-50%) rotate(90deg)",
          transformOrigin: "center center",
          zIndex: 10,
          opacity: visible ? 1 : 0,
          transition: "opacity 0.8s 0.8s ease",
        }}
      >
        <span style={{
          fontFamily: "sans-serif",
          fontSize: "0.6rem",
          fontWeight: 500,
          letterSpacing: "0.25em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.5)",
        }}>Scroll</span>
      </div>

      {/* Bottom-left — Main CTA text */}
      <div
        style={{
          position: "absolute",
          bottom: "2.5rem",
          left: "2.5rem",
          zIndex: 10,
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(20px)",
          transition: "opacity 0.9s 0.5s ease, transform 0.9s 0.5s ease",
        }}
      >
        <Link href="/shop">
          <div style={{ cursor: "pointer" }}>
            <p style={{
              fontFamily: "sans-serif",
              fontSize: "clamp(0.65rem, 1.2vw, 0.75rem)",
              fontWeight: 600,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.75)",
              marginBottom: "0.35rem",
            }}>
              Shop Now
            </p>
            <h2 style={{
              fontFamily: "sans-serif",
              fontSize: "clamp(2.2rem, 5.5vw, 4.5rem)",
              fontWeight: 800,
              lineHeight: 1.0,
              letterSpacing: "-0.01em",
              textTransform: "uppercase",
              color: "#fff",
              margin: 0,
            }}>
              Power in<br />Every Curve
            </h2>
          </div>
        </Link>
      </div>

      {/* Scroll indicator — animated chevron */}
      <div
        style={{
          position: "absolute",
          bottom: "2rem",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 10,
          opacity: visible ? 0.6 : 0,
          transition: "opacity 0.8s 1.2s ease",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "4px",
        }}
      >
        <div style={{
          width: "1px",
          height: "40px",
          background: "linear-gradient(to bottom, transparent, rgba(255,255,255,0.7))",
          animation: "scrollPulse 1.8s ease-in-out infinite",
        }} />
        <style>{`
          @keyframes scrollPulse {
            0%, 100% { opacity: 0.3; transform: scaleY(0.8); }
            50% { opacity: 0.9; transform: scaleY(1); }
          }
        `}</style>
      </div>
    </section>
  );
}
