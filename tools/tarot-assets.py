#!/usr/bin/env python3
"""
塔罗牌素材流水线：源图 → 应用素材（名字对得上）。

    python tools/tarot-assets.py            # 有变化才写
    python tools/tarot-assets.py --check    # 只看会改什么，不写盘
    python tools/tarot-assets.py --force    # 全部重编码

它解决的是一件具体的事：源素材的名字和应用素材的名字**不是同一套**，
换一张图之后必须再"翻译"一次，手做很容易漏、也容易张冠李戴
（2026-10-06 就发生过：78 张里有 46 张配错了牌，33 项校验还是全绿）。

    tarot/tarot-lab/AkaxiTarot/            public/tarot/cards/
      coins-10.png            ──────▶       Pents10.webp        （星币十）
      wands-king.png          ──────▶       Wands14.webp        （权杖国王）
      00-the-fool.png         ──────▶       Fool.webp           （愚者）

映射规则**只有这一份**（`RANK_OF_TAIL` / `SUIT_OF_PREFIX` / 大阿卡纳按序取 cards.json），
改名或换牌组时改这里。

⚠️ 为什么是 Python 而不是 .mjs（项目 tools/ 里其余都是 Node）：
   Node 内置模块**编不出 WebP**，而项目规矩是"不引依赖"（`sharp` 那种重家伙免谈）。
   Pillow 是这台机器上已有的，只在**改素材时**用一次，不进构建、不进产物。
   要求：python3 + Pillow（`python -c "import PIL"` 能过就行）。

⚠️ 这个脚本**验不出"图配错了牌"** —— 它能保证"名字对得上"（哪个文件该叫什么），
   但没法知道那张图画的到底是哪张牌。那一层只能靠肉眼比对牌面上印的牌名，
   见 docs/tarot.md 第三节。所以它会把每一张的对应关系打印出来，方便你扫一眼。
"""
from __future__ import annotations

import argparse
import io
import json
import os
import re
import sys

try:
    from PIL import Image
except ImportError:  # pragma: no cover
    sys.exit(
        "[tarot-assets] 需要 Pillow（这个脚本用它编码 WebP）。\n"
        "  装：python -m pip install Pillow\n"
        "  或直接用 DSH 自带那个 python（它已经带了 Pillow）。"
    )

# ⚠️ Windows 中文控制台默认是 GBK：输出里只要有一个 GBK 编不出的字符（emoji 之类）
# 就会 UnicodeEncodeError 直接崩掉 —— 而且是**跑到最后一行才崩**，前面的活儿白干。
# 所以：一、脚本里不用 emoji；二、这里兜一层 errors="replace"，编不出也不许崩。
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(errors="replace")
    except (AttributeError, ValueError):  # pragma: no cover - 老 Python / 被重定向
        pass

# 与应用侧一致：cards.json 的 link 前缀 ↔ 花色；宫廷牌尾名 ↔ 点数
SUIT_OF_PREFIX = {"Wands": "wands", "Cups": "cups", "Swords": "swords", "Pents": "coins"}
RANK_OF_TAIL = {"king": 14, "queen": 13, "knight": 12, "page": 11}
# 大阿卡纳尾部数字的步长：`01-the-magician` 这种
MAJOR_RE = re.compile(r"^(\d{2})-([a-z0-9-]+)$")
MINOR_RE = re.compile(r"^(wands|cups|swords|coins)-(.+)$")

# 与现有 78 张完全一致：q82 / method 6 / 转 RGB（源图四角是透明的，展平后的底色
# 本来就是卡边那层米色，而界面自己还会再切圆角，所以不留 alpha）
WEBP_QUALITY = 82
WEBP_METHOD = 6


def repo_root() -> str:
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load_cards(root: str):
    path = os.path.join(root, "src", "data", "tarot", "cards.json")
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def major_ids(cards) -> list[str]:
    """大阿卡纳按 cards.json 里的出现顺序 → link 去掉扩展名。顺序**就是** 00..21"""
    out = [c["link"].rsplit(".", 1)[0] for c in cards if not re.match(r"^(Wands|Cups|Swords|Pents)\d", c["link"])]
    return out


def card_id_of_stem(stem: str, majors: list[str]) -> tuple[str | None, str]:
    """源文件名（去扩展名）→ (牌 id, 说明)。认不出来就回 (None, 原因)"""
    m = MAJOR_RE.match(stem)
    if m:
        idx = int(m.group(1))
        if idx >= len(majors):
            return None, f"大阿卡纳编号 {idx:02d} 超出范围（只有 00~{len(majors) - 1:02d}）"
        cid = majors[idx]
        # 顺手核一下 slug 和牌名对不对得上（防止手滑改成别的名字）
        slug = re.sub(r"^the-", "", m.group(2))
        expect = cid.replace("_", "-").lower()
        expect = re.sub(r"^the-", "", expect)
        if slug != expect:
            return None, f"名字与牌对不上：文件名说 `{m.group(2)}`，牌表里第 {idx:02d} 张大阿卡纳是 `{cid}`"
        return cid, cid

    m = MINOR_RE.match(stem)
    if m:
        suit_src, tail = m.group(1), m.group(2)
        # 反查应用侧的前缀
        prefix = next((p for p, s in SUIT_OF_PREFIX.items() if s == suit_src), None)
        if prefix is None:
            return None, f"不认识的花色 `{suit_src}`"
        if tail in RANK_OF_TAIL:
            rank = RANK_OF_TAIL[tail]
        elif re.fullmatch(r"0[1-9]|10", tail):
            rank = int(tail)
        elif re.fullmatch(r"01-ace", tail):
            rank = 1
        else:
            return None, f"不认识的点数 `{tail}`"
        return f"{prefix}{rank:02d}", f"{prefix}{rank:02d}"

    return None, "文件名不符合命名方案（大阿卡纳 `NN-slug`、小阿卡纳 `<suit>-<rank>`）"


