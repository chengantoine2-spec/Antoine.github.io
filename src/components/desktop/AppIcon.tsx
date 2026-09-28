import type { IconName } from '../../types/desktop'

/** 自绘图标：不引图标库、不使用第三方图标素材 */
export function AppIcon({ name, className = 'h-6 w-6' }: { name: IconName; className?: string }) {
  const base = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    'aria-hidden': true,
  }

  switch (name) {
    case 'about':
      return (
        <svg {...base}>
          <circle cx="12" cy="8" r="3.2" />
          <path d="M5 20c0-3.3 3.1-5.4 7-5.4s7 2.1 7 5.4" />
        </svg>
      )
    case 'projects':
      return (
        <svg {...base}>
          <path d="M3.5 7.5h6l1.6 2h9.4v9.5h-17z" />
          <path d="M3.5 7.5V5.5h6l1.6 2" />
        </svg>
      )
    case 'blog':
      return (
        <svg {...base}>
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <path d="M8 9h8M8 13h8M8 17h5" />
        </svg>
      )
    case 'skills':
      return (
        <svg {...base}>
          <path d="M12 3l2.6 5.6 6.1.8-4.4 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.3 9.4l6.1-.8z" />
        </svg>
      )
    case 'contact':
      return (
        <svg {...base}>
          <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
          <path d="M4 7l8 6 8-6" />
        </svg>
      )
    case 'terminal':
      return (
        <svg {...base}>
          <rect x="3.5" y="5" width="17" height="14" rx="2" />
          <path d="M7.5 10l2.5 2-2.5 2M12.5 14h4" />
        </svg>
      )
    case 'assets':
      return (
        <svg {...base}>
          <path d="M3.5 8.5l8.5-4 8.5 4-8.5 4z" />
          <path d="M3.5 8.5v7l8.5 4 8.5-4v-7" />
        </svg>
      )
    case 'write':
      return (
        <svg {...base}>
          <path d="M4 20l4-.9L19.2 7.9a1.9 1.9 0 0 0 0-2.7l-.4-.4a1.9 1.9 0 0 0-2.7 0L4.9 16z" />
          <path d="M14.5 6.5l3 3" />
        </svg>
      )
    case 'settings':
      return (
        <svg {...base}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" />
        </svg>
      )
    default:
      return null
  }
}
