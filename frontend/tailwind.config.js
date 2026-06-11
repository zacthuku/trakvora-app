/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "#041627",
        "primary-container": "#1a2b3c",
        secondary: "#fe6a34",
        "secondary-container": "#fe6a34",
        "tertiary-fixed-dim": "#4fdbcc",
        surface: "#f8f9fa",
        "surface-variant": "#e8ecef",
        outline: "#8a9199",
        error: "#ef4444",
        success: "#4fdbcc",
      },
      fontFamily: {
        sans: ["Nunito Sans", "system-ui", "sans-serif"],
        heading: ["Ubuntu", "system-ui", "sans-serif"],
        "data-mono": ["Ubuntu", "monospace"],
      },
      borderRadius: {
        DEFAULT: "0.125rem",
        lg: "0.25rem",
        xl: "0.5rem",
        full: "0.75rem",
      },
      keyframes: {
        marquee: {
          "0%":   { transform: "translateX(0%)"   },
          "100%": { transform: "translateX(-50%)" },
        },
        "fade-in-up": {
          "0%":   { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)"    },
        },
        "fade-in": {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "truck-drive": {
          "0%":   { transform: "translateX(-10%) scaleX(1)"  },
          "49%":  { transform: "translateX(85%) scaleX(1)"   },
          "50%":  { transform: "translateX(85%) scaleX(-1)"  },
          "100%": { transform: "translateX(-10%) scaleX(-1)" },
        },
        "draw-route": {
          "0%":   { strokeDashoffset: "200" },
          "100%": { strokeDashoffset: "0"   },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)"  },
          "50%":      { transform: "translateY(-8px)" },
        },
        "ken-burns": {
          "0%":   { transform: "scale(1)"    },
          "100%": { transform: "scale(1.08)" },
        },
        "slide-up-fade": {
          "0%":   { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)"    },
        },
        "smoke-puff": {
          "0%":   { opacity: "0.7", transform: "translateY(0) scale(0.6)"  },
          "100%": { opacity: "0",   transform: "translateY(-20px) scale(2)" },
        },
      },
      animation: {
        marquee:         "marquee 28s linear infinite",
        "fade-in-up":    "fade-in-up 0.4s ease forwards",
        "fade-in":       "fade-in 0.3s ease forwards",
        "truck-drive":   "truck-drive 5s linear infinite",
        "draw-route":    "draw-route 1.8s ease forwards",
        float:           "float 3s ease-in-out infinite",
        "ken-burns":     "ken-burns 8s ease-in-out infinite alternate",
        "slide-up-fade": "slide-up-fade 0.35s ease forwards",
        "smoke-puff":    "smoke-puff 1.4s ease-out infinite",
      },
    },
  },
  plugins: [],
};
