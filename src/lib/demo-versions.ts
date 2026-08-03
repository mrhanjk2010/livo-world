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
 *
 * ## 名单为什么要现取
 *
 * 表本身跟着构建走，所以一份产物天然只认得「它出生那天存在的版本」：v3 里列的
 * 是 v1–v3，v6 发出去之后它还是只列到 v3 —— 切进旧版就等于把自己关在里面，回不
 * 到最新那一版。以前的办法是每发一版把老版本全部重建一遍，六版之后没人记得住，
 * 结果就是 v1 停在 v2、v2–v5 停在 v5。
 *
 * 所以名单改成运行时去站点根取一份 `versions.json`（发布脚本每次都会写，见
 * `scripts/deploy-pages.sh`）：谁都读同一份，新版本发出去，所有旧版下一次打开就
 * 看得到。构建时那份留作兜底 —— 取不到（离线、老产物、本地 dev）就还用它，至少
 * 是当时那份名单，不至于空掉。
 */

import { useEffect, useState } from "react";
import BAKED from "./demo-versions.json";

export type DemoVersion = {
  /** 目录名，也是版本号。 */
  id: string;
  /** 这一版的名字，取那一版最显眼的那个改动。 */
  label: string;
  date: string;
  /** 一句话：这一版多了什么。 */
  note: string;
};

/**
 * 构建时那份名单，新的排前面 —— 第一条就是最新那一版，根目录的跳转页指向它。
 *
 * 单独存成 JSON 是为了发布脚本能原样拷到站点根当 `versions.json`：一处维护，
 * 线上所有版本读的都是它。
 */
export const DEMO_VERSIONS: readonly DemoVersion[] = BAKED;

/** 这份产物是哪一版；本地 dev 下是空串。 */
export const DEMO_VERSION_ID = process.env.NEXT_PUBLIC_DEMO_VERSION ?? "";
/** 站点根（不含版本段）；本地 dev 下是空串。 */
export const DEMO_BASE = process.env.NEXT_PUBLIC_DEMO_BASE ?? "";

/**
 * 现在线上一共有哪些版本。
 *
 * 先给构建时那份，取到站点根的名单再换掉。整站只取一次 —— 名单在一次演示里不
 * 会变，切换器也只有一个。
 */
export function useDemoVersions(): readonly DemoVersion[] {
  const [versions, setVersions] = useState<readonly DemoVersion[]>(
    () => liveVersions ?? DEMO_VERSIONS,
  );

  useEffect(() => {
    if (DEMO_BASE === "") return; // 本地：没有站点根可取
    let alive = true;
    fetchVersions().then((list) => {
      if (alive && list) setVersions(list);
    });
    return () => {
      alive = false;
    };
  }, []);

  return versions;
}

/** 取回来的名单，取过就不再取。 */
let liveVersions: readonly DemoVersion[] | null = null;
let inflight: Promise<readonly DemoVersion[] | null> | null = null;

function fetchVersions(): Promise<readonly DemoVersion[] | null> {
  if (liveVersions) return Promise.resolve(liveVersions);
  inflight ??= fetch(`${DEMO_BASE}/versions.json`, { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      const list = parseVersions(data);
      if (list) liveVersions = list;
      return list;
    })
    /* 取不到就沉默：兜底名单已经在屏幕上了，为一份可有可无的名单弹错没意义。 */
    .catch(() => null);
  return inflight;
}

function parseVersions(data: unknown): readonly DemoVersion[] | null {
  if (!Array.isArray(data) || data.length === 0) return null;
  const list: DemoVersion[] = [];
  for (const raw of data) {
    if (!raw || typeof raw !== "object") return null;
    const v = raw as Record<string, unknown>;
    if (typeof v.id !== "string" || typeof v.label !== "string") return null;
    list.push({
      id: v.id,
      label: v.label,
      date: typeof v.date === "string" ? v.date : "",
      note: typeof v.note === "string" ? v.note : "",
    });
  }
  return list;
}

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
