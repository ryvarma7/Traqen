import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: { "2xl": "1280px" },
    },
    extend: {
      colors: {
        // ── Olive + light-orange palette ──────────────────────────────────────
        background:   "#F2F0E6",   // warm parchment
        foreground:   "#262B1A",   // deep olive-black
        surface:      "#FDFCF8",   // creamy white card surface
        border:       "#C8C5A8",   // warm olive-grey border
        muted: {
          DEFAULT:    "#EAE8D8",   // tinted muted surface
          foreground: "#717863",   // olive-grey secondary text
        },
        accent: {
          DEFAULT:    "#D97B0A",   // warm deep orange
          foreground: "#FFFFFF",
          soft:       "#FDF0DC",   // very light orange tint
          subtle:     "#F5E4C0",   // slightly stronger for hover states
        },
        // ── Semantic colours (kept neutral — works with any palette) ──────────
        success: {
          DEFAULT: "#2F9E44",
          soft:    "#EBFBEE",
          border:  "#B2F2BB",
        },
        danger: {
          DEFAULT: "#E03131",
          soft:    "#FFF5F5",
          border:  "#FFC9C9",
        },
        warning: {
          DEFAULT: "#F08C00",
          soft:    "#FFF9DB",
          border:  "#FFEC99",
        },
        info: {
          DEFAULT: "#1971C2",
          soft:    "#E7F5FF",
          border:  "#A5D8FF",
        },
        // ── Brand olive tones (for icon containers, brand panel bg) ──────────
        olive: {
          50:  "#F5F4EC",
          100: "#EAE8D8",
          200: "#D5D2BC",
          300: "#BCBA9A",
          400: "#9FA07B",
          500: "#6B744C",   // true olive
          600: "#57603C",
          700: "#434C2E",
          800: "#2F3520",
          900: "#1C2012",
        },
      },
      borderRadius: {
        card:  "10px",
        field: "8px",
      },
      boxShadow: {
        lift:   "0 4px 18px rgba(38, 43, 26, 0.12)",
        sheet:  "0 -8px 36px rgba(38, 43, 26, 0.16)",
        modal:  "0 16px 48px rgba(38, 43, 26, 0.22)",
        glow:   "0 0 0 3px rgba(217, 123, 10, 0.18)",
        inset:  "inset 0 1px 3px rgba(38, 43, 26, 0.06)",
      },
      fontFamily: {
        sans: ["var(--font-lora)", "Georgia", "serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        "2xs": ["0.75rem",   { lineHeight: "1rem" }],
        xs:    ["0.8125rem", { lineHeight: "1.25rem" }],
        sm:    ["0.875rem",  { lineHeight: "1.375rem" }],
        base:  ["1rem",      { lineHeight: "1.5rem" }],
        lg:    ["1.125rem",  { lineHeight: "1.625rem" }],
        xl:    ["1.5rem",    { lineHeight: "2rem" }],
        "2xl": ["1.75rem",   { lineHeight: "2.25rem" }],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to:   { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to:   { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up":   "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;