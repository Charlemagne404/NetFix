import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Aptos",
          "Segoe UI Variable Display",
          "SF Pro Display",
          "ui-sans-serif"
        ],
        mono: ["Cascadia Mono", "JetBrains Mono", "SFMono-Regular", "monospace"]
      },
      colors: {
        aegis: {
          ink: "#070a12",
          panel: "#0d1424",
          panel2: "#111a2d",
          line: "rgba(255,255,255,0.1)",
          cyan: "#38d5ff",
          blue: "#4b8dff",
          violet: "#8b5cf6",
          mint: "#44e0a5",
          rose: "#fb7185",
          amber: "#fbbf24"
        }
      },
      boxShadow: {
        glow: "0 0 60px rgba(56, 213, 255, 0.16)",
        panel: "0 24px 80px rgba(0, 0, 0, 0.36)"
      },
      borderRadius: {
        "2xl": "1.25rem",
        "3xl": "1.75rem"
      },
      backgroundImage: {
        "aegis-radial":
          "radial-gradient(circle at 18% 12%, rgba(56,213,255,.18), transparent 32%), radial-gradient(circle at 82% 4%, rgba(139,92,246,.14), transparent 30%), linear-gradient(135deg, #070a12 0%, #0b1020 48%, #090d18 100%)"
      }
    }
  },
  plugins: []
} satisfies Config;
