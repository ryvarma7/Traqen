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
        // ── Monochrome black + white palette (matches login page) ────────────
        background:   "#000000",   // pure black — same as auth pages
        foreground:   "#FFFFFF",   // white text
        surface:      "#0B0B0B",   // card surface — same as auth card
        border:       "#1A1A1A",   // ≈ white/10 on black, like auth borders
        muted: {
          DEFAULT:    "#111111",   // tinted muted surface
          foreground: "#C4C4C4",   // brighter grey secondary text
        },
        accent: {
          DEFAULT:    "#FFFFFF",   // monochrome accent
          foreground: "#000000",
          soft:       "#141414",   // dark tint behind accents
          subtle:     "#1F1F1F",   // hover states
        },
        // ── Semantic colours (hues kept — tuned to read on black) ────────────
        success: {
          DEFAULT: "#51CF66",
          soft:    "#0F2E18",
          border:  "#2B6E3F",
        },
        danger: {
          DEFAULT: "#FF6B6B",
          soft:    "#33151A",
          border:  "#7A2E35",
        },
        warning: {
          DEFAULT: "#FFD43B",
          soft:    "#332A10",
          border:  "#7A6423",
        },
        info: {
          DEFAULT: "#4DABF7",
          soft:    "#0F2438",
          border:  "#275E8E",
        },
        // ── Olive scale (kept for compatibility — now neutral greys) ─────────
        olive: {
          50:  "#0E0E0E",
          100: "#131313",
          200: "#1A1A1A",
          300: "#232323",
          400: "#2E2E2E",
          500: "#474747",
          600: "#616161",
          700: "#828282",
          800: "#A8A8A8",
          900: "#D4D4D4",
        },
      },
      borderRadius: {
        card:  "10px",
        field: "8px",
      },
      boxShadow: {
        lift:   "0 4px 18px rgba(0, 0, 0, 0.50)",
        sheet:  "0 -8px 36px rgba(0, 0, 0, 0.60)",
        modal:  "0 16px 48px rgba(0, 0, 0, 0.70)",
        glow:   "0 0 0 3px rgba(255, 255, 255, 0.12)",
        inset:  "inset 0 1px 3px rgba(0, 0, 0, 0.30)",
      },
      fontFamily: {
        sans: ["var(--font-raleway)", "system-ui", "sans-serif"],
        mono: ["var(--font-raleway)", "system-ui", "sans-serif"],
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
