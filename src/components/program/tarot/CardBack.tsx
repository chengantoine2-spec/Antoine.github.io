/* 牌背 —— 上游五套牌图里**一张牌背都没有**（全库按 back / reverse / cover 搜过，零命中），
   所以这张是自己画的。

   为什么画 SVG 而不是找张位图：
   - 面朝下的牌在洗牌 / 发牌 / 翻牌全程都在屏幕上，它是这个窗口出现次数最多的图形，
     用位图就得准备浅色深色两张；SVG 走主题令牌，两套主题自动跟着变。
   - 主题令牌是**硬规则**（不许写死 #fff / rgb()），这里所有颜色都是 `var(--c-*)`。
   - 眼形是照牌名来的 —— 这套牌叫「阿卡西之眼」，牌背就是那只眼。

   尺寸按牌面固有比例（350×600）画，外面按容器缩，和牌面图片严丝合缝地对齐。 */

export function CardBack({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 350 600"
      className={className}
      role="img"
      aria-label="牌背"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* 底板 + 外描边 */}
      <rect
        x="0"
        y="0"
        width="350"
        height="600"
        rx="18"
        className="fill-[var(--c-surface-2)] stroke-[var(--c-border)]"
        strokeWidth="2"
      />
      {/* 内框：一圈细描边，压出"卡牌"的层次 */}
      <rect
        x="15"
        y="15"
        width="320"
        height="570"
        rx="11"
        fill="none"
        className="stroke-[var(--c-accent)]"
        strokeWidth="1.5"
        opacity="0.45"
      />

      {/* 四角的菱形 */}
      <g className="fill-[var(--c-accent)]" opacity="0.5">
        <path d="M40 40 L48 50 L40 60 L32 50 Z" />
        <path d="M310 40 L318 50 L310 60 L302 50 Z" />
        <path d="M40 540 L48 550 L40 560 L32 550 Z" />
        <path d="M310 540 L318 550 L310 560 L302 550 Z" />
      </g>

      {/* 上下的四角星，把中轴串起来 */}
      <g className="fill-[var(--c-accent)]" opacity="0.7">
        <path d="M175 96 L182 118 L204 125 L182 132 L175 154 L168 132 L146 125 L168 118 Z" />
        <path d="M175 446 L182 468 L204 475 L182 482 L175 504 L168 482 L146 475 L168 468 Z" />
      </g>

      {/* 中轴细线 */}
      <line
        x1="175"
        y1="160"
        x2="175"
        y2="220"
        className="stroke-[var(--c-accent)]"
        strokeWidth="1"
        opacity="0.4"
      />
      <line
        x1="175"
        y1="380"
        x2="175"
        y2="440"
        className="stroke-[var(--c-accent)]"
        strokeWidth="1"
        opacity="0.4"
      />

      {/* 这只眼：牌背的主体 */}
      <g>
        {/* 眼白 / 轮廓（杏仁形） */}
        <path
          d="M74 300 Q175 208 276 300 Q175 392 74 300 Z"
          className="fill-[var(--c-surface)] stroke-[var(--c-accent)]"
          strokeWidth="2.5"
        />
        {/* 虹膜 */}
        <circle
          cx="175"
          cy="300"
          r="44"
          className="fill-[var(--c-accent)]"
          opacity="0.18"
        />
        <circle
          cx="175"
          cy="300"
          r="44"
          fill="none"
          className="stroke-[var(--c-accent)]"
          strokeWidth="2"
        />
        {/* 瞳孔 */}
        <circle cx="175" cy="300" r="19" className="fill-[var(--c-accent)]" />
        {/* 高光 */}
        <circle cx="163" cy="288" r="6.5" className="fill-[var(--c-surface)]" opacity="0.9" />
        {/* 眼睑上的放射短线：睫毛 / 光 */}
        <g className="stroke-[var(--c-accent)]" strokeWidth="2" strokeLinecap="round" opacity="0.8">
          <line x1="175" y1="196" x2="175" y2="176" />
          <line x1="118" y1="220" x2="104" y2="206" />
          <line x1="232" y1="220" x2="246" y2="206" />
          <line x1="88" y1="272" x2="68" y2="266" />
          <line x1="262" y1="272" x2="282" y2="266" />
          <line x1="88" y1="328" x2="68" y2="334" />
          <line x1="262" y1="328" x2="282" y2="334" />
          <line x1="118" y1="380" x2="104" y2="394" />
          <line x1="232" y1="380" x2="246" y2="394" />
          <line x1="175" y1="404" x2="175" y2="424" />
        </g>
      </g>
    </svg>
  )
}
