import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Truck, RotateCcw, Droplets, MapPin, Mail, Phone } from "lucide-react";
import ArmPhoto from "@assets/f8arm_1776199292804.JPG";
import MainPhoto from "@assets/Main_Profile_Photo_1776199292804.jpg";

export function About() {
  return (
    <main className="w-full">

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section style={{
        position: "relative",
        height: "100vh",
        overflow: "hidden",
        background: "#0d0806",
      }}>
        <img
          src={ArmPhoto}
          alt="Figure 8 — Community"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center center",
          }}
        />
        {/* Gradient overlay */}
        <div style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.65) 100%)",
        }} />

        {/* Top-left logo */}
        <div style={{
          position: "absolute",
          top: "2rem",
          left: "2.5rem",
          fontFamily: "'Georgia', 'Times New Roman', serif",
          fontStyle: "italic",
          fontWeight: 400,
          fontSize: "1.25rem",
          color: "#fff",
          letterSpacing: "0.05em",
          zIndex: 10,
          userSelect: "none",
        }}>
          figure 8.
        </div>

        {/* Bottom-left headline */}
        <div style={{
          position: "absolute",
          bottom: "2.5rem",
          left: "2.5rem",
          zIndex: 10,
        }}>
          <p style={{
            fontFamily: "sans-serif",
            fontSize: "0.7rem",
            fontWeight: 600,
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.7)",
            marginBottom: "0.4rem",
          }}>
            About Us
          </p>
          <h1 style={{
            fontFamily: "sans-serif",
            fontSize: "clamp(2.2rem, 6vw, 5rem)",
            fontWeight: 800,
            lineHeight: 1.0,
            letterSpacing: "-0.01em",
            textTransform: "uppercase",
            color: "#fff",
            margin: 0,
          }}>
            Designed for<br />Every Body
          </h1>
        </div>
      </section>

      {/* ── Brand Story ──────────────────────────────────────────────── */}
      <section style={{
        display: "grid",
        gridTemplateColumns: "1fr 2fr",
        gap: 0,
        padding: "7rem 5rem",
        background: "#fff",
        alignItems: "start",
      }}
        className="grid-cols-1 md:grid-cols-[1fr_2fr]"
      >
        {/* Left — mark / logotype */}
        <div style={{
          paddingTop: "0.5rem",
        }}>
          <div style={{
            fontFamily: "'Georgia', 'Times New Roman', serif",
            fontStyle: "italic",
            fontSize: "clamp(4rem, 8vw, 7rem)",
            fontWeight: 300,
            color: "#3d2b1a",
            lineHeight: 1,
            letterSpacing: "-0.02em",
            userSelect: "none",
          }}>
            f8.
          </div>
        </div>

        {/* Right — statement */}
        <div>
          <p style={{
            fontFamily: "'Georgia', 'Times New Roman', serif",
            fontSize: "clamp(1.4rem, 2.5vw, 2.1rem)",
            fontWeight: 400,
            lineHeight: 1.45,
            color: "#1a1a1a",
            margin: 0,
          }}>
            Born from a shared vision of power and beauty, Figure 8 is a New York athleisure brand for women who refuse to choose between performance and style. We design for every curve, every stride, every moment that is unapologetically yours.
          </p>
          <div style={{
            marginTop: "3rem",
            borderTop: "1px solid #e5e0d8",
            paddingTop: "2rem",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "2rem",
          }}>
            <div>
              <p style={{
                fontFamily: "sans-serif",
                fontSize: "0.65rem",
                letterSpacing: "0.25em",
                textTransform: "uppercase",
                color: "#9b7d65",
                marginBottom: "0.5rem",
              }}>Founded</p>
              <p style={{
                fontFamily: "'Georgia', serif",
                fontSize: "1.1rem",
                color: "#1a1a1a",
              }}>New York City, 2024</p>
            </div>
            <div>
              <p style={{
                fontFamily: "sans-serif",
                fontSize: "0.65rem",
                letterSpacing: "0.25em",
                textTransform: "uppercase",
                color: "#9b7d65",
                marginBottom: "0.5rem",
              }}>Philosophy</p>
              <p style={{
                fontFamily: "'Georgia', serif",
                fontSize: "1.1rem",
                color: "#1a1a1a",
              }}>Power in Every Curve</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Full-width image break ────────────────────────────────────── */}
      <section style={{
        height: "65vh",
        overflow: "hidden",
        position: "relative",
      }}>
        <img
          src={MainPhoto}
          alt="Figure 8 Collection"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center top",
          }}
        />
        <div style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.15)",
        }} />
        <div style={{
          position: "absolute",
          bottom: "2.5rem",
          right: "2.5rem",
          fontFamily: "'Georgia', serif",
          fontStyle: "italic",
          fontSize: "1.1rem",
          color: "rgba(255,255,255,0.8)",
          letterSpacing: "0.05em",
        }}>
          Premium Athleisure
        </div>
      </section>

      {/* ── Info Pillars ─────────────────────────────────────────────── */}
      <section style={{
        padding: "6rem 2.5rem",
        background: "#faf8f5",
      }}>
        <div style={{
          maxWidth: "900px",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "3rem",
        }}
          className="grid-cols-1 md:grid-cols-3"
        >
          {[
            {
              icon: <Droplets className="h-5 w-5" />,
              title: "Care Instructions",
              body: "Gentle wash cold with like colors. Do not bleach. Air dry only — never tumble dry. This preserves the compressive integrity of our fabrics.",
            },
            {
              icon: <Truck className="h-5 w-5" />,
              title: "NYC Same-Day Delivery",
              body: "Available across Manhattan, Brooklyn, Queens, and the Bronx for orders over $150 placed before 2 PM EST.",
            },
            {
              icon: <MapPin className="h-5 w-5" />,
              title: "Designed in NY",
              body: "Every silhouette is meticulously prototyped and wear-tested in our New York studio before production.",
            },
          ].map(({ icon, title, body }) => (
            <div key={title}>
              <div style={{
                width: "2rem",
                height: "1px",
                background: "#3d2b1a",
                marginBottom: "1.5rem",
              }} />
              <div style={{ color: "#3d2b1a", marginBottom: "0.75rem" }}>{icon}</div>
              <h3 style={{
                fontFamily: "sans-serif",
                fontSize: "0.75rem",
                fontWeight: 700,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "#1a1a1a",
                marginBottom: "0.75rem",
              }}>{title}</h3>
              <p style={{
                fontFamily: "'Georgia', serif",
                fontSize: "0.95rem",
                lineHeight: 1.7,
                color: "#6b5c4e",
              }}>{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ + Contact ─────────────────────────────────────────────── */}
      <section style={{
        padding: "6rem 2.5rem",
        background: "#fff",
      }}>
        <div style={{
          maxWidth: "1000px",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "6rem",
          alignItems: "start",
        }}
          className="grid-cols-1 lg:grid-cols-2"
        >

          {/* FAQ */}
          <div>
            <p style={{
              fontFamily: "sans-serif",
              fontSize: "0.65rem",
              fontWeight: 700,
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              color: "#9b7d65",
              marginBottom: "1rem",
            }}>FAQ</p>
            <h2 style={{
              fontFamily: "'Georgia', serif",
              fontSize: "2.2rem",
              fontWeight: 400,
              color: "#1a1a1a",
              marginBottom: "2.5rem",
              lineHeight: 1.2,
            }}>Common Questions</h2>
            <Accordion type="single" collapsible className="w-full">
              {[
                {
                  q: "What is your return policy?",
                  a: "We accept returns for full refunds to the original payment method within 5 days of delivery. Items must be unworn, unwashed, and have original tags attached.",
                },
                {
                  q: "Do you offer store credit?",
                  a: "Yes — up to 365 days to return items for store credit, provided they meet our return conditions.",
                },
                {
                  q: "How long does shipping take?",
                  a: "Allow 2–5 business days for processing. Standard delivery takes 3–4 business days. NYC Same-Day is available for eligible orders.",
                },
                {
                  q: "How can I track my order?",
                  a: "Once your order ships, you'll receive an email with a tracking number and link.",
                },
              ].map(({ q, a }, i) => (
                <AccordionItem key={i} value={`item-${i}`} style={{ borderColor: "#e5e0d8" }}>
                  <AccordionTrigger style={{
                    fontFamily: "sans-serif",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    letterSpacing: "0.03em",
                    color: "#1a1a1a",
                    textAlign: "left",
                  }}>{q}</AccordionTrigger>
                  <AccordionContent style={{
                    fontFamily: "'Georgia', serif",
                    fontSize: "0.95rem",
                    lineHeight: 1.7,
                    color: "#6b5c4e",
                  }}>{a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          {/* Contact */}
          <div>
            <p style={{
              fontFamily: "sans-serif",
              fontSize: "0.65rem",
              fontWeight: 700,
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              color: "#9b7d65",
              marginBottom: "1rem",
            }}>Contact</p>
            <h2 style={{
              fontFamily: "'Georgia', serif",
              fontSize: "2.2rem",
              fontWeight: 400,
              color: "#1a1a1a",
              marginBottom: "1.5rem",
              lineHeight: 1.2,
            }}>Get in Touch</h2>
            <p style={{
              fontFamily: "'Georgia', serif",
              fontSize: "0.95rem",
              lineHeight: 1.7,
              color: "#6b5c4e",
              marginBottom: "2.5rem",
            }}>
              Questions about sizing, fit, or an existing order? Our concierge team is here to help.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
              <div style={{ borderTop: "1px solid #e5e0d8", paddingTop: "1.5rem" }}>
                <p style={{
                  fontFamily: "sans-serif",
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  letterSpacing: "0.25em",
                  textTransform: "uppercase",
                  color: "#9b7d65",
                  marginBottom: "0.4rem",
                }}>Email</p>
                <a
                  href="mailto:F8merch@gmail.com"
                  style={{
                    fontFamily: "'Georgia', serif",
                    fontSize: "1.05rem",
                    color: "#1a1a1a",
                    textDecoration: "none",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#9b7d65")}
                  onMouseLeave={e => (e.currentTarget.style.color = "#1a1a1a")}
                >
                  F8merch@gmail.com
                </a>
              </div>
              <div style={{ borderTop: "1px solid #e5e0d8", paddingTop: "1.5rem" }}>
                <p style={{
                  fontFamily: "sans-serif",
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  letterSpacing: "0.25em",
                  textTransform: "uppercase",
                  color: "#9b7d65",
                  marginBottom: "0.4rem",
                }}>Phone</p>
                <a
                  href="tel:786-967-9149"
                  style={{
                    fontFamily: "'Georgia', serif",
                    fontSize: "1.05rem",
                    color: "#1a1a1a",
                    textDecoration: "none",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#9b7d65")}
                  onMouseLeave={e => (e.currentTarget.style.color = "#1a1a1a")}
                >
                  (786) 967-9149
                </a>
                <p style={{
                  fontFamily: "sans-serif",
                  fontSize: "0.7rem",
                  color: "#9b7d65",
                  marginTop: "0.3rem",
                  letterSpacing: "0.1em",
                }}>Mon–Fri, 9am–5pm EST</p>
              </div>
              <div style={{ borderTop: "1px solid #e5e0d8", paddingTop: "1.5rem" }}>
                <p style={{
                  fontFamily: "sans-serif",
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  letterSpacing: "0.25em",
                  textTransform: "uppercase",
                  color: "#9b7d65",
                  marginBottom: "0.4rem",
                }}>Instagram</p>
                <a
                  href="https://www.instagram.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontFamily: "'Georgia', serif",
                    fontSize: "1.05rem",
                    color: "#1a1a1a",
                    textDecoration: "none",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#9b7d65")}
                  onMouseLeave={e => (e.currentTarget.style.color = "#1a1a1a")}
                >
                  @figure8collections
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
