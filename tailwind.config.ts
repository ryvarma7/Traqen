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
        background: "#FAFAF9",
        foreground: "#1C1C1A",
        surface: "#FFFFFF",
        border: "#E5E5E3",
        muted: {
          DEFAULT: "#F2F2F0",
          foreground: "#78716C",
        },
        accent: {
          DEFAULT: "#6366F1",
          foreground: "#FFFFFF",
          soft: "#EEF2FF",
        },
        success: {
          DEFAULT: "#16A34A",
          soft: "#F0FDF4",
          border: "#BBF7D0",
        },
        danger: {
          DEFAULT: "#DC2626",
          soft: "#FEF2F2",
          border: "#FECACA",
        },
        warning: {
          DEFAULT: "#D97706",
          soft: "#FFFBEB",
          border: "#FDE68A",
        },
        info: {
          DEFAULT: "#2563EB",
          soft: "#EFF6FF",
          border: "#BFDBFE",
        },
      },
      borderRadius: {
        card: "10px",
        field: "8px",
      },
      boxShadow: {
        lift: "0 4px 16px rgba(28, 28, 26, 0.08)",
        sheet: "0 -8px 32px rgba(28, 28, 26, 0.12)",
        modal: "0 12px 40px rgba(28, 28, 26, 0.16)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        "2xs": ["0.75rem", { lineHeight: "1rem" }],
        xs: ["0.8125rem", { lineHeight: "1.25rem" }],
        sm: ["0.875rem", { lineHeight: "1.375rem" }],
        base: ["1rem", { lineHeight: "1.5rem" }],
        lg: ["1.125rem", { lineHeight: "1.625rem" }],
        xl: ["1.5rem", { lineHeight: "2rem" }],
        "2xl": ["1.75rem", { lineHeight: "2.25rem" }],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
