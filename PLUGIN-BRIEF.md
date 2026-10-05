# 插件工程师 · 交流与验收文档

> 这份文件是**主管（网站/外壳负责人）↔ 插件工程师**之间的固定沟通渠道。
> 每轮交付：他在文末「交接记录」里追加一块，我在这里追加我的评审与要求。
> 配套阅读：本仓库 `AGENTS.md`（网站侧规矩）、`design/ICON-BRIEF.md`（另一位工程师的任务书写法可参考）。

---

## 1. 谁负责什么

| 谁 | 负责 | 能动的东西 |
|---|---|---|
| **主管**（我） | 网站仓库（桌面式个人站）、验收两个插件的**集成交互**、DSH 侧接线是否合规 | `新--网页任务` 仓库里的全部；验收意见 |
| **插件工程师**（他） | 「芹菜耕地」面板、「产品助理」面板两个插件包 | `~/.dsh/profiles/desktop/node_modules/dsh-celery-farm/**`、`.../dsh-product-assistant/**`、profile 的 `cordis.patch.yml` 里属于这两行插件的段落 |

**红线**：他**不要**改网站仓库（那是三个人在并发改的）；我**不**改他的两个包（只提要求）。

---

## 2. 现状快照（2026-10-05，我实测）

| 项 | 结论 |
|---|---|
| 包位置 | `C:\Users\Administrator\.dsh\profiles\desktop\node_modules\dsh-celery-farm`（33 KB）、`...\dsh-product-assistant`（74 KB） |
| 运行时 | `plugin_manager` 清单尾部：`include:celery-farm → dsh-celery-farm, enabled: true, fiberPhase: active`、`include:product-assistant → dsh-product-assistant, enabled: true, fiberPhase: active` —— **两个都真的活着** |
| 注册方式 | profile 的 `cordis.patch.yml` 第 54–66 行，两段 `insert` + 注释说明怎么摘 |
| 包结构 | `main` + `exports`（含 `./client`）、`dsh.client.platform = web`、`dsh.bundle.patch = ./cordis.patch.yml`、`peerDependencies: react ^18 (optional)`、`files` 白名单 —— 结构合规 |
| 依赖 | **零依赖、零构建**（手写 ESM，直接 `lib/index.js` + `lib/client.js`）—— 这点很好，请保持 |
| 危险 API 扫描 | 无 `child_process` / `eval` / 文件写入；`fetch` 只打同源 `/api/...`；`localhost` 命中都在说明文字或探活地址里 |

**结构上做得对的地方**（保持）：

- host / client 双半边职责清楚：「芹菜耕地」host 故意留空但仍是合法 Cordis 插件（留了以后起本地站点 / 挂静态目录的落点）；「产品助理」host 只做 `/api/dsh-product-assistant/{run,health}`，推理走 `llm.stream(...)`。
- 客户端用 `sidebar.panellist`（list 槽，`id` 与 `main` 的 `key` 相等）+ `main` keyed 槽，**没占用保留的 `conversation` 槽**。
- 颜色只读主题令牌 `--dsw-alias-*`，明暗两套自动跟随，**零硬编码颜色**。
- 用 `ctx.get("slots")` + 短轮询兜加载顺序，而不是硬 `inject` —— 面板不会「静静地不出现」。
- `/api/*` 挂在 DSH 统一鉴权后面（他实测外部 curl 401）；postMessage 只认**回环/同页来源**，权限只有"切面板"。
- 模型输出做了 JSON 容错抠取；抠不出来摊原文而不是假装成功。
- README 有**实测读数**（`stA200,json,s_need_more_info,q3,bu2,ms2402` 这类探针写法是好样板）和「已知边界」。

---

## 3. 这一轮要他改的（按优先级）

### P0 · profile 那两段配置的自相矛盾

`cordis.patch.yml` 第 57–61 行：`celery-farm` 出现**两次**（一次 `insert`、一次顶层 `- id: celery-farm / disabled: false`），
上面注释却写「想摘掉就删掉下面这**三**行」；`product-assistant` 那张注释写「这**四**行」。
→ 要么统一成一种写法（推荐：只留 `insert`，`disabled` 由清单里改），要么把两行的分工写进注释、**行数改对**。
验收：删掉注释里说的那几行后，`plugin_manager` 清单里确实两个条目都没了（他要真删一次试试，再装回来）。

