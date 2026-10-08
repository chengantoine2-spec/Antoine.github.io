/* 音乐窗口的存档：`desktop.music`（2026-10-06 收尾那一单）。
 *
 * 只存**小**东西：音量 / 随机 / 循环 / 上次那首 / 上次位置。
 * ⚠️ **绝不存曲库清单** —— 那是本机服务的实时数据，存下来只会"明明删了却还在"。
 *
 * 守卫（项目规矩：坏数据要能回默认值，不要让启动崩掉）：缺键、坏 JSON、越界值全部回落默认。
 * 写入口径：**只在用户真的改过时写**（拖音量 / 切随机 / 切循环 / 换曲 / 播到一半存档），
 * 打开窗口本身不写 —— 否则"从没用过音乐"的人也会在 localStorage 里多一条记录。
 */

export type Repeat = 'off' | 'all' | 'one'

export interface MusicPrefs {
  volume: number
  shuffle: boolean
  repeat: Repeat
  /** 上次那首（`Track.id`，就是文件名）；空串 = 没有 */
  lastTrackId: string
  /** 上次播到的秒数 */
  position: number
}

export const MUSIC_PREFS_KEY = 'desktop.music'

export const MUSIC_DEFAULTS: MusicPrefs = {
  volume: 0.8,
  shuffle: false,
  repeat: 'off',
  lastTrackId: '',
  position: 0,
}

const isRepeat = (v: unknown): v is Repeat => v === 'off' || v === 'all' || v === 'one'

export function readMusicPrefs(): MusicPrefs {
  try {
    const raw = localStorage.getItem(MUSIC_PREFS_KEY)
    if (!raw) return { ...MUSIC_DEFAULTS }
    const parsed = JSON.parse(raw) as Record<string, unknown> | null
    if (!parsed || typeof parsed !== 'object') return { ...MUSIC_DEFAULTS }
    const volume = Number(parsed.volume)
    const position = Number(parsed.position)
    return {
      volume: Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : MUSIC_DEFAULTS.volume,
      shuffle: parsed.shuffle === true,
      repeat: isRepeat(parsed.repeat) ? parsed.repeat : MUSIC_DEFAULTS.repeat,
      lastTrackId: typeof parsed.lastTrackId === 'string' ? parsed.lastTrackId : MUSIC_DEFAULTS.lastTrackId,
      position: Number.isFinite(position) && position >= 0 ? position : MUSIC_DEFAULTS.position,
    }
  } catch {
    /* 坏 JSON / localStorage 被禁：回默认，不崩 */
    return { ...MUSIC_DEFAULTS }
  }
}

/** 合并写。读一遍再写，免得只改音量就把别的字段抹了 */
export function writeMusicPrefs(patch: Partial<MusicPrefs>): void {
  try {
    const next = { ...readMusicPrefs(), ...patch }
    localStorage.setItem(MUSIC_PREFS_KEY, JSON.stringify(next))
  } catch {
    /* 写不进去不影响本次会话 */
  }
}
