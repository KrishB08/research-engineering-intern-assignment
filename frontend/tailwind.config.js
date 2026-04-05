export default {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './index.html'],
  theme: {
    extend: {
      colors: {
        'page-bg': '#FAFAF8',
        'sidebar-bg': '#1C1C1C',
        'sidebar-text': '#E8E8E6',
        'main-bg': '#FAFAF8',
        'card-bg': '#FFFFFF',
        'primary': '#FF4D00',
        'secondary': '#0066FF',
        'success': '#00A86B',
        'text-primary': '#1C1C1C',
        'text-secondary': '#6B6B6B',
        'text-muted': '#9B9B9B',
        'border-editorial': '#E8E4DE',
        'tag-bg': '#F0EDE8',
      },
      fontFamily: {
        serif: ['Playfair Display', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Courier New', 'monospace'],
      },
    },
  },
  plugins: [],
}