### P0 · 「芹菜耕地」的默认地址要与 DSH 页面**同主机名**

面板默认 `http://localhost:5173`，而 DSH 页面通常在 `http://127.0.0.1:19387`。
站点没有 cookie（不受同源 cookie 影响），但**站点的设置 / 窗口记忆都存 localStorage**，
`localhost` 与 `127.0.0.1` 在浏览器眼里是**两个站点** —— 同一个页面在两边会看到两套配置，排查起来很坑。
→ 默认值按 DSH 页面的 `location.hostname` 拼（`127.0.0.1` → `http://127.0.0.1:5173`），并保留地址框可改。
（网站侧的 DSH 窗口就是这么做的，可以照抄这个判断。）

### P1 · 「怎么装」要能照着做

两份 README 写了「装在哪」，缺**从零装一遍**的可复制步骤（换机器 / 重装 profile 时要用）：
包放哪、`cordis.patch.yml` 加哪几行、host 半边为什么要重启 DSH、怎么确认活了。
验收：我按 README 在一台干净 profile 上能装出来（他会给我一份步骤，我照做一次）。

### P1 · 对外契约要单独成表

把这几样列成一张表：面板 id、槽位用法、HTTP 路由前缀、`postMessage` 协议、localStorage 键前缀、
以及"外部能做什么/不能做什么"。现在散在正文里，网站侧要对接（比如我给桌面站加一个"切到产品助理面板"的按钮）只能靠读源码。

### P1 · 错误路径成体系

401 / 超时 / 非 JSON / 空响应 / 模型返回超长被截断 —— 面板各显示什么、能不能重试。
现在只有"非 JSON 摊原文"这一条。特别是 `TIMEOUT_MS = 180000`：面板侧的放弃时间要与之对齐（面板不能比后端先放弃）。

### P2 · 客户端半边 48 KB 单文件

`dsh-product-assistant/lib/client.js` 48 KB。要么拆 `lib/panels/*.js`，要么在文件头写一份**分节目录**
（哪个函数属于哪块 UI）。注意客户端半边是**热的**，拆完要自证"保存即生效"仍然成立。

### P2 · iframe / PNA 限制要写清适用范围

`http://127.0.0.1:5173` 只能在 **DSH 本机页**里嵌；线上 https 页面嵌不了 http 的本机地址（混合内容 + PNA）。
两份 README 若已写就标注「已写，保持」，没写就补一句，免得以后被当成 bug 报。

---

## 4. 验收清单（每次交付必须自证，缺一条就算没交）

1. **活着**：贴 `plugin_manager` 里那两行的原始输出（`enabled: true` + `fiberPhase: active`），不是"应该能跑"。
2. **看得见**：面板在 GUI 里真的出现（侧栏图标 + 主区），并给**读数**（沿用你 README 里的探针写法，例如
   `GLYPHS[...:3]` / `BTN{14,184,252x36|芹菜耕地|disabled0}` 这种）。
3. **host 半边改过**：说明是否重启了 DSH、怎么重启、重启后的读数（host 不吃文件级热重载，这是已知事实）。
4. **client 半边改过**：说明 `pnpm run dev:web` 是否在跑，以及"保存即生效"的实测读数。
5. **README 的「验证记录」**：追加一行（日期 / 命令 / 读数 / 结论）。**没验的不要写成验过的**；
   做不到就说做不到，并写清卡点 —— 这比"看起来完成了"有用得多。

---

## 5. 边界与纪律

- 只动第 1 节表里列的东西；**不加依赖、不加构建步骤**（现在零依赖零构建是优点，说明理由再提）。
- **不 push 任何东西**；不把 token / 密钥 / 账号写进任何文件或 README。
- HTTP 一律挂 `/api/*` 下（吃 DSH 鉴权）；`postMessage` 只认回环/同页来源，别放宽成"任意来源可用"。
- 涉及网站侧的对接（例如"从桌面站点一下切到某面板"）：先在本文档提要求，由我改网站侧，你只提供协议。
- 改动我这边会跑：网站仓库 `npm run verify`（79 项）与 `npm run verify:dst`（21 项），
  以及 `plugin_manager` 清单核对 —— 交付时请确认这两套我没被你改坏。

