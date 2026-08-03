/**
 * 演示版本登记表。
 *
 * 这个 demo 是拿出去讲的，讲的过程里它一直在改 —— 所以线上不是「一份最新」，
 * 而是每次发布各留一份：`/<站点>/v1/`、`/v2/`……站点根只放一个跳转页，指向最新
 * 那一版。分享出去的短链因此永远是最新的，而说过「上次那版是这样」的时候，上
 * 次那版还在原地。
 *
 * 每一版都是一次完整的静态导出（自己的 `_next`、自己的图），版本之间不共享任何
 * 东西 —— 只有这样旧版才真的还是旧版，不会被后来的资源改掉。
 *
 * 两个值由发布脚本在构建时注入（见 `scripts/deploy-pages.sh`）：
 *
 *   NEXT_PUBLIC_DEMO_VERSION  这份产物是哪一版，决定切换器里谁是「当前」
 *   NEXT_PUBLIC_DEMO_BASE     站点根（`/livo-pr-demo`），拼别的版本的地址用
 *
 * 本地 `npm run dev` 两个都是空的：切换器照样显示（讲的时候看得见有几版），但不
 * 让跳 —— 本地只有一份代码，跳过去只会 404。
 */

export type DemoVersion = {
  /** 目录名，也是版本号。 */
  id: string;
  /** 这一版的名字，取那一版最显眼的那个改动。 */
  label: string;
  date: string;
  /** 一句话：这一版多了什么。 */
  note: string;
};

/** 新的排前面 —— 第一条就是最新那一版，根目录的跳转页指向它。 */
export const DEMO_VERSIONS: readonly DemoVersion[] = [
  {
    id: "v4",
    label: "布线星图",
    date: "08-03",
    note: "连线改走圆角折线，世界背面看着像一块还通着电的板子",
  },
  {
    id: "v3",
    label: "光点星图",
    date: "07-31",
    note: "静息态收成光点，挑中哪一簇才现出头像、光球与蝶形",
  },
  {
    id: "v2",
    label: "世界背面",
    date: "07-31",
    note: "混排成一张网、底部运转日志、新事件陆续到场、连线上有微光在跑",
  },
  {
    id: "v1",
    label: "世界命运",
    date: "07-30",
    note: "回响星图接入命运节点与因果链，翻转进出场",
  },
];

/** 这份产物是哪一版；本地 dev 下是空串。 */
export const DEMO_VERSION_ID = process.env.NEXT_PUBLIC_DEMO_VERSION ?? "";
/** 站点根（不含版本段）；本地 dev 下是空串。 */
export const DEMO_BASE = process.env.NEXT_PUBLIC_DEMO_BASE ?? "";

/**
 * 某一版的地图页地址。
 *
 * 故意不用 `next/link`：它会给站内路径自动加上 basePath，而 basePath 里已经带
 * 着当前版本号了（`/livo-pr-demo/v2`），加完就成了
 * `/livo-pr-demo/v2/livo-pr-demo/v1/`。跨版本跳转在 Next 眼里是站外链接，只能走
 * 裸 `<a href>`。
 */
export function demoVersionHref(id: string): string {
  return `${DEMO_BASE}/${id}/tilia/map/`;
}
