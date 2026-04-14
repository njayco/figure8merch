import CreamGymPhoto from "@assets/Cream_Set_Gym_Pic_1776199933371.png";
import BrownYogaPhoto from "@assets/Brown_Set_Yoga_Class_1776199933371.png";

export function Community() {
  return (
    <main style={{ width: "100%", background: "#f5f0e8" }}>

      {/* Hero */}
      <section style={{
        position: "relative",
        height: "100vh",
        overflow: "hidden",
        background: "#1a1008",
      }}>
        <img
          src={CreamGymPhoto}
          alt="Figure 8 Community"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center center",
          }}
        />
        <div style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.05) 40%, rgba(0,0,0,0.72) 100%)",
        }} />

        <div style={{
          position: "absolute",
          top: "2rem",
          left: "2.5rem",
          fontFamily: "'Georgia','Times New Roman',serif",
          fontStyle: "italic",
          fontSize: "1.5rem",
          color: "#f5f0e8",
          letterSpacing: "0.02em",
        }}>
          figure 8.
        </div>

        <div style={{
          position: "absolute",
          bottom: "4rem",
          left: "2.5rem",
          right: "2.5rem",
        }}>
          <p style={{
            fontFamily: "'Georgia','Times New Roman',serif",
            fontSize: "clamp(0.65rem, 1vw, 0.8rem)",
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            color: "#c8b89a",
            marginBottom: "0.75rem",
          }}>
            04 / Community
          </p>
          <h1 style={{
            fontFamily: "'Georgia','Times New Roman',serif",
            fontStyle: "italic",
            fontSize: "clamp(3rem, 7vw, 5.5rem)",
            fontWeight: 400,
            color: "#f5f0e8",
            lineHeight: 1.05,
            letterSpacing: "-0.01em",
            margin: 0,
          }}>
            Move Together.
          </h1>
        </div>
      </section>

      {/* Intro copy */}
      <section style={{
        maxWidth: "820px",
        margin: "0 auto",
        padding: "6rem 2.5rem 5rem",
        textAlign: "center",
      }}>
        <p style={{
          fontFamily: "'Georgia','Times New Roman',serif",
          fontStyle: "italic",
          fontSize: "clamp(1.15rem, 2.5vw, 1.6rem)",
          color: "#3d2b1f",
          lineHeight: 1.65,
          marginBottom: "2rem",
        }}>
          Figure 8 is more than a brand — it's a circle of women who show up for
          themselves every single day. We train, we rest, we rise. Together.
        </p>
        <p style={{
          fontFamily: "'Helvetica Neue',Arial,sans-serif",
          fontSize: "0.9rem",
          letterSpacing: "0.06em",
          color: "#7a6352",
          lineHeight: 1.8,
        }}>
          Follow our journey, get first looks at new drops, and connect with
          the community that powers every piece we make.
        </p>
      </section>

      {/* Photo break */}
      <section style={{
        width: "100%",
        height: "clamp(320px, 50vw, 620px)",
        overflow: "hidden",
        position: "relative",
      }}>
        <img
          src={BrownYogaPhoto}
          alt="Figure 8 yoga class"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center 30%",
            display: "block",
          }}
        />
      </section>

      {/* Instagram CTA */}
      <section style={{
        background: "#2b1d13",
        padding: "6rem 2.5rem",
        textAlign: "center",
      }}>
        <p style={{
          fontFamily: "'Helvetica Neue',Arial,sans-serif",
          fontSize: "0.7rem",
          letterSpacing: "0.3em",
          textTransform: "uppercase",
          color: "#c8b89a",
          marginBottom: "1.5rem",
        }}>
          @figure8.official
        </p>
        <h2 style={{
          fontFamily: "'Georgia','Times New Roman',serif",
          fontStyle: "italic",
          fontSize: "clamp(2rem, 5vw, 3.5rem)",
          fontWeight: 400,
          color: "#f5f0e8",
          lineHeight: 1.1,
          margin: "0 auto 2.5rem",
          maxWidth: "600px",
        }}>
          Join us on Instagram
        </h2>
        <p style={{
          fontFamily: "'Helvetica Neue',Arial,sans-serif",
          fontSize: "0.875rem",
          color: "#a08878",
          letterSpacing: "0.04em",
          marginBottom: "2.5rem",
          maxWidth: "480px",
          margin: "0 auto 2.5rem",
        }}>
          Behind-the-scenes, new arrivals, community spotlights, and the
          moments that keep us moving.
        </p>
        <a
          href="https://www.instagram.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-block",
            padding: "1rem 2.75rem",
            border: "1px solid #c8b89a",
            fontFamily: "'Helvetica Neue',Arial,sans-serif",
            fontSize: "0.7rem",
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            color: "#f5f0e8",
            textDecoration: "none",
            transition: "background 0.25s, color 0.25s",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLAnchorElement).style.background = "#c8b89a";
            (e.currentTarget as HTMLAnchorElement).style.color = "#2b1d13";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
            (e.currentTarget as HTMLAnchorElement).style.color = "#f5f0e8";
          }}
        >
          Follow on Instagram
        </a>
      </section>

      {/* Contact nudge */}
      <section style={{
        padding: "4rem 2.5rem",
        textAlign: "center",
        background: "#f5f0e8",
      }}>
        <p style={{
          fontFamily: "'Helvetica Neue',Arial,sans-serif",
          fontSize: "0.8rem",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "#7a6352",
        }}>
          Questions? Reach us at{" "}
          <a
            href="mailto:F8merch@gmail.com"
            style={{ color: "#3d2b1f", textDecoration: "underline" }}
          >
            F8merch@gmail.com
          </a>
        </p>
      </section>

    </main>
  );
}
