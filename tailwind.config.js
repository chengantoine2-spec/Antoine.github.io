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
        /* 注：窗口标题行小按钮悬停那种"淡按钮形状"用的是 --c-control-hover，
           但组件里走**任意值类** `bg-[var(--c-control-hover)]`（和 --c-scroll-thumb 一样）——
           加新颜色键要重启 dev server 才生效，任意值不用（踩过） */
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
