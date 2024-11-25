/** @type {import('tailwindcss').Config} */

export default {
  darkMode: ["selector", ".dark-mode"],
  content: [],
  theme: {
    fontFamily: {
      sans: ["Inter", "sans-serif"],
    },
    extend: {
      borderRadius: {
        zk: "16px",
      },
      colors: {
        khaki: "#F6F6F6",
        neutral: {
          50: "#F7F7F7",
          100: "#EBEBEB",
          200: "#D1D1D1",
          300: "#BABABA",
          400: "#A1A1A1",
          500: "#878787",
          600: "#707070",
          700: "#575757",
          800: "#3D3D3D",
          900: "#262626",
          950: "#1A1A1A"
        },
        primary: {
          50: "#ECEDFE",
          100: "#DEDFFC",
          200: "#B8BAF9",
          300: "#EAEBFD",
          400: "#9896FF",
          500: "#4F55F1",
          600: "#131AEC",
          700: "#0E14B4",
          800: "#090D76",
          900: "#05073D",
          950: "#02031C"
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
};
