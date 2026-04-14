import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import MainPhoto from "@assets/Main_Profile_Photo_1776199292804.jpg";
import ArmPhoto from "@assets/f8arm_1776199292804.JPG";
import BrownYogaPhoto from "@assets/Brown_Set_Yoga_Class_1776199933371.png";
import CreamGymPhoto from "@assets/Cream_Set_Gym_Pic_1776199933371.png";

interface Panel {
  id: number;
  label: string;
  image: string;
  objectPosition: string;
  ctaLine1: string;
  ctaLine2: string;
  href?: string;
  external?: boolean;
  navigatesOnClick?: boolean;
}

const PANELS: Panel[] = [
  {
    id: 1,
    label: "01",
    image: MainPhoto,
    objectPosition: "center top",
    ctaLine1: "Shop Now",
    ctaLine2: "Power in\nEvery Curve",
  },
  {
    id: 2,
    label: "02",
    image: ArmPhoto,
    objectPosition: "center center",
    ctaLine1: "About Us",
    ctaLine2: "Designed for\nEvery Body",
    href: "/about",
    navigatesOnClick: true,
  },
  {
    id: 3,
    label: "03",
    image: BrownYogaPhoto,
    objectPosition: "center top",
    ctaLine1: "New Arrivals",
    ctaLine2: "Move in Every\nDirection",
  },
  {
    id: 4,
    label: "04",
    image: CreamGymPhoto,
    objectPosition: "center center",
    ctaLine1: "Community",
    ctaLine2: "Follow Us on\nInstagram",
    href: "https://www.instagram.com",
    external: true,
    navigatesOnClick: true,
  },
];

const PANEL_POSITIONS: { left?: string; right?: string }[] = [
  { left: "1.5rem" },
  { left: "25%" },
  { left: "50%" },
  { right: "4.5rem" },
];

export function LandingHero() {
  const [activePanel, setActivePanel] = useState(0);
  const [hoveredPanel, setHoveredPanel] = useState<number | null>(null);
  const [ctaVisible, setCtaVisible] = useState(true);
  const [scrollY, setScrollY] = useState(0);
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const ctaFadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [, navigate] = useLocation();

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    return () => {
      if (ctaFadeRef.current) clearTimeout(ctaFadeRef.current);
    };
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

  const handleHover = (idx: number) => {
    setHoveredPanel(idx);
    if (idx === activePanel) return;
    setCtaVisible(false);
    if (ctaFadeRef.current) clearTimeout(ctaFadeRef.current);
    ctaFadeRef.current = setTimeout(() => {
      setActivePanel(idx);
      setCtaVisible(true);
    }, 220);
  };

  const handleLeave = () => {
    setHoveredPanel(null);
    if (ctaFadeRef.current) {
      clearTimeout(ctaFadeRef.current);
      ctaFadeRef.current = null;
      setCtaVisible(true);
    }
  };

  const handleClick = (panel: Panel, idx: number) => {
    if (!panel.navigatesOnClick) {
      handleHover(idx);
      return;
    }
    if (panel.external && panel.href) {
      window.open(panel.href, "_blank", "noopener,noreferrer");
    } else if (panel.href) {
      navigate(panel.href);
    }
  };

  const handleCtaClick = () => {
    const panel = PANELS[activePanel];
    if (panel.external && panel.href) {
      window.open(panel.href, "_blank", "noopener,noreferrer");
    } else if (panel.href) {
      navigate(panel.href);
    }
  };

  const parallaxY = scrollY * 0.3;
  const currentPanel = PANELS[activePanel];

  return (
    <section
      ref={ref}
      style={{ height: "100vh", position: "relative", overflow: "hidden", background: "#0d0806" }}
    >
      {/* All 4 background images — crossfade via opacity */}
      {PANELS.map((panel, idx) => (
        <div
          key={panel.id}
          style={{
            position: "absolute",
            inset: "-10% 0",
            transform: `translateY(${parallaxY}px)`,
            willChange: "transform",
            opacity: idx === activePanel ? 1 : 0,
            transition: "opacity 0.85s cubic-bezier(0.4, 0, 0.2, 1)",
            zIndex: idx === activePanel ? 1 : 0,
          }}
        >
          <img
            src={panel.image}
            alt={`Figure 8 — Panel ${panel.label}`}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: panel.objectPosition,
              opacity: visible ? 1 : 0,
              transition: "opacity 1.2s ease",
            }}
          />
        </div>
      ))}

      {/* Dark gradient */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: "linear-gradient(to bottom, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0.08) 40%, rgba(0,0,0,0.62) 100%)",
        zIndex: 2,
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

      {/* Panel number selectors */}
      {PANELS.map((panel, idx) => {
        const pos = PANEL_POSITIONS[idx];
        const isActive = idx === activePanel;
        const isHovered = hoveredPanel === idx;

        return (
          <div
            key={panel.id}
            style={{
              position: "absolute",
              top: "50%",
              left: pos.left,
              right: pos.right,
              transform: "translateY(-50%)",
              zIndex: 15,
              opacity: visible ? 1 : 0,
              transition: `opacity 0.8s ${0.5 + idx * 0.08}s ease`,
            }}
          >
            {/* Thumbnail preview */}
            <div
              style={{
                position: "absolute",
                bottom: "calc(100% + 1rem)",
                left: idx >= 3 ? "auto" : "50%",
                right: idx >= 3 ? "0" : "auto",
                transform: idx >= 3 ? "none" : "translateX(-50%)",
                width: "88px",
                height: "112px",
                overflow: "hidden",
                opacity: isHovered ? 1 : 0,
                pointerEvents: "none",
                transition: "opacity 0.18s ease",
                boxShadow: "0 4px 20px rgba(0,0,0,0.55)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              <img
                src={panel.image}
                alt={`Preview ${panel.label}`}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: panel.objectPosition,
                }}
              />
            </div>

            {/* Number button */}
            <button
              onClick={() => handleClick(panel, idx)}
              onMouseEnter={() => handleHover(idx)}
              onMouseLeave={handleLeave}
              style={{
                background: "none",
                border: "none",
                padding: "0.5rem",
                cursor: "pointer",
                fontFamily: "'Georgia', serif",
                fontStyle: "italic",
                fontSize: isActive ? "1rem" : "0.8rem",
                color: isActive
                  ? "rgba(255,255,255,1)"
                  : isHovered
                  ? "rgba(255,255,255,0.75)"
                  : "rgba(255,255,255,0.4)",
                letterSpacing: "0.1em",
                transition: "color 0.2s ease, font-size 0.2s ease",
                display: "block",
                lineHeight: 1,
              }}
            >
              {panel.label}
            </button>
          </div>
        );
      })}

      {/* Scroll label */}
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

      {/* Bottom-left CTA */}
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
        <div onClick={handleCtaClick} style={{ cursor: "pointer" }}>
          <p style={{
            fontFamily: "sans-serif",
            fontSize: "clamp(0.65rem, 1.2vw, 0.75rem)",
            fontWeight: 600,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.75)",
            marginBottom: "0.35rem",
            opacity: ctaVisible ? 1 : 0,
            transition: "opacity 0.22s ease",
          }}>
            {currentPanel.ctaLine1}
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
            whiteSpace: "pre-line",
            opacity: ctaVisible ? 1 : 0,
            transition: "opacity 0.22s ease",
          }}>
            {currentPanel.ctaLine2}
          </h2>
        </div>
      </div>

      {/* Scroll indicator */}
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