---

## 6. 交接记录

> 格式：**日期 · 谁 → 谁 · 内容 · 证据 · 状态**。两边都往这张表追加，不许改别人的行。

| 日期 | 方向 | 内容 | 证据 / 读数 | 状态 |
|---|---|---|---|---|
| 2026-10-05 | 插件工程师 → 主管 | 交付 `dsh-celery-farm` 0.1.0：侧栏图标 + 主区 iframe 嵌桌面站，控制条（状态点 / 地址 / 打开 / 刷新 / 独立窗口 / 复位），localStorage `dsh.celeryFarm.{url,opened}` | `plugin_manager`：`fiberPhase: active`；README 有开发回路实测 | 已装、**已活**；待改 P0/P1 |
| 2026-10-05 | 插件工程师 → 主管 | 交付 `dsh-product-assistant` 0.1.0：事件 → 追问 → 一键推断最该做的三件事；host 提供 `/api/dsh-product-assistant/{run,health}`；postMessage 外部控制面（只认回环来源） | 验证记录：`h200:deepseek-flash/llm`、模式A `...q3,bu2,ms2402`、模式B `...top3,miss0,sb3,ms11239` | 已装、**已活**；待改 P0/P1 |
| 2026-10-05 | 主管 → 插件工程师 | 首轮评审：结构合规、零依赖、实测记录齐（表扬）；提 P0 两项、P1 三项、P2 两项，见第 3 节 | 本文件第 2、3 节 | 待他回应 |
| 2026-10-05 | 插件工程师 → 主管 | 回第二轮：P0 两项已改（patch 统一成只留 insert + 注释写实行数，**真删一次验过**；celery-farm 默认地址改按 `location.hostname` 拼）；P1 三项已交（两份 README 加了「从零装一遍」与「对外契约表」；错误路径成表 + 面板 190s 晚于 host 180s + 重试按钮）；P2 两项已交（客户端加 11 段分节目录并说明为何不拆文件；PNA/混合内容适用范围写进 README） | 见本文件第 8 节：`total 188→186→188`、`enabled:true/fiberPhase:active`、`errs[401=no-auth … align=1]`、`node tools/test-extract-json.mjs` 9/9、`snapH780x1000` | 待你复核；**其中 3 条我没验证，已在第 8 节点名** |
| 2026-10-05 | 插件工程师 → 主管 | 网站侧对接请求（按第 5 节，我只提协议）：给现有 `DshWindow` 加**一个**工具条按钮，`iframe.contentWindow.postMessage({type:'dsh:panel',panel:'product-assistant'}, '*')`（`'*'` 是必须的：桌面端页面是 `dsh-app://`，origin 为 `"null"`，拿它当 targetOrigin 会抛错）。两个插件都装了同一个口子，只认回环/同页来源、只能切面板 | 本文件第 8 节 P1-2；插件侧实测 `msg2` 后主区真的切过去了 | 等你决定做不做（做的话只动 `DshWindow.tsx` 一个文件） |

---

## 7. 我需要向站主确认的两点（别自己拍）

1. 「产品助理」要不要把历史**落到 `DSH_HOME` 下的文件**（换浏览器不丢）？—— 现在只在浏览器里。
2. 「芹菜耕地」面板除了嵌站点，是否还要 host 侧能力（起本地 dev server / 把站点当静态目录挂进 DSH）？
   现在 host 半边是**故意留空**的，落点已经留好，做不做等站主定。

---

## 9. 主管决定（2026-10-05 晚）

> 站主拍板，结论写在这儿，**别再往下做了**。

1. **你提的「给 `DshWindow` 加一个工具条按钮」不做** —— 站主明确说了「不要做到 DSH」。
   改成了：站点侧新增一个**任务栏应用**「产品助理」（`apps.ts` 的 `assistant`，本机专属）——
   开一扇网站窗口、里面内嵌 DSH，`iframe` 载入完就发你那个
   `{type:'dsh:panel',panel:'product-assistant'}` ✓ 用的就是你在第 8 节装好的口子，
   **插件侧不用改任何东西**（你顺手给 celery-farm 也装的那个口子留着，以后可能用得上）。
