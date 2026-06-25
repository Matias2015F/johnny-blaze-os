export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        jb: {
          bg:      "#0A0A0A",
          surface: "#141414",
          card:    "#1A1A1A",
          border:  "#2A2A2A",
          muted:   "#3D3D3D",
          orange:  "#E85A1A",
          "orange-hover": "#C94A14",
          "orange-dim":   "rgba(232,90,26,0.15)",
          /* Estados de estado de orden */
          "success": "#10b981",
          "warning": "#f59e0b",
          "error":   "#ef4444",
          "info":    "#3b82f6",
        },
      },
      /* Design System Tokens — Fase 1 Coherencia */
      fontSize: {
        /* Escala tipográfica normalizada */
        xs:      ["0.75rem", { lineHeight: "1rem" }],     /* 12px */
        sm:      ["0.875rem", { lineHeight: "1.25rem" }], /* 14px */
        base:    ["1rem", { lineHeight: "1.5rem" }],      /* 16px */
        label:   ["0.625rem", { lineHeight: "0.75rem" }], /* 10px — labels, tags */
        micro:   ["0.5rem", { lineHeight: "0.625rem" }],  /* 8px — smallest text */
      },
      borderRadius: {
        /* Border radius normalizado */
        xs:  "0.5rem",      /* 8px — pequeños botones, tags */
        sm:  "0.75rem",     /* 12px — inputs pequeños */
        md:  "1rem",        /* 16px — cards pequeñas, inputs */
        lg:  "1.5rem",      /* 24px — cards medianas, bottom sheets */
        xl:  "2rem",        /* 32px — cards grandes, modales */
        "2xl": "2.5rem",    /* 40px — hero elements, large modales */
      },
      boxShadow: {
        /* Shadow system — profundidad visual */
        xs:  "0 1px 2px 0 rgba(0, 0, 0, 0.3)",
        sm:  "0 2px 4px 0 rgba(0, 0, 0, 0.4)",
        md:  "0 4px 8px 0 rgba(0, 0, 0, 0.5)",
        lg:  "0 8px 16px 0 rgba(0, 0, 0, 0.6)",
        xl:  "0 12px 24px 0 rgba(0, 0, 0, 0.7)",
        /* Accent shadows */
        "orange-glow": "0 0 20px rgba(232, 90, 26, 0.3)",
        "orange-sm":   "0 2px 8px rgba(232, 90, 26, 0.2)",
      },
      spacing: {
        /* Spacing system — consistencia en gaps y paddings */
        xs:  "0.25rem",  /* 4px */
        sm:  "0.5rem",   /* 8px */
        md:  "1rem",     /* 16px */
        lg:  "1.5rem",   /* 24px */
        xl:  "2rem",     /* 32px */
      },
    },
  },
  plugins: [],
}
