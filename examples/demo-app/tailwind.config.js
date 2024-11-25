import defaultTheme from "tailwindcss/defaultTheme";

/** @type {import('tailwindcss').Config} */
export default {
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
        sans: ["'Inter'", ...defaultTheme.fontFamily.sans],
      },
      colors: {
        primary: {
          300: "#4075FF",
          400: "#1755F4",
          700: "#1347CC",
        },
        neutral: {
          50: "#F7F9FC",
          100: "#E8ECF2",
          200: "#DADDE5",
          300: "#BEC2CC",
          400: "#A1A7B3",
          500: "#858C99",
          600: "#6C7380",
          700: "#555A66",
          800: "#3D424D",
          900: "#262B33",
          950: "#11141A",
        },
        error: {
          300: "#FF6666",
          500: "#FF0000",
        },
        warning: {
          400: "#FFC81A",
          600: "#E5AF00",
        },
        success: {
          400: "#33FF99",
          600: "#00CC66",
        },
      },
    },
    screens: {
      xxs: "320px",
      xs: "480px",
      sm: "640px",
      md: "720px",
      lg: "1024px",
      xl: "1280px",
    },
  },
  plugins: [],
};