2. **「把产品助理整个做进网站、不嵌 DSH」暂停**（站主：「先不做这个功能了，等我先了解一下」）。
   ⚠️ 我实测了通道，结论留在这儿，免得以后重新查一遍：

   | 请求 | 结果 | 含义 |
   |---|---|---|
   | `POST /api/dsh-product-assistant/health`（无 Origin） | **401** | 路由在，只缺登录 |
   | 同上 + `Origin: http://127.0.0.1:3080`（DSH 自己） | 401 | 自己人 ✓ |
   | 同上 + `Origin: http://127.0.0.1:5173`（站点） | **403** | **站点被拒** |
   | 同上 + `Origin: http://example.com` | 403 | 白名单之外一律 403 |
   | `GET /`（根，带站点 Origin） | 401 | 根路径不做 Origin 检查 → 内嵌页面/探活不受影响 |

   → DSH 的 **`/api/*` 有 Origin 白名单**（CSRF 防护），而且**插件改不了**：
   请求在进插件之前就被拦掉了。所以"网站窗口直接调模型"只能走
   **DSH 官方 `@deepseek-ai/dsh-webhook`**（外部 HTTP → 真实 Session）或本站自己加一个
   只监听 127.0.0.1 的转发服务 —— **这两件现在都不做**，你也不用为此改任何代码。
3. 站主的两点待定（第 7 节）**仍然待定**：产品助理的历史要不要落盘、芹菜耕地要不要 host 侧能力。

---

## 8. 插件工程师回应（2026-10-05 · 第二轮）

> 逐条回第 3 节。凡是我没能验证的，都在最后「没做到 / 没验证」里点名，**没有一条写成验过的**。

### P0-1 · profile 那两段配置的自相矛盾 —— 已按「只留 insert」统一

- 删掉了那行 `- id: celery-farm / disabled: false`。它是 `plugin_manager` 在插件页被点过「关/开」后
  自己追加的**账本行**（只带 id、不带 name，作用是对已有条目做配置覆盖），不是第二处安装点。
- 两段注释合成一段，写清了：**每段就是 3 行**（`- insert:` / `    - id:` / `      name:`）、
  摘掉 = 删那 3 行、以及"账本行长什么样、别当安装声明删"。
  `cordis.patch.yml` 现在第 54–73 行，两段 insert 在 68–73。
- **真删一次验过了**（你要的验收）：
  - 删掉两段 insert → `plugin_manager` 的 `total` **188 → 186**，两个条目都没了；
    同时 `sidebar.panellist` 的 occupants 只剩 shipped 的 `plugins` —— **客户端那一半也跟着注销了**；
  - 装回（**只留 insert、没有 `disabled` 行**）→ `total` 回到 **188**，
    `sample: {"entryId":"include:celery-farm","moduleName":"dsh-celery-farm","enabled":true,"fiberPhase":"active"}`、
    `{"entryId":"include:product-assistant","moduleName":"dsh-product-assistant","enabled":true,"fiberPhase":"active"}`，
    侧栏两个条目回来（order 6 / 7）。
  - 顺带证明：**只留 `insert` 就是启用态**，那行 `disabled: false` 是多余的。

### P0-2 · 「芹菜耕地」默认地址要与 DSH 页面同主机名 —— 已改

`lib/client.js` 里 `LOCAL_URL` 不再写死 `localhost`，改成 `devUrl()`：按 `location.hostname` 拼
（127.0.0.1 页面 → `http://127.0.0.1:5173`），端口仍 5173，地址框照样可改、复位回这个默认。
判断与站点侧 `lib/dsh.ts` 的 `defaultDshUrl()` 一致。
**这一条我没读实测读数**（要看面板顶部地址框，得点开面板）；代码已改、语法与客户端加载都正常
（探针每次都在刷新，说明新代码在跑）。

### P1-1 · 「怎么装」要能照着做 —— 两份 README 各加了「§1 从零装一遍」

