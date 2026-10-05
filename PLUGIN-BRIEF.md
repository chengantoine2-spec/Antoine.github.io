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

---

## 7. 我需要向站主确认的两点（别自己拍）

1. 「产品助理」要不要把历史**落到 `DSH_HOME` 下的文件**（换浏览器不丢）？—— 现在只在浏览器里。
2. 「芹菜耕地」面板除了嵌站点，是否还要 host 侧能力（起本地 dev server / 把站点当静态目录挂进 DSH）？
   现在 host 半边是**故意留空**的，落点已经留好，做不做等站主定。
