/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef7ff",
          100: "#d9eeff",
          200: "#bce2ff",
          300: "#8fd2ff",
          400: "#5fb6ff",
          500: "#2f90ff",
          600: "#1e6fff",
          700: "#1a55e6",
          800: "#1b46b9",
          900: "#1b3d92"
        }
      }
    }
  },
  plugins: []
};

