import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import matplotlib.font_manager as fm
import numpy as np
from pathlib import Path

# ── 字体：扫描系统找可用的中文字体 ──
CJK_CANDIDATES = [
    "C:/Windows/Fonts/msyh.ttc",       # Microsoft YaHei
    "C:/Windows/Fonts/msyhbd.ttc",     # Microsoft YaHei Bold
    "C:/Windows/Fonts/SimHei.ttf",     # SimHei
    "C:/Windows/Fonts/NotoSansSC-VF.ttf",
]
FONT_REG = None
FONT_BOLD = None
for fp in CJK_CANDIDATES:
    if Path(fp).exists():
        fm.fontManager.addfont(fp)
        FONT_REG = fm.FontProperties(fname=fp)
        FONT_BOLD = fm.FontProperties(fname=fp, weight="bold")
        break

if FONT_REG is None:
    raise RuntimeError("No CJK font found")

plt.rcParams["axes.unicode_minus"] = False

# ── 配色 ──
INK = "#131a1e"
ACCENT = "#b44d28"
GREEN = "#244c47"
SAND = "#d6b88f"
CREAM = "#fbf6ee"
BG = "#f5f0e8"
MUTED = "#8b8b8b"

# ── 数据 ──
d = np.linspace(0, 12000, 600)
score = 5000 * np.exp(-d / 2000)

# ── 画布 ──
fig, ax = plt.subplots(figsize=(13, 10))
fig.patch.set_facecolor(BG)
ax.set_facecolor(BG)

# ── 曲线 ──
ax.plot(d, score, color=ACCENT, linewidth=3.5, zorder=3,
        label="score = 5000 · e^(−d / 2000)")
ax.axhline(5000, color=MUTED, linewidth=0.8, linestyle="--", dashes=(6, 4), zorder=1)
ax.fill_between(d, 0, score, color=ACCENT, alpha=0.06)
ax.fill_between(d, score, 5000, color=GREEN, alpha=0.04)

# ── 标注 ──
annotations = [
    (0,    5000, "0 km"),
    (500,  3894, "500 km"),
    (1000, 3033, "1 000 km"),
    (2000, 1839, "2 000 km"),
    (3000, 1116, "3 000 km"),
    (5000, 411,  "5 000 km"),
]
for km, s, label in annotations:
    ax.scatter(km, s, color=INK, s=60, zorder=5, edgecolors="white", linewidth=1.5)
    ox, oy = (50, -14)
    ax.annotate(
        label, xy=(km, s), xytext=(ox, oy), textcoords="offset points",
        fontsize=16, fontproperties=FONT_BOLD, color=INK,
        ha="left" if km < 6000 else "right",
        arrowprops=dict(arrowstyle="->", color=MUTED, lw=0.8,
                        connectionstyle="arc3,rad=0.15"),
    )

# ── 坐标轴 ──
ax.set_xlim(-200, 12200)
ax.set_ylim(-300, 5500)
for spine in ["top", "right"]:
    ax.spines[spine].set_visible(False)
for spine in ["left", "bottom"]:
    ax.spines[spine].set_color(MUTED)
ax.tick_params(colors=MUTED, labelsize=14)
ax.xaxis.set_major_formatter(mticker.FuncFormatter(lambda x, _: f"{int(x):,}"))
ax.yaxis.set_major_formatter(mticker.FuncFormatter(lambda y, _: f"{int(y):,}"))
ax.grid(True, linestyle="--", alpha=0.25, color=MUTED)

# ── 标签（显式传 fontproperties） ──
ax.set_xlabel("猜测距离 (km)", fontsize=20, fontproperties=FONT_BOLD,
              color=INK, labelpad=12)
ax.set_ylabel("得分", fontsize=20, fontproperties=FONT_BOLD,
              color=INK, labelpad=12)

# ── 图例 ──

plt.tight_layout(pad=2)
out = "docs/diagrams/04-score-curve.png"
plt.savefig(out, dpi=200, bbox_inches="tight", facecolor=BG)
plt.close()
print(f"Saved → {out}")
