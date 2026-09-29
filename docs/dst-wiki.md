# 饥荒 Wiki 窗口：实现说明

这份文档记录**饥荒 Wiki 窗口**是怎么搭起来的、约定在哪、怎么改和怎么验。
它由该窗口的维护者负责更新（见 `AGENTS.md` 的「分工」一节：窗口外壳、任务栏、主题、路由归主管，
`src/data/dst/**` + `src/lib/dst/**` + `DstWikiWindow.tsx` + `DstWikiContent.tsx` 归窗口负责人）。

> 为什么不直接写进 `AGENTS.md`：那个文件是主管的，且里面已经有一节「分工」在管边界。
> 这份文档放在这里，改实现的时候顺手改它，不会和主管的文件互相覆盖。
> 主管若要把它挂到 `AGENTS.md` / `README.md` 的目录里，加一行链接即可。

---

## 一、窗口长什么样

窗口分成两个区，顶部 tab 切换：

| 区 | 内容 | 数据来源 |
|---|---|---|
| **资料** | 分类导航 + 条目卡片流 + 条目详情（含配方反查） | `src/data/dst/**`（本地数据） |
| **新手教程** | 长文教程列表 + 搜索，点开走 `/blog/:id` | 带 `wiki` 标签的博客文章（GitHub Issues） |

三栏版式沿用主管给的 `.wiki__*`（`globals.css`，容器查询，栏数跟窗口宽度走）。
配色只用主题令牌类，没有写死颜色。

## 二、数据模型（改数据前必读）

契约在 `src/lib/dst/types.ts`，**唯一一份**。四条硬约定：

1. **id 用稳定 slug，永远不用中文名**。中文译名会变（「薇克伯顿 / 薇克巴顿」都有人写），
   改名不该断掉链接。中文名放 `name`，其它叫法放 `aliases`。
2. **引用只存 id**（配方材料、`related`…），展示时反查。这样「这个物品被哪些配方用到」
   是算出来的，不需要手写第二份 —— 手写的那份一定会和配方表对不上。
3. **判别字段是 `category`**，不是 `kind`。窗口按 `category` 分栏、按
   `name`/`en`/`summary`/`body`/`facts` 渲染，它不需要知道具体是角色还是物品。
4. **拿不准的数值宁可留空**，也不填一个看起来像真的错数。一条错数值比缺一条更伤。

条目按分类拆在四个文件里，`src/data/dst/index.ts` 只做装配与反查：

```
src/data/dst/characters.ts   角色 18
src/data/dst/creatures.ts    生物 8
src/data/dst/items.ts        物品 64 + 料理 9（按 section 分小节）
src/data/dst/world.ts        世界 / 机制 5
src/data/dst/recipes.ts      配方 40（反查的唯一数据源）
src/data/dst/index.ts        类型再导出 + 按 id 去重 + recipesFor / recipesUsing / entryName
```

**按 id 去重**是必要的：四个文件分开维护，曾经同时把「蜂后」写进 `items.ts` 和 `creatures.ts`。
去重规则是**先出现的赢**，所以顺序是 角色 → 生物 → 物品 → 世界。

`facts` 是右栏的「关键数值」，用 `{ label, value }` 的键值对；会随版本变动的数值
（机器人吃齿轮后的上限）写在 `body` 里，不要放进 `facts`，否则看着像初始值。

## 三、搜索：拼音 + 首字母

逻辑在 `src/lib/dst/search.ts`（索引与打分）和 `src/lib/dst/pinyin.ts`（拼音与多音字覆盖）。

**索引与查询必须走同一套归一化**（`normalize`：抹空白 + 小写）。这条是博客搜索踩过的坑，
两边规则一旦拆开就会出现「正文搜不到」。

支持四种输入：中文（`金斧头`）、别名（`大力士`）、英文（`wx78`）、拼音（`jinfutou` / `jft`）。

### 打分规则里最要紧的一条

**绝不拿「拼接后的拼音串」做子串匹配。** 这个坑踩过两次，都是实际发生的 bug：

- `initials` 是各段首字母拼起来的（`蜘蛛` = `zz`、`蜘蛛人` = `zzr`），
  拼接处会凭空多出边界：`zz` + `zzz` → `zzzzzz`，于是搜 `zzzz` 会命中蜘蛛；
- `jinfutou` 去掉元音后恰好含 `jft`，于是搜首字母 `jft` 会连带命中「齿轮」(chilun)。

所以拉丁查询只做**整串相等**与**逐段词首**匹配。中文查询允许子串（「斧头」搜到「金斧头」是有意义的）。

打分分档（`scoreOf`）：名字精确 100 → 缩写精确 94 → 全拼精确 92 → 词首 88 → 全拼前缀 80
→ 缩写前缀 60 → 全拼子串 40（≥3 字符）→ 正文 24（≥4 字符）。

