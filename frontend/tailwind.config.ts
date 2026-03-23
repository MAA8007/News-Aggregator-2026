import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "ui-sans-serif", "sans-serif"],
        serif: ["Merriweather", "Georgia", "serif"],
        display: ["Playfair Display", "serif"],
      },
      animation: {
        "float1": "float1 12s ease-in-out infinite",
        "float2": "float2 16s ease-in-out infinite 4s",
        "float3": "float3 14s ease-in-out infinite 2s",
        "float4": "float4 18s ease-in-out infinite 6s",
        "pulse-dot": "pulseDot 2s ease-in-out infinite",
        "fade-in-up": "fadeInUp 0.5s ease-out forwards",
        "shimmer": "shimmer 1.8s linear infinite",
      },
      keyframes: {
        float1: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "50%": { transform: "translate(60px, -80px) scale(1.1)" },
        },
        float2: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "50%": { transform: "translate(-70px, 60px) scale(1.12)" },
        },
        float3: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "50%": { transform: "translate(50px, 70px) scale(0.92)" },
        },
        float4: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "50%": { transform: "translate(-50px, -40px) scale(1.08)" },
        },
        pulseDot: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.3", transform: "scale(0.75)" },
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-700px 0" },
          "100%": { backgroundPosition: "700px 0" },
        },
      },
      colors: {
        "editorial-ink": "#1a1a2e",
        "editorial-muted": "#6b7280",
      },
      boxShadow: {
        "card": "0 2px 12px 0 rgba(0,0,0,0.06), 0 1px 3px 0 rgba(0,0,0,0.04)",
        "card-hover": "0 20px 48px 0 rgba(0,0,0,0.12), 0 4px 12px 0 rgba(0,0,0,0.06)",
        "glow-sage": "0 0 24px rgba(134,239,172,0.25)",
        "glow-blue": "0 0 24px rgba(147,197,253,0.25)",
      },
    },
  },
  plugins: [],
};

export default config;
