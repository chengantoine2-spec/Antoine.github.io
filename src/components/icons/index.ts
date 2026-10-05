import type { ComponentType } from 'react'
import type { IconName } from '../../types/desktop'
import { AboutIcon } from './AboutIcon'
import { AssetsIcon } from './AssetsIcon'
import { BlogIcon } from './BlogIcon'
import { ContactIcon } from './ContactIcon'
import { DshIcon } from './DshIcon'
import { ProjectsIcon } from './ProjectsIcon'
import { SettingsIcon } from './SettingsIcon'
import { SkillsIcon } from './SkillsIcon'
import { TerminalIcon } from './TerminalIcon'
import { WikiIcon } from './WikiIcon'
import { WriteIcon } from './WriteIcon'
import type { IconProps } from './base'

/* 全站图标（美术）的唯一目录。
   组件只认 `AppIcon`（外壳）或直接 import 这里的字形；改画只改这个目录里的文件。

   ⚠️ ICON_SET 的**键**是 `types/desktop.ts` 里的 IconName —— 路由、任务栏、验证脚本
   都按它走，一个都不能改名。要加新图标位：先跟主管说，让他改 IconName 与登记表。 */

/** 应用图标登记表：IconName → 组件 */
export const ICON_SET: Record<IconName, ComponentType<IconProps>> = {
  about: AboutIcon,
  projects: ProjectsIcon,
  blog: BlogIcon,
  write: WriteIcon,
  skills: SkillsIcon,
  contact: ContactIcon,
  terminal: TerminalIcon,
  assets: AssetsIcon,
  settings: SettingsIcon,
  wiki: WikiIcon,
  dsh: DshIcon,
}

export { iconBase } from './base'
export type { IconProps } from './base'

/* 桌面外壳用的字形（不是应用图标，但也是"画"） */
export { FullscreenGlyph } from './glyphs/FullscreenGlyph'
export { MaximizeGlyph } from './glyphs/MaximizeGlyph'
export { MenuGlyph } from './glyphs/MenuGlyph'
export { PositionGlyph } from './glyphs/PositionGlyph'