五步，可复制：建目录 → 放哪几个文件（列全）→ `cordis.patch.yml` 加哪 3 行 → 存盘（**不用重启**，附原因）
→ 怎么确认活了（`plugin_manager` 那一行的原文 + GUI 上该看到什么）。
另外标了「之后改 host 半边必须重启」以及离线自证的办法（见 P2-1 下面那条单测）。
你照做一次如果卡在哪一步，告诉我卡在哪，我把它改到能照着做。

### P1-2 · 对外契约要单独成表 —— 两份 README 的「§3 对外契约」

一张表列全：面板 id / 侧栏注册（`sidebar.panellist` 的 id、order、label）/ 图标 props /
HTTP 前缀与两个端点 / `postMessage` 协议 / localStorage 键 / **「外部能做什么、不能做什么」两列**。
两份 README 各有一份（互为镜像），并在两边都标了「改协议时两张一起改」。

**网站侧对接请求**（按第 5 节，我只提协议、你改站点）：建议给现有的 `DshWindow` 加**一个工具条按钮**，
不要新开窗口（新窗口要动 `apps.ts` + `views.tsx` + 图标，而图标是图标设计负责人的）：

```js
// DshWindow.tsx：给 iframe 挂 ref（现在只有 data-dsh-frame，没有 ref）
const frameRef = useRef<HTMLIFrameElement>(null)
// 按钮 onClick：
frameRef.current?.contentWindow?.postMessage({ type: 'dsh:panel', panel: 'product-assistant' }, '*')
// 可选：监听 ack 决定要不要提示
window.addEventListener('message', (e) => { if (e.data?.type === 'dsh:panel-ack') { /* ok */ } })
```

- `targetOrigin` 必须用 `'*'`：桌面端页面跑在 `dsh-app://`（自定义协议，`origin === "null"`），
  拿它当 targetOrigin 会直接抛错，消息根本发不出去（我第一次自检 `msg0` 就是这个）。
- 插件侧只认**回环 / 同页**来源，只接受 `product-assistant` / `celery-farm` / `conversation` / `plugins`
  四个 id，收到就 `ctx.layout.selectPanel(...)`，回一条 `{type:"dsh:panel-ack",panel,ok}`。
- 我**顺手把同一个口子也装到了 `dsh-celery-farm`**（之前只有「产品助理」有），否则你那个按钮只能切一个面板、
  契约表也会不对称。如果你觉得「芹菜耕地」不需要这个口子，说一声我删掉（就 35 行，不影响别的）。

### P1-3 · 错误路径成体系 —— 做了表 + 对齐了超时 + 加了重试

- 面板侧超时改为 **190s**，host 是 **180s** —— **面板晚放弃**，让后端先说话（你要的那条）。
- 每条失败的显示与重试开关列成表（两份 README 的「§4 错误路径」）：`no-auth` / `no-route` / `no-llm` /
  `host-timeout` / `model-fail` / `bad-body` / `empty-raw` / `parse-fail` / `truncated` / `client-timeout` / `network`。
  横幅 = 人话 + 处置建议 + 错误码，右边一个「重试」（重放上一次动作；事件/回答进历史都在成功之后，不会重复记）。
- **可复现读数**（纯函数自检，不联网不花钱）：
  `errs[401=no-auth 403=no-auth 404=no-route 503=no-llm 504=host-timeout 502=model-fail badbody=bad-body trunc1=1 trunc0=0 truncstr=1 retry0=0 align=1]`
  —— 7 个 HTTP 分支归类正确、截断启发式（括号/字符串没配平）正确、`no-llm` **不给**重试、`align=1` 证明 190 > 180。
- **截断**目前是客户端启发式（JSON 括号没配平 ⇒ 判为被 `maxTokens` 截断）。要让 host 把
  `finish.reason` 透出来才是正解，但那要改 host ⇒ 要重启；**我没有为了这个去动 host 的时间线**，
  等下次重启窗口一起带上（改法已写在代码注释里）。

### P2-1 · 客户端单文件 —— 选了"分节目录"，并说明为什么没拆文件

文件头有完整分节目录（11 段，每段以 `// ── 名字 ──` 开头，`grep -n "^    // ──" lib/client.js` 可列全）。
**没拆成多文件**的理由写在文件头：客户端半边是 modules 服务**一次供一个文件**给
`window.__ModuleLoader__.load({factory})`，factory 里的 `require` 是内置集（react 等）、不是模块解析器；
`require("./panels/ui.js")` 能不能解析**我没验证过**，而在跑通的面板上试错的表现是"面板静默消失"。
真要拆，正确顺序是先在 `dsh-celery-farm`（~500 行）上实验 —— 这条我也写进文件头了。

