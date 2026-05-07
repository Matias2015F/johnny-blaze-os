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
        },
      },
    },
  },
  plugins: [],
}
