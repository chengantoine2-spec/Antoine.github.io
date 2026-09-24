/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      /* 颜色全部走 CSS 变量，皮肤切换只换 tokens.css 里的一套值 */
      colors: {
        chrome: 'var(--c-chrome)',
        'chrome-ink': 'var(--c-chrome-fg)',
        surface: 'var(--c-surface)',
        'surface-2': 'var(--c-surface-2)',
        edge: 'var(--c-border)',
        ink: 'var(--c-text)',
        dim: 'var(--c-text-dim)',
        accent: 'var(--c-accent)',
        'accent-ink': 'var(--c-accent-fg)',
        hover: 'var(--c-hover)',
      },
      borderRadius: {
        window: 'var(--r-window)',
        dock: 'var(--r-dock)',
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'PingFang SC',
          'Hiragino Sans GB',
          'Microsoft YaHei',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
