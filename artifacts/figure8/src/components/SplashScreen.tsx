import { useEffect, useState } from "react";
import fsLogo from "@assets/IMG_1811_1777157850143_no_bg.png";

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [phase, setPhase] = useState<"enter" | "hold" | "exit" | "done">("enter");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("hold"), 200);
    const t2 = setTimeout(() => setPhase("exit"), 2200);
    const t3 = setTimeout(() => {
      setPhase("done");
      onComplete();
    }, 3100);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onComplete]);

  if (phase === "done") return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        pointerEvents: phase === "exit" ? "none" : "all",
        transform: phase === "exit" ? "translateY(-100%)" : "translateY(0)",
        transition: phase === "exit" ? "transform 0.9s cubic-bezier(0.76, 0, 0.24, 1)" : "none",
        backgroundColor: "#1a0f08",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Top thin bar */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", backgroundColor: "#3d2b1a" }}>
        <div
          style={{
            height: "100%",
            backgroundColor: "#c9a882",
            transition: phase === "hold" || phase === "exit" ? "width 2.2s ease-out" : "none",
            width: phase === "enter" ? "0%" : "100%",
          }}
        />
      </div>

      {/* FS logo reveal */}
      <div
        style={{
          marginBottom: "1.75rem",
          overflow: "hidden",
          clipPath: phase === "enter"
            ? "inset(100% 0 0 0)"
            : "inset(0% 0 0 0)",
          transition: phase !== "enter"
            ? "clip-path 0.9s cubic-bezier(0.76, 0, 0.24, 1)"
            : "none",
        }}
      >
        <img
          src={fsLogo}
          alt="FS logo"
          style={{
            display: "block",
            width: "clamp(3.5rem, 8vw, 6rem)",
            height: "clamp(3.5rem, 8vw, 6rem)",
            objectFit: "contain",
            userSelect: "none",
          }}
          draggable={false}
        />
      </div>

      {/* Logo reveal */}
      <div
        style={{
          overflow: "hidden",
          clipPath: phase === "enter"
            ? "inset(100% 0 0 0)"
            : "inset(0% 0 0 0)",
          transition: phase !== "enter"
            ? "clip-path 0.9s cubic-bezier(0.76, 0, 0.24, 1)"
            : "none",
        }}
      >
        <div
          style={{
            fontFamily: "'Georgia', 'Times New Roman', serif",
            fontSize: "clamp(3rem, 8vw, 7rem)",
            fontWeight: 300,
            color: "#f5ede3",
            letterSpacing: "0.25em",
            lineHeight: 1,
            userSelect: "none",
          }}
        >
          FIGURE 8
        </div>
      </div>

      {/* Tagline */}
      <div
        style={{
          marginTop: "1.5rem",
          overflow: "hidden",
          clipPath: phase === "enter"
            ? "inset(100% 0 0 0)"
            : "inset(0% 0 0 0)",
          transition: phase !== "enter"
            ? "clip-path 0.9s 0.15s cubic-bezier(0.76, 0, 0.24, 1)"
            : "none",
        }}
      >
        <p
          style={{
            fontFamily: "'Georgia', serif",
            fontSize: "clamp(0.7rem, 1.5vw, 0.9rem)",
            fontWeight: 300,
            color: "#9b7d65",
            letterSpacing: "0.4em",
            textTransform: "uppercase",
          }}
        >
          Premium Athleisure
        </p>
      </div>

      {/* Bottom corner text */}
      <div
        style={{
          position: "absolute",
          bottom: "2rem",
          left: "2.5rem",
          fontFamily: "sans-serif",
          fontSize: "0.65rem",
          color: "#4a3728",
          letterSpacing: "0.3em",
          textTransform: "uppercase",
        }}
      >
        New York City
      </div>
      <div
        style={{
          position: "absolute",
          bottom: "2rem",
          right: "2.5rem",
          fontFamily: "sans-serif",
          fontSize: "0.65rem",
          color: "#4a3728",
          letterSpacing: "0.3em",
          textTransform: "uppercase",
        }}
      >
        Est. 2024
      </div>
    </div>
  );
}
