#!/usr/bin/env bash
#
# 静态导出 + 发布到 GitHub Pages。
#
# 目标仓用 REPO 指定（同名的本地 checkout 目录 + 同名的 basePath）：
#
#   bash scripts/deploy-pages.sh "提交说明"                    # livo-world-demo
#   REPO=livo-pr-demo bash scripts/deploy-pages.sh "提交说明"   # 对外演示那份
#
# 两份产物内容一样，分开只是为了各有各的链接：world-demo 是长期在跑的那
# 个，pr-demo 是拿出去讲的那个，随时可以停在某个版本上不动。
#
# 版本（VERSION）：
#
#   VERSION=v2 REPO=livo-pr-demo bash scripts/deploy-pages.sh "说明"
#
# 给了 VERSION 就发到 `<仓>/<版本>/` 下，basePath 跟着变成 `/仓/版本`，站点根
# 只留一个跳转页指向最新那一版（PROMOTE=1，默认）。重建一个旧版本时带
# PROMOTE=0，免得旧版把根抢过去。版本号会以 NEXT_PUBLIC_DEMO_VERSION 注入构
# 建，产物里的版本切换器靠它认出「当前是哪一版」（见 src/lib/demo-versions.ts）。
#
# 重建旧版本用 git worktree（源码是旧的，部署仓还是主仓那个 checkout）：
#
#   git worktree add .attic/v1-src demo-v1
#   cd .attic/v1-src && ln -s ../../node_modules .        # 依赖没变，借主仓的
#   DEPLOY_BASE=<主仓绝对路径> VERSION=v1 PROMOTE=0 REPO=livo-pr-demo \
#     bash scripts/deploy-pages.sh "重建 v1"
#
# 注意：这个脚本会 rm -rf .next 并临时改写 next.config.ts —— 正在跑的
# dev server 会被连累重启，跟着重建 .next 和 build 抢同一个目录，导出会
# 静默只剩 404.html（和下面第 5 条一模一样的假象）。所以开头直接拦住，
# 发布前先把 dev 停掉。
#
# 这套流程之前是手工敲的，每次都要记住四件容易忘的事，所以固化成脚本：
#
#   1. `src/app/api` 要挪走：动态 route handler 在 export 下会让产物只剩
#      404.html，别的页面一个都不写出来（HTML 停在 `.next/server/app/`
#      里），而且不报错 —— build 照样打 ✓ Exporting (12/12)。所以导出后
#      一定要检查 out/index.html 在不在，下面有断言。演示里那个
#      destiny-from-voice 接口有本地兜底（generateDestinyImpactLocal），
#      静态站少了它照样能演。
#      （聊天浮层曾经也在这一条里：它以前是 `src/app/@modal` 那套拦截路由，
#      export 不支持，每次发布都得把整个插槽搬出去 —— 于是线上根本没有进
#      群聊的动效。现在浮层归地图页自己管，见 lib/mobile/drill，不用搬了。）
#   2. Pages 部署在子路径下，需要 basePath / assetPrefix。
#   3. `/figma/`、`/media/` 这些写死在组件里的绝对路径，next/image 之外
#      的引用（CSS url()、预加载、纯 <img>）不会自动带上 basePath，
#      导出后要统一改写一遍，否则线上图全裂。改写前先跳过已经带前缀的，
#      重复跑不会叠成 /livo-world-demo/livo-world-demo/。
#   4. Pages 默认走 Jekyll，会吃掉 `_next` 这种下划线开头的目录，必须留
#      `.nojekyll`。
#   5. 本机 node 是 25，Next 15.5.15 在它上面导出会静默漏掉全部 HTML ——
#      build 打 ✓ Exporting (12/12)、export-detail.json 还写 success: true，
#      但 out/ 里只有 404.html 和 public 资源。所以 build 固定跑在下面
#      pin 的 node 22 上（第一次会联网拉一次，之后走 npm 缓存）。
#
# 用法：bash scripts/deploy-pages.sh "提交说明"

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

REPO="${REPO:-livo-world-demo}"
BUILD_NODE="22.14.0"
VERSION="${VERSION:-}"
PROMOTE="${PROMOTE:-1}"
# 部署仓所在的目录。默认就在源码仓边上；从 worktree 里重建旧版本时指到主仓。
DEPLOY_BASE="${DEPLOY_BASE:-$ROOT}"
REPO_DIR="$DEPLOY_BASE/$REPO"
STASH="$ROOT/.deploy-stash"
MSG="${1:-Update static export}"

if [ -n "$VERSION" ]; then
  BASE_PATH="/$REPO/$VERSION"
  DEPLOY_DIR="$REPO_DIR/$VERSION"
else
  BASE_PATH="/$REPO"
  DEPLOY_DIR="$REPO_DIR"
fi

if [ ! -d "$REPO_DIR/.git" ]; then
  echo "找不到部署仓 $REPO_DIR（应该是 $REPO 的 git checkout）" >&2
  exit 1
fi
mkdir -p "$DEPLOY_DIR"

# dev server 和 build 抢 .next，抢输的那次不会报错，只会少页面。
if pgrep -f "next dev" >/dev/null 2>&1; then
  echo "检测到 next dev 还在跑 —— 先停掉它再发布（它会和 build 抢 .next，" >&2
  echo "导出会静默漏页面）。" >&2
  exit 1
fi

restore() {
  [ -d "$STASH/api" ] && rm -rf "src/app/api" && mv "$STASH/api" "src/app/api"
  [ -f "$STASH/next.config.ts" ] && mv -f "$STASH/next.config.ts" "next.config.ts"
  rmdir "$STASH" 2>/dev/null || true
  # .next 是按「少了 api 路由」那份源码算出来的，留着会让紧接着的 dev /
  # typecheck 拿到对不上的类型。
  rm -rf .next
}
# build 失败也要把源码模式恢复回来，否则本地 dev 会带着 export 配置跑。
trap restore EXIT

