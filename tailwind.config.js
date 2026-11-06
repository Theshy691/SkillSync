module.exports = {
  content: ['./app.html', './script.js', './assets/js/modules/**/*.js'],
  darkMode: 'class',
  theme: {
    extend: {
      borderRadius: { none: '0px', sm: '4px', DEFAULT: '6px', md: '6px', lg: '10px', xl: '12px', '2xl': '12px', '3xl': '12px' },
      colors: { brand: { 50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca', 800: '#3730a3', 900: '#312e81' } }
    }
  }
};
