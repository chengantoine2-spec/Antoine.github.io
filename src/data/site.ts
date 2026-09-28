/**
 * 站点内容集中在这里：改「关于」窗口只动这个文件，不用碰组件。
 * 链接一律用完整 URL（站内相对路径在 GitHub Pages 子路径下会指错）。
 */
export const SITE = {
  name: '焦糖布丁',
  /**
   * 站标（出处 public/logo.svg）。**必须自己拼 BASE_URL**：
   * src 里的字符串 Vite 不会改写，写死 '/logo.svg' 在子路径部署下会指到域名根目录而 404。
   */
  logo: `${import.meta.env.BASE_URL}logo.svg`,
  tagline: '一个把日常慢慢熬出味道的地方',
  intro: [
    '这里是我的个人站。所有内容都放在一个「桌面」里：桌面背景、任务栏、窗口，博客只是其中一个窗口。',
    '主要记录日常、做过的东西，以及过程中的一些判断。写得不算快，但都是自己用过、想清楚了的。',
  ],
  facts: [
    { label: '在做', value: '把这个桌面式的个人站一点点补完' },
    { label: '在用', value: 'Vite · React · TypeScript · Tailwind' },
    { label: '喜欢', value: '焦糖布丁，安静的下午，把东西做顺手' },
  ],
  links: [
    { label: 'GitHub', href: 'https://github.com/chengantoine2-spec' },
    { label: '本站仓库', href: 'https://github.com/chengantoine2-spec/Antoine.github.io' },
  ],
}
