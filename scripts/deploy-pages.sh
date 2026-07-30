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
# 注意：这个脚本会 rm -rf .next 并临时改写 next.config.ts —— 正在跑的
# dev server 会被连累重启，跟着重建 .next 和 build 抢同一个目录，导出会
# 静默只剩 404.html（和下面第 5 条一模一样的假象）。所以开头直接拦住，
# 发布前先把 dev 停掉。
#
# 这套流程之前是手工敲的，每次都要记住四件容易忘的事，所以固化成脚本：
#
#   1. `output: 'export'` 不支持并行/拦截路由 —— `src/app/@modal` 那套
#      聊天浮层会让 build 直接失败（missing generateStaticParams）。所以
#      导出前要把 `@modal` 整个挪出 `src/app`，并临时换一个不带 modal
#      插槽的 layout；导出完再放回去。挪的目标目录必须在 `src/app` 之外，
#      否则 Next 仍然会去扫它。
#      连 `src/app/default.tsx` 也必须一起挪走 —— 它只是给拦截路由软导航
#      兜底的。留着它的话 build 会「成功」，日志还照样打 Exporting (12/12)，
#      但 `out/` 里只会落下 404.html，别的页面一个都不写出来（HTML 停在
#      `.next/server/app/` 里）。这个坑没有任何报错提示，所以导出后一定
#      要检查 out/index.html 在不在，下面有断言。
#      `src/app/api` 也一样：动态 route handler 在 export 下同样会让产物
#      只剩 404.html（同样不报错）。演示里那个 destiny-from-voice 接口有
#      本地兜底（generateDestinyImpactLocal），静态站少了它照样能演。
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
BASE_PATH="/$REPO"
DEPLOY_DIR="$ROOT/$REPO"
STASH="$ROOT/.deploy-stash"
MSG="${1:-Update static export}"

if [ ! -d "$DEPLOY_DIR/.git" ]; then
  echo "找不到部署仓 $DEPLOY_DIR（应该是 $REPO 的 git checkout）" >&2
  exit 1
fi

# dev server 和 build 抢 .next，抢输的那次不会报错，只会少页面。
if pgrep -f "next dev" >/dev/null 2>&1; then
  echo "检测到 next dev 还在跑 —— 先停掉它再发布（它会和 build 抢 .next，" >&2
  echo "导出会静默漏页面）。" >&2
  exit 1
fi

restore() {
  [ -d "$STASH/api" ] && rm -rf "src/app/api" && mv "$STASH/api" "src/app/api"
  [ -d "$STASH/@modal" ] && rm -rf "src/app/@modal" && mv "$STASH/@modal" "src/app/@modal"
  [ -f "$STASH/default.tsx" ] && mv -f "$STASH/default.tsx" "src/app/default.tsx"
  [ -f "$STASH/layout.tsx" ] && mv -f "$STASH/layout.tsx" "src/app/layout.tsx"
  [ -f "$STASH/next.config.ts" ] && mv -f "$STASH/next.config.ts" "next.config.ts"
  rmdir "$STASH" 2>/dev/null || true
}
# build 失败也要把源码模式恢复回来，否则本地 dev 会带着 export 配置跑。
trap restore EXIT

mkdir -p "$STASH"
cp next.config.ts "$STASH/next.config.ts"
cp src/app/layout.tsx "$STASH/layout.tsx"
[ -d src/app/api ] && mv src/app/api "$STASH/api"
[ -d src/app/@modal ] && mv src/app/@modal "$STASH/@modal"
[ -f src/app/default.tsx ] && mv src/app/default.tsx "$STASH/default.tsx"

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

# 去掉 modal 插槽的 layout。@modal 已经挪走，留着插槽会拿到 undefined。
python3 - <<'PY'
import re, pathlib
p = pathlib.Path("src/app/layout.tsx")
s = p.read_text()
s = re.sub(r"\n\s*modal,", "", s, count=1)
s = re.sub(r"\n\s*/\*\*(?:(?!\*/).)*?\*/\n\s*modal: React\.ReactNode;", "", s, count=1, flags=re.S)
s = re.sub(r"\n\s*modal: React\.ReactNode;", "", s, count=1)
s = re.sub(r"\n\s*\{modal\}", "", s, count=1)
p.write_text(s)
PY

rm -rf out .next
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
# 会把不在 out/ 里的文件全清掉。
rsync -a --delete \
  --exclude ".git" --exclude ".nojekyll" --exclude "README.md" \
  out/ "$DEPLOY_DIR/"
touch "$DEPLOY_DIR/.nojekyll"

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

cd "$DEPLOY_DIR"
git add -A
if git diff --cached --quiet; then
  echo "产物没有变化，跳过提交。"
else
  git commit -m "$MSG"
  git push
fi

echo
echo "已发布：https://mrhanjk2010.github.io${BASE_PATH}/"