mkdir -p "$STASH"
cp next.config.ts "$STASH/next.config.ts"
[ -d src/app/api ] && mv src/app/api "$STASH/api"

cat > next.config.ts <<CONFIG
import type { NextConfig } from "next";

/** 静态导出配置，由 scripts/deploy-pages.sh 临时写入。 */
const nextConfig: NextConfig = {
  output: "export",
  basePath: "$BASE_PATH",
  assetPrefix: "$BASE_PATH",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
CONFIG

rm -rf out .next
# 版本号进构建：产物里的版本切换器靠它认出自己是哪一版，以及去别版的地址前缀。
NEXT_PUBLIC_DEMO_VERSION="$VERSION" \
NEXT_PUBLIC_DEMO_BASE="/$REPO" \
  npm exec -y --package="node@$BUILD_NODE" -- node ./node_modules/next/dist/bin/next build

# 断言：Next 在这个坑上不报错，只能自己查。少了首页就说明导出被跳过了，
# 这时候绝对不能往部署仓 rsync（--delete 会把线上页面全删掉）。
# 聊天页也要点名：它们靠 generateStaticParams 枚举（见 src/lib/chat-locations.ts），
# dev 下按需渲染所以漏了不报错，只有线上点进去才是 404。
for must in out/index.html out/tilia/map/index.html out/tilia/continent/index.html out/map/index.html \
  "out/chat/room:tea-room/index.html" "out/chat/餐车·巡警检查/index.html" \
  "out/chat/驾驶室·车头风声/index.html"; do
  if [ ! -f "$must" ]; then
    echo "导出不完整：缺 $must —— 中止，部署仓未改动。" >&2
    exit 1
  fi
done

# 同步产物。保留部署仓自己的东西（.git / .nojekyll / README）—— --delete
# 会把不在 out/ 里的文件全清掉。发到根目录时还要护住各版本子目录和跳转页，
# 否则一次根部署就把线上所有历史版本删干净了。
rsync -a --delete \
  --exclude ".git" --exclude ".nojekyll" --exclude "README.md" \
  --exclude "/v[0-9]*/" \
  out/ "$DEPLOY_DIR/"
touch "$REPO_DIR/.nojekyll"

# 站点根的跳转页：分享出去的短链永远落到最新那一版。
if [ -n "$VERSION" ] && [ "$PROMOTE" = "1" ]; then
  cat > "$REPO_DIR/index.html" <<HTML
<!doctype html>
<meta charset="utf-8">
<title>蒂利亚之冬 · demo</title>
<!-- 由 scripts/deploy-pages.sh 写入：站点根只负责把人送到最新那一版。 -->
<meta http-equiv="refresh" content="0; url=./$VERSION/tilia/map/">
<link rel="canonical" href="./$VERSION/tilia/map/">
<body style="margin:0;background:#0a0a0a;color:#888;font:14px/1.6 -apple-system,system-ui,sans-serif">
<p style="padding:24px">正在进入最新版本 $VERSION …
<a href="./$VERSION/tilia/map/" style="color:#6dffa8">直接打开</a></p>
<script>location.replace("./$VERSION/tilia/map/")</script>
HTML
  # 分目录之前发出去的深链（/tilia/map/ 之类）现在落在空处。Pages 对站内未
  # 知路径一律回 404.html，就借它把人送回根跳转页 —— 注意必须写绝对路径，
  # 相对的 "./" 在深链下会指回它自己，转成死循环。
  cat > "$REPO_DIR/404.html" <<HTML
<!doctype html>
<meta charset="utf-8">
<title>蒂利亚之冬 · demo</title>
<meta http-equiv="refresh" content="0; url=/$REPO/">
<body style="margin:0;background:#0a0a0a;color:#888;font:14px/1.6 -apple-system,system-ui,sans-serif">
<p style="padding:24px">这个地址下没有页面了 —— 演示改成按版本分目录。
<a href="/$REPO/" style="color:#6dffa8">去最新那一版</a></p>
<script>location.replace("/$REPO/")</script>
HTML
fi

# 把漏掉 basePath 的绝对资源路径补上。`[^l]` 之类的判断不可靠，直接先
# 把已带前缀的还原成裸路径，再统一加前缀 —— 天然幂等。
find "$DEPLOY_DIR" \
  -type d -name ".git" -prune -o \
  -type f \( -name "*.html" -o -name "*.js" -o -name "*.css" -o -name "*.txt" -o -name "*.json" \) \
  -exec sed -i '' \
    -e "s#$BASE_PATH/figma/#/figma/#g" \
    -e "s#$BASE_PATH/media/#/media/#g" \
    -e "s#\"/figma/#\"$BASE_PATH/figma/#g" \
    -e "s#'/figma/#'$BASE_PATH/figma/#g" \
    -e "s#(/figma/#($BASE_PATH/figma/#g" \
    -e "s#\"/media/#\"$BASE_PATH/media/#g" \
    -e "s#'/media/#'$BASE_PATH/media/#g" \
    -e "s#(/media/#($BASE_PATH/media/#g" \
    {} +

restore
trap - EXIT

cd "$REPO_DIR"
git add -A
if git diff --cached --quiet; then
  echo "产物没有变化，跳过提交。"
else
  git commit -m "$MSG"
  git push
fi

echo
echo "已发布：https://mrhanjk2010.github.io${BASE_PATH}/tilia/map/"
if [ -n "$VERSION" ] && [ "$PROMOTE" = "1" ]; then
  echo "根地址已指向本版：https://mrhanjk2010.github.io/$REPO/"
fi
