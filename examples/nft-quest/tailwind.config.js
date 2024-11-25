import defaultTheme from "tailwindcss/defaultTheme";

/** @type {import('tailwindcss').Config} */
export default {
  // darkMode: ["selector", ".dark-mode"],
  content: [
    "./components/**/*.{js,vue,ts}",
    "./views/**/*.vue",
    "./layouts/**/*.vue",
    "./pages/**/*.vue",
    "./plugins/**/*.{js,ts}",
    "./utils/**/*.{js,ts}",
    "./nuxt.config.{js,ts}",
    "./app.vue",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", ...defaultTheme.fontFamily.sans],
      },
      borderRadius: {
        zk: "28px",
      },
      colors: {
        neutral: {
          50: "#F7F9FC",
          100: "#E8ECF2",
          150: "#E1E5EB",
          200: "#DADDE5",
          300: "#BEC2CC",
          400: "#A1A7B3",
          500: "#858C99",
          600: "#6C7380",
          700: "#555A66",
          800: "#3D424D",
          900: "#262B33",
          950: "#11141A",
          975: "#0A0C10",
        },
        primary: {
          50: "#D9E3FF",
          100: "#A6BFFF",
          200: "#739AFF",
          300: "#4075FF",
          400: "#1755F4",
          500: "#1650E5",
          600: "#2663FF",
          700: "#1347CC",
          800: "#113EB2",
          900: "#0C2C80",
          950: "#071B4D",
        },
        warning: {
          50: "#FFF9E5",
          100: "#FFECB2",
          200: "#FFE080",
          300: "#FFD44D",
          400: "#FFC81A",
          500: "#FFC200",
          600: "#E5AF00",
          700: "#CC9B00",
          800: "#997500",
          900: "#664E00",
          950: "#4D3A00",
        },
        error: {
          50: "#FFCCCC",
          100: "#FFB2B2",
          200: "#FF8C8C",
          300: "#FF6666",
          400: "#FF3333",
          500: "#FF0000",
          600: "#CC0000",
          700: "#A60000",
          800: "#800000",
          900: "#590000",
          950: "#330000",
        },
        success: {
          50: "#CCFFE5",
          100: "#B2FFD9",
          200: "#8CFFC6",
          300: "#66FFB2",
          400: "#33FF99",
          500: "#00FF80",
          600: "#00CC66",
          700: "#00A653",
          800: "#008040",
          900: "#00592D",
          950: "#00331A",
        },
      },
      keyframes: {
        overlayShow: {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
        contentShow: {
          from: { opacity: 0, transform: "translate(-50%, -48%) scale(0.96)" },
          to: { opacity: 1, transform: "translate(-50%, -50%) scale(1)" },
        },
        slideDownAndFade: {
          from: { opacity: 0, transform: "translateY(-2px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        slideLeftAndFade: {
          from: { opacity: 0, transform: "translateX(2px)" },
          to: { opacity: 1, transform: "translateX(0)" },
        },
        slideUpAndFade: {
          from: { opacity: 0, transform: "translateY(2px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        slideRightAndFade: {
          from: { opacity: 0, transform: "translateX(-2px)" },
          to: { opacity: 1, transform: "translateX(0)" },
        },
      },
      animation: {
        overlayShow: "overlayShow 150ms cubic-bezier(0.16, 1, 0.3, 1)",
        contentShow: "contentShow 150ms cubic-bezier(0.16, 1, 0.3, 1)",
        slideDownAndFade:
          "slideDownAndFade 400ms cubic-bezier(0.16, 1, 0.3, 1)",
        slideLeftAndFade:
          "slideLeftAndFade 400ms cubic-bezier(0.16, 1, 0.3, 1)",
        slideUpAndFade: "slideUpAndFade 400ms cubic-bezier(0.16, 1, 0.3, 1)",
        slideRightAndFade:
          "slideRightAndFade 400ms cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};