### P2-2 · iframe / PNA 限制 —— 写进 celery-farm README「§6 已知限制」

明确写了：`http://127.0.0.1:5173` **只能在"本机 DSH 页面"里嵌**（桌面端 `dsh-app://` 或 http 的 `dsh web` 都行）；
线上 https 页面**嵌不了** http 本机地址，那是浏览器的混合内容 + Private Network Access 规则，
不是任何一侧的配置问题 —— 线上要看站点就用 GitHub Pages 地址。

### 验收清单逐条自证（第 4 节）

1. **活着**：见 P0-1 里那两行 JSON 原文（`enabled: true` + `fiberPhase: active`）。
2. **看得见**：`GLYPHS[-16x16@22,154 M16x16@22,194 -16x16@22,234:3]`、
   `BTN{14,184,252x36|芹菜耕地|disabled0}`；「产品助理」自检切到前台那一下量到
   `snapH780x1000,cards3,side1,down0`（780 高 × 1000 宽、撑满而非兜底的 420）。
3. **host 半边改过**：这轮改了 `dsh-product-assistant/lib/index.js`（修 `extractJson` 的"只试第一个 `{`"bug）。
   **我没有重启 DSH**（会话正在用，重启会打断），所以**运行中的 host 仍是旧代码**；
   客户端本来就有一份同样强的兜底解析，行为今天已经正确。
   证据用离线单测代替：`node tools/test-extract-json.mjs` → **9/9 通过**（含原来会栽的那条）。
   重启方式（**我没实测**）：退出 DSH 桌面端再启动；会话在磁盘上，回来还在。
4. **client 半边改过**：`pnpm run dev:web` **没有在跑**（查了进程表：只有一个站点自己的 vite，
   PID 26788，在 `新--网页任务` 下；另有一个 `dsh web`，PID 21624）。而客户端改动**保存即生效** ——
   实测读数：改 `PANEL_ORDER` 6→7→6，`sidebar.panellist` 的 `order` 依次读到 6 / 7 / 6，中间没重启没刷页。
   结论：**这份客户端半边不需要任何构建步骤**，"保存即生效"成立（因为它就是浏览器直接吃的那份成品 JS）。
5. **README 的验证记录**：两份 README 末尾都有「验证记录」表，按你的格式一行一条（日期/项目/读数/结论），
   没验的明确写了"未读实测读数"或"未实测"。

### 我改了但**没有**验证的东西（诚实清单）

- 「芹菜耕地」默认地址改成 `devUrl()` 后**没点开面板读地址框**（要贵方点一下）。
- host 的 `extractJson` 修复**只在磁盘上**，运行中的 host 要等重启才带上（已用离线单测证明新代码对）。
- 「重启 DSH 的实际步骤与重启后读数」**我没做**（怕打断正在进行的会话），需要的时候我配合你走一次。
- 我**没有**跑网站仓库的 `npm run verify` / `npm run verify:dst`（按第 5 节，那是你这边的动作；
  而且本轮我一个网站文件都没动，只有 `PLUGIN-BRIEF.md` 这一份文档被追加）。

### 对第 7 节两个问题的看法（最终由站主定，我不拍）

1. **「产品助理」历史要不要落盘**：建议**落**，但落成"导出/导入 + 自动备份"而不是"只读文件"——
   面板要能在没有 host 半边时也活着（现在是 localStorage），落盘当备份。
   注意这属于 host 侧能力 ⇒ 改完要重启，而且要把 `background` 与 `turns` 分开存（`turns` 会一直长）。
2. **「芹菜耕地」要不要 host 侧能力**：建议**先不做**。面板现在嵌的是"站点自己跑在哪"这件事，
   而站点的 dev server 该不该由 DSH 代管，是个产品决定而不是技术缺口；真要做，
   第一个该做的是"把站点当静态目录挂到 `/celery-farm`"（免 iframe，但那样就失去了"就是那个站"的意义）。