改完搜索跑一次回归（`tools/verify-dst.mjs` 里有正例与反例，见下文）。

### 多音字

`pinyin.ts` 里有一张很小的 `POLYPHONE` 覆盖表。pinyin-pro 取的是「最常用读音」，
游戏译名里有个别字读的是另一个音。**只加确实会用到的那几个**，别把整张多音字表抄进来。

## 四、为什么拆成「外壳 + 内容」两个文件

`DstWikiWindow.tsx` 只 import react，`DstWikiContent.tsx` 才是实现。这不是洁癖，是体积问题：

条目数据 + 搜索模块 + `pinyin-pro` 加起来是几百 KB，而它们只在**打开这个窗口时**才用得到。
如果 `router.tsx` 静态 import 的实现里再静态 import 数据，这些重量会全部折进桌面首屏那个 chunk。
拆开之后实测：

| chunk | 大小（gzip） | 何时加载 |
|---|---|---|
| 主入口 | 91 KB | 首屏 |
| `DstWikiContent` | 29 KB | 打开 Wiki 窗口 |
| `index`（拼音库字典） | 101 KB | 打开 Wiki 窗口 |

另外 `search.ts` **不要**静态 import `pinyin.ts`（拼音函数是运行时注入的参数）：
一旦静态引入，Rollup 会把 300 KB 的拼音库折叠进首屏，实测让首屏多背 100 KB gzip。

改这块之前先看 `npm run build` 的 chunk 输出，别把上面的数字改坏。

## 五、教程怎么变成博客文章

教程是**长文**，不是结构化条目，所以走「文章 = GitHub Issue」那条既有管线：

1. 在「博客创作」窗口把分类选成 **「饥荒 Wiki」** → 写入 `wiki` 标签
2. Wiki 窗口的「新手教程」区按 `wiki` 标签筛文章；博客窗口会把它们**分流**出去，
   免得几十篇教程淹掉日常 / 项目列表（选中「饥荒 Wiki」分类才显示）

判定函数是 `src/lib/github.ts` 的 `isWikiGuide()`，两处共用，不要各写一份。

批量发布三篇现成稿件：

```powershell
$env:GH_TOKEN = "你的PAT"
node docs/dst-guides/publish.mjs --dry     # 先预览
node docs/dst-guides/publish.mjs           # 真发
```

稿件与说明在 `docs/dst-guides/`（含 `README.md`）。

## 六、怎么验

```bash
npm run dev            # 另一个终端
npm run verify:dst     # 数据校验 + 搜索回归 + 配方反查 + 教程区（21 项）
npm run verify         # 主管的全站冒烟（含 Wiki 外壳检查）
npm run build          # 类型检查 + 构建，并看 chunk 拆分是否还正常
```

`tools/verify-dst.mjs` **独立于**主管的 `tools/verify.mjs`，只管这个窗口的数据与交互。
为什么要单独一个：条目之间的引用只存 id，**页面不会因为引用写错而报错**，
它只会安静地少渲染一个按钮 —— 引用完整性必须单独验，不能指望冒烟测试顺手覆盖。

它跑的是这四类：

1. **引用完整性**：重复 id、悬空引用（配方材料 / `related`）、字段缺失（摘要 / 正文 / 别名）
2. **搜索**：`jft` / `jinfutou` / `wex` / `htb` / `wx78` / `金斧头` / `大力士` 都要命中，
   且 `zzzz`、`qqqq` 必须 0 结果（拼接串边界的回归）
3. **配方反查**：有配方的条目出「制作配方」（站台显示中文名，不能泄漏 `science` 这种原始 id）；
   材料类条目出「作为材料用于」并列出引用它的配方
4. **教程区**：能切进去、有独立搜索框、能切回来

## 七、踩过的坑（改之前先读）

- **拼接串子串匹配**：见第三节，最容易再犯
- **站台显示原始 id**：`recipe.station` 存的是 `science` / `none`，必须过 `stationName()` 换成中文，
  否则详情页会同时出现「科学机器」和 `science` 两种写法
- **卡片选择器**：左栏分类按钮也是 `li button`，选择器一定要限定在 `.wiki__feed` 内，
  否则会先点到左栏去（校验脚本里踩过一次）
- **分类角标不能从筛选后的列表算**：`BlogWindow` 的 `categoryCounts` 必须统计**全部已发布文章**，
  不能统计 `posts` —— `posts` 会随所选分类变化（选中「饥荒 Wiki」时只剩教程），
  拿它算角标会让其它分类全变成 0，切一下分类角标就跳。改成从 `feed.posts` 过滤 `state === 'open'` 之后才稳定。
- **同名条目重复**：写数据前先搜一眼 id 是否已存在（入口有去重兜底，但重复意味着有一份是白写的）
- **拼音库进首屏**：见第四节，改 import 关系后务必看构建产物的 chunk 大小