def encode(path: str) -> bytes:
    with Image.open(path) as im:
        buf = io.BytesIO()
        im.convert("RGB").save(buf, "WEBP", quality=WEBP_QUALITY, method=WEBP_METHOD)
        return buf.getvalue()


def main() -> int:
    root = repo_root()
    ap = argparse.ArgumentParser(description="塔罗牌素材流水线：源图 → public/tarot/cards/*.webp")
    ap.add_argument("--src", default=os.path.join(root, "tarot", "tarot-lab", "AkaxiTarot"),
                    help="源图目录（默认 tarot/tarot-lab/AkaxiTarot）")
    ap.add_argument("--out", default=os.path.join(root, "public", "tarot", "cards"),
                    help="输出目录（默认 public/tarot/cards）")
    ap.add_argument("--check", action="store_true", help="只报告，不写盘")
    ap.add_argument("--force", action="store_true", help="忽略内容比较，全部重编码")
    args = ap.parse_args()

    if not os.path.isdir(args.src):
        print(f"[tarot-assets] 找不到源目录：{args.src}", file=sys.stderr)
        print("  源素材不在仓库里（43 MB，不进构建）。要重新拿一份见 docs/tarot.md 第九节。", file=sys.stderr)
        return 2

    cards = load_cards(root)
    majors = major_ids(cards)
    known_ids = {c["link"].rsplit(".", 1)[0] for c in cards}

    plan: dict[str, str] = {}      # 牌 id -> 源文件
    errors: list[str] = []
    for name in sorted(os.listdir(args.src)):
        if name.startswith("."):
            continue
        full = os.path.join(args.src, name)
        if not os.path.isfile(full):
            continue
        if os.path.splitext(name)[1].lower() not in (".png", ".jpg", ".jpeg", ".webp"):
            continue
        stem = os.path.splitext(name)[0]
        cid, note = card_id_of_stem(stem, majors)
        if cid is None:
            errors.append(f"{name}：{note}")
            continue
        if cid not in known_ids:
            errors.append(f"{name}：推出的牌 id `{cid}` 不在牌表里")
            continue
        if cid in plan:
            errors.append(f"{name}：与 {plan[cid]} 撞同一个牌 id `{cid}`")
            continue
        plan[cid] = name

    missing = sorted(known_ids - set(plan))
    if missing:
        errors.append(f"牌表里有 {len(missing)} 张牌在源目录里找不到图：{', '.join(missing[:8])}"
                      + ("…" if len(missing) > 8 else ""))

    os.makedirs(args.out, exist_ok=True)
    added, updated, unchanged = [], [], []
    warnings: list[str] = []

    print(f"源目录：{args.src}")
    print(f"输出到：{args.out}")
    print(f"{'（--check：不写盘）' if args.check else ''}")
    print()

    for cid in sorted(plan):
        name = plan[cid]
        full = os.path.join(args.src, name)
        try:
            with Image.open(full) as im:
                size = im.size
                ratio = size[0] / size[1]
        except Exception as exc:
            errors.append(f"{name}：打不开（{type(exc).__name__}）")
            continue
        # 牌阵布局是按 350:600 算的 —— 比例不对会在牌阵里被裁掉一块
        if abs(ratio - 350 / 600) > 0.01:
            errors.append(f"{name}：比例 {ratio:.3f} ≠ {350 / 600:.3f}，会毁掉牌阵排版")
            continue
        if size != (350, 600):
            warnings.append(f"{name}：{size[0]}×{size[1]}（其余是 350×600，比例对所以能用）")

        data = encode(full)
        dest = os.path.join(args.out, f"{cid}.webp")
        old = None
        if os.path.exists(dest):
            with open(dest, "rb") as fh:
                old = fh.read()

        if old is None:
            state = "新增"
            added.append(cid)
        elif old == data:
            state = "未变"
            unchanged.append(cid)
        else:
            state = "更新"
            updated.append(cid)

        if not args.check and state != "未变":
            with open(dest, "wb") as fh:
                fh.write(data)
        elif not args.check and args.force:
            with open(dest, "wb") as fh:
                fh.write(data)

        print(f"  {state}  {name:<26} -> {cid}.webp   {size[0]}×{size[1]}")

    # 输出目录里的孤儿文件（源目录已经没有对应源图了）
    orphans = sorted(
        f for f in os.listdir(args.out)
        if f.endswith(".webp") and os.path.splitext(f)[0] not in known_ids
    )

    print()
    print(f"新增 {len(added)} · 更新 {len(updated)} · 未变 {len(unchanged)} · 共 {len(plan)} 张")
    if orphans:
        warnings.append(f"输出目录里有 {len(orphans)} 个牌表里没有的孤儿文件：{', '.join(orphans[:6])}")
    if warnings:
        print("\n提醒（不拦住）：")
        for w in warnings:
            print(f"  WARN  {w}")
    if errors:
        print("\n错误：", file=sys.stderr)
        for e in errors:
            print(f"  FAIL  {e}", file=sys.stderr)
        return 1

    print("\n完成。下一步跑 `npm run verify:tarot` 验一遍（它验存在性 / 可解码 / 比例）。")
    print('注意：它验不出"图配错了牌" —— 那一层只能肉眼比对牌面，见 docs/tarot.md 第三节。')
    return 0


if __name__ == "__main__":
    sys.exit(main())
