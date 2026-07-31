# Livo 世界 · 蒂利亚之冬

一个交互原型：世界会因为你说过的话而长出后续。

在线演示：<https://mrhanjk2010.github.io/livo-pr-demo/>

## 这个 demo 在演什么

一列开往无人之境的列车。你在「回应这一刻」里说的话不会消失 —— 它成了因，
世界据此长出命运；走进命运聊出来的东西又成了新的因，一路往下接：

1. 你说想听一场音乐会 → 音乐厅亮了灯（潜在命运·夜场余音）
2. 夜场里聊到小提琴 → 第二天茶室多了一把（潜在命运·小提琴）
3. 琴送给了你 → 一周后开箱检查，琴腹替你挡了一次（命运·巡警检查）
4. 检查散场，你想到车头 → 锁了十天的折棚门开了（命运·藏进车头）

这条链在「世界背面」星图（地图右上角那枚按钮）里看得见：命运和回响并排摆
着，选中一枚就亮出汇聚进它的事件、时机，以及更早的那些因。

## 跑起来

```bash
npm install
npm run dev          # http://localhost:3000
```

根路径就是这个 demo，`/tilia/map` 渲染同一棵树（它是这个世界地图的规范地址，
也给后续子页留命名空间）。`/map` 是更早一版校园 demo，留着做对照。

手机屏两侧是演示用的系统级面板：左边讲这条因果链走到了哪一步，右边可以直接
跳到某个剧情节点，不用从头演一遍。

`回应这一刻` 里那条「世界如何理解你这句话」的链路默认走本地兜底逻辑；想接
真模型，配这几个环境变量到 `.env.local`：

```
OPENAI_API_KEY=...
OPENAI_BASE_URL=...   # 可选
OPENAI_MODEL=...      # 可选
```

## 检查与发布

```bash
npm run typecheck
npm run lint
bash scripts/deploy-pages.sh "提交说明"   # 静态导出并发布到 GitHub Pages
```

发布前要先停掉 `npm run dev` —— 脚本会重写 `next.config.ts` 并清掉 `.next`，
和 dev server 抢同一个目录会让导出静默漏页面。脚本开头有拦截。

## 目录

| 路径 | 是什么 |
| --- | --- |
| `src/components/tilia/` | 蒂利亚之冬的界面：地图、命运、聊天、世界背面星图 |
| `src/lib/tilia/` | 世界数据：车厢与房间、命运、回响、世界动态 |
| `src/components/map/` | 早期校园 demo 的地图，`/map` 还在用 |
| `public/figma/` | 设计稿切图与素材 |
| `scripts/deploy-pages.sh` | 静态导出 + 发布，踩过的坑都写在注释里 |

## 技术

Next.js 15（App Router）+ React 19 + TypeScript + Tailwind 4。界面按 Figma
设计稿实现，没有引 UI 组件库。
