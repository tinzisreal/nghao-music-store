export default {content: [
  './index.html',
  './src/**/*.{js,ts,jsx,tsx}'
],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        ember: "#ff8a3d",
      },
      minWidth: {
        5: "1.25rem",
      },
    },
  },
};
