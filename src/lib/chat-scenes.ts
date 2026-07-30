/**
 * Location-keyed scene data for the free-chat (自由聊天) page.
 *
 * Every group chat in the product is anchored to a geographic location —
 * the NPC, member pool, ambient messages, and even the scene backdrop
 * are all derived from the place. This file is the single source of
 * truth for that mapping.
 *
 * Scene backgrounds are authored as CSS gradient "recipes" (base gradient
 * + two soft colored blobs) rather than photo assets so each location
 * has a distinct mood without the cost of shipping large images. See
 * the chat screen for how the recipe is rendered.
 */

import type { CSSProperties } from "react";

export type ChatMessage = {
  id: string;
  /**
   * Who said it. For the viewer's own lines, use `speaker: "陈昔"` and
   * `isSelf: true`. Optional because system messages (`isSystem: true`)
   * have no speaker — they render as centered "—— text ——" notices.
   */
  speaker?: string;
  /** Avatar image path. `null` renders a colored circle (used for NPCs). */
  avatarSrc?: string | null;
  /** Fallback color circle when avatarSrc is null (CSS color). */
  avatarColor?: string;
  /** NPC tag shown inline after the speaker name, e.g. "(NPC)". */
  tag?: string;
  text: string;
  isSelf?: boolean;
  /**
   * System notice (Figma 1901:1709 — "系统消息"). Rendered as
   * "—— text ——" centered, white/80, no avatar/bubble. Used for
   * join/leave events like `钟辰时来到食堂` or `你已离开食堂`.
   */
  isSystem?: boolean;
};

export type SceneMember = {
  name: string;
  avatarSrc: string | null;
  avatarColor?: string;
  tag?: string;
};

export type SceneRecipe = {
  /** Solid base color painted under the gradient overlays. */
  base: string;
  /** Layered gradient CSS — applied on top of `base`. */
  gradient: string;
  /** A short vibe word shown near the location pill (unused in UI but
   *  handy for debugging / future enhancements). */
  mood: string;
};

export type ChatScene = {
  /** The URL segment and the label shown in the location pill. */
  location: string;
  /** Who lives at this place (NPC first, then friends likely to be here). */
  members: readonly SceneMember[];
  /** Seed conversation — location-flavored. */
  seedMessages: readonly ChatMessage[];
  /** Backdrop recipe — different mood for every place. */
  scene: SceneRecipe;
};

/** Built-in roster avatars, reused across scenes. */
const AVATARS = {
  zhouwang: "/figma/map/avatar-zhouwang.png",
  zhongchen: "/figma/map/avatar-zhongchen.jpg",
  yeheng: "/figma/map/avatar-yeheng.png",
  xiaji: "/figma/map/avatar-xiaji.png",
} as const;

const SELF: SceneMember = {
  name: "陈昔",
  avatarSrc: null,
  avatarColor: "#8b7aff",
  tag: "(你)",
};

/**
 * Build a scene backdrop as a layered gradient. The base color is the
 * sky/ambient tint; the two blob colors are dropped as soft radial
 * gradients to suggest scenery (e.g. treetops, warm lamps) without
 * being literal. The chat screen darkens this whole stack ~60% so
 * message bubbles remain legible.
 */
function scene(
  base: string,
  blobA: string,
  blobB: string,
  mood: string,
): SceneRecipe {
  return {
    base,
    /**
     * Layered look:
     *  1. A big soft colored blob in the upper-left (sky / ambient)
     *  2. A warmer blob in the lower-right (ground / lamp)
     *  3. A subtle vignette that darkens the top-right and bottom-left
     *     corners, giving the scene a "viewport" feel.
     *  4. The base gradient fades to the base color (kept vivid so
     *     places remain visually distinct once the overlay lands).
     */
    gradient: [
      `radial-gradient(110% 70% at 18% 22%, ${blobA} 0%, transparent 55%)`,
      `radial-gradient(120% 80% at 82% 85%, ${blobB} 0%, transparent 60%)`,
      `radial-gradient(90% 120% at 50% 100%, rgba(0,0,0,0.45) 0%, transparent 65%)`,
      `linear-gradient(180deg, ${base} 0%, ${base} 100%)`,
    ].join(", "),
    mood,
  };
}

/**
 * Known locations. Each map POI (plus world-event anchors like 河边) has
 * a record here. A fallback scene is returned for any unknown location.
 */
const SCENES: Record<string, ChatScene> = {
  会客厅: {
    location: "会客厅",
    members: [
      {
        name: "施塔恩",
        avatarSrc: "/figma/tilia/avatar-char-a.png",
        avatarColor: "#6b8cae",
      },
      SELF,
    ],
    scene: scene("#2a2218", "#8a6a45", "#120e0a", "鹿头灯"),
    seedMessages: [
      {
        id: "parlour-1",
        speaker: "施塔恩",
        avatarSrc: "/figma/tilia/avatar-char-a.png",
        text: "口琴的铜面有点凉。你要听半首，还是整首？",
      },
      {
        id: "parlour-2",
        speaker: "陈昔",
        avatarSrc: null,
        avatarColor: "#8b7aff",
        tag: "(你)",
        text: "先听半首吧。窗外的雪好像停了一点。",
        isSelf: true,
      },
      {
        id: "parlour-3",
        speaker: "施塔恩",
        avatarSrc: "/figma/tilia/avatar-char-a.png",
        text: "那我就吹到转折为止——剩下的，看你还坐不坐得住。",
      },
    ],
  },

  剧场: {
    location: "剧场",
    members: [
      {
        name: "罗兰",
        avatarSrc: "/figma/tilia/avatar-char-b.png",
        avatarColor: "#9a7a5a",
      },
      SELF,
    ],
    scene: scene("#1c1820", "#6a4a78", "#0c0a10", "幕布"),
    seedMessages: [
      {
        id: "theater-1",
        speaker: "罗兰",
        avatarSrc: "/figma/tilia/avatar-char-b.png",
        text: "这一页还没想好结局。你要是接过去，故事就不只属于我了。",
      },
      {
        id: "theater-2",
        speaker: "陈昔",
        avatarSrc: null,
        avatarColor: "#8b7aff",
        tag: "(你)",
        text: "让我看看——墨迹还没干。",
        isSelf: true,
      },
    ],
  },

  瑰室: {
    location: "瑰室",
    members: [
      {
        name: "任轻义",
        avatarSrc: "/figma/tilia/avatar-renqingyi.png",
        avatarColor: "#3a3a48",
      },
      {
        name: "乘务长",
        avatarSrc: null,
        avatarColor: "#5a6a7a",
        tag: "(NPC)",
      },
      {
        name: "巡警",
        avatarSrc: null,
        avatarColor: "#4a5a6a",
        tag: "(NPC)",
      },
      SELF,
    ],
    scene: scene("#2c1e18", "#a07050", "#140c08", "暖厢"),
    seedMessages: [
      {
        id: "gui-1",
        isSystem: true,
        text: "你进入了注定的命运「归乡·雪夜苍翠」",
      },
      {
        id: "gui-2",
        speaker: "乘务长",
        avatarSrc: null,
        avatarColor: "#5a6a7a",
        tag: "(NPC)",
        text: "包厢已清过一遍。试剂箱请放在视线内。",
      },
      {
        id: "gui-3",
        speaker: "巡警",
        avatarSrc: null,
        avatarColor: "#4a5a6a",
        tag: "(NPC)",
        text: "开箱检查是例行。请配合。",
      },
      {
        id: "gui-4",
        speaker: "任轻义",
        avatarSrc: "/figma/tilia/avatar-renqingyi.png",
        text: "她刚上车。规矩可以讲，不必这么硬。",
      },
      {
        id: "gui-5",
        speaker: "陈昔",
        avatarSrc: null,
        avatarColor: "#8b7aff",
        tag: "(你)",
        text: "可以开箱。请轻一点。",
        isSelf: true,
      },
    ],
  },

  后山: {
    location: "后山",
    members: [
      {
        name: "护林员",
        avatarSrc: null,
        avatarColor: "#8b7aff",
        tag: "(NPC)",
      },
      { name: "钟辰时", avatarSrc: AVATARS.zhongchen },
      { name: "夏季", avatarSrc: AVATARS.xiaji },
      SELF,
    ],
    scene: scene("#2a5140", "#5a9975", "#1a3028", "雾林"),
    seedMessages: [
      {
        id: "hs-1",
        speaker: "护林员",
        avatarSrc: null,
        avatarColor: "#8b7aff",
        tag: "(NPC)",
        text: "山道今天有点湿滑，带朋友过来的话留心脚下。",
      },
      {
        id: "hs-2",
        speaker: "钟辰时",
        avatarSrc: AVATARS.zhongchen,
        text: "刚拐过弯，看到一只小橘猫蹲在台阶上。",
      },
      {
        id: "hs-3",
        speaker: "夏季",
        avatarSrc: AVATARS.xiaji,
        text: "我也想摸摸，下次带点小鱼干。",
      },
      {
        id: "hs-4",
        speaker: "陈昔",
        avatarSrc: null,
        avatarColor: "#8b7aff",
        tag: "(你)",
        text: "有人现在在山腰吗？听说能看到云。",
        isSelf: true,
      },
      {
        id: "hs-5",
        speaker: "钟辰时",
        avatarSrc: AVATARS.zhongchen,
        text: "我在，风挺大但云压得很低，值得爬一次。",
      },
    ],
  },

  图书馆: {
    location: "图书馆",
    members: [
      {
        name: "图书管理员",
        avatarSrc: null,
        avatarColor: "#c9a16b",
        tag: "(NPC)",
      },
      { name: "钟辰时", avatarSrc: AVATARS.zhongchen },
      { name: "叶恒", avatarSrc: AVATARS.yeheng },
      SELF,
    ],
    scene: scene("#3a2e1c", "#b58a4e", "#1e1608", "暖灯"),
    seedMessages: [
      {
        id: "lib-1",
        speaker: "图书管理员",
        avatarSrc: null,
        avatarColor: "#c9a16b",
        tag: "(NPC)",
        text: "新到的一批期刊上架了，在三楼东侧的新书区。",
      },
      {
        id: "lib-2",
        speaker: "钟辰时",
        avatarSrc: AVATARS.zhongchen,
        text: "🤔 终于有一道有挑战性的题了。",
      },
      {
        id: "lib-3",
        speaker: "叶恒",
        avatarSrc: AVATARS.yeheng,
        text: "我手边这本数分习题集你要不要翻一下？",
      },
      {
        id: "lib-4",
        speaker: "陈昔",
        avatarSrc: null,
        avatarColor: "#8b7aff",
        tag: "(你)",
        text: "二楼有没有空位呀？我马上过去。",
        isSelf: true,
      },
      {
        id: "lib-5",
        speaker: "叶恒",
        avatarSrc: AVATARS.yeheng,
        text: "靠窗的第三排还有两个位置。",
      },
    ],
  },

  食堂: {
    location: "食堂",
    members: [
      {
        name: "食堂阿姨",
        avatarSrc: null,
        avatarColor: "#f08a4a",
        tag: "(NPC)",
      },
      { name: "钟辰时", avatarSrc: AVATARS.zhongchen },
      { name: "夏季", avatarSrc: AVATARS.xiaji },
      SELF,
    ],
    scene: scene("#4a2c18", "#e38a4a", "#20100a", "烟火"),
    seedMessages: [
      {
        id: "ct-1",
        speaker: "食堂阿姨",
        avatarSrc: null,
        avatarColor: "#f08a4a",
        tag: "(NPC)",
        text: "今天二号窗口有糖醋排骨，限量供应哦～",
      },
      {
        id: "ct-2",
        speaker: "夏季",
        avatarSrc: AVATARS.xiaji,
        text: "在食堂帮同学占位子，谁要一起吃？",
      },
      {
        id: "ct-3",
        speaker: "钟辰时",
        avatarSrc: AVATARS.zhongchen,
        text: "快速吃完准备回图书馆。",
      },
      {
        id: "ct-4",
        speaker: "陈昔",
        avatarSrc: null,
        avatarColor: "#8b7aff",
        tag: "(你)",
        text: "留我一个座！马上到。",
        isSelf: true,
      },
    ],
  },

  教室: {
    location: "教室",
    members: [
      {
        name: "班主任",
        avatarSrc: null,
        avatarColor: "#4a6fa5",
        tag: "(NPC)",
      },
      { name: "夏季", avatarSrc: AVATARS.xiaji },
      { name: "叶恒", avatarSrc: AVATARS.yeheng },
      SELF,
    ],
    scene: scene("#23304a", "#4a78b5", "#0a1020", "窗光"),
    seedMessages: [
      {
        id: "cr-1",
        speaker: "班主任",
        avatarSrc: null,
        avatarColor: "#4a6fa5",
        tag: "(NPC)",
        text: "今晚自习前要交英语周记，别忘了。",
      },
      {
        id: "cr-2",
        speaker: "夏季",
        avatarSrc: AVATARS.xiaji,
        text: "正在教室打扫卫生，有人来帮忙拉条凳吗？",
      },
      {
        id: "cr-3",
        speaker: "叶恒",
        avatarSrc: AVATARS.yeheng,
        text: "我到了，正在讲台上给同学讲题。",
      },
      {
        id: "cr-4",
        speaker: "陈昔",
        avatarSrc: null,
        avatarColor: "#8b7aff",
        tag: "(你)",
        text: "那一题我也不会，等我五分钟。",
        isSelf: true,
      },
    ],
  },

  操场: {
    location: "操场",
    members: [
      {
        name: "体育老师",
        avatarSrc: null,
        avatarColor: "#4aa35a",
        tag: "(NPC)",
      },
      { name: "周往", avatarSrc: AVATARS.zhouwang },
      { name: "叶恒", avatarSrc: AVATARS.yeheng },
      SELF,
    ],
    scene: scene("#2a4a2f", "#6aaa65", "#10200f", "日光"),
    seedMessages: [
      {
        id: "pg-1",
        speaker: "体育老师",
        avatarSrc: null,
        avatarColor: "#4aa35a",
        tag: "(NPC)",
        text: "今天跑圈队伍人有点多，下午四点前都开放。",
      },
      {
        id: "pg-2",
        speaker: "周往",
        avatarSrc: AVATARS.zhouwang,
        text: "在绕着操场跑圈，差两圈就收尾。",
      },
      {
        id: "pg-3",
        speaker: "叶恒",
        avatarSrc: AVATARS.yeheng,
        text: "散步放松一下，一会儿回教室。",
      },
    ],
  },

  体育馆: {
    location: "体育馆",
    members: [
      {
        name: "体育馆管理员",
        avatarSrc: null,
        avatarColor: "#5a6a7a",
        tag: "(NPC)",
      },
      { name: "周往", avatarSrc: AVATARS.zhouwang },
      SELF,
    ],
    scene: scene("#263345", "#5a7fa8", "#0f141c", "冷光"),
    seedMessages: [
      {
        id: "gym-1",
        speaker: "体育馆管理员",
        avatarSrc: null,
        avatarColor: "#5a6a7a",
        tag: "(NPC)",
        text: "二号场还空着，想打球的赶紧来。",
      },
      {
        id: "gym-2",
        speaker: "周往",
        avatarSrc: AVATARS.zhouwang,
        text: "约了人打篮球，差一个五号。",
      },
      {
        id: "gym-3",
        speaker: "陈昔",
        avatarSrc: null,
        avatarColor: "#8b7aff",
        tag: "(你)",
        text: "我来！在路上了。",
        isSelf: true,
      },
    ],
  },

  学校大门: {
    location: "学校大门",
    members: [
      {
        name: "保安大叔",
        avatarSrc: null,
        avatarColor: "#7a6a5a",
        tag: "(NPC)",
      },
      { name: "夏季", avatarSrc: AVATARS.xiaji },
      { name: "叶恒", avatarSrc: AVATARS.yeheng },
      SELF,
    ],
    scene: scene("#3a3148", "#c98d65", "#14101c", "黄昏"),
    seedMessages: [
      {
        id: "gate-1",
        speaker: "保安大叔",
        avatarSrc: null,
        avatarColor: "#7a6a5a",
        tag: "(NPC)",
        text: "外卖的小哥都在西门停着，记得自己去拿一下。",
      },
      {
        id: "gate-2",
        speaker: "夏季",
        avatarSrc: AVATARS.xiaji,
        text: "在校门口等晚归的同学。",
      },
      {
        id: "gate-3",
        speaker: "叶恒",
        avatarSrc: AVATARS.yeheng,
        text: "在等朋友一起回家，估计还有十分钟。",
      },
    ],
  },

  河边: {
    location: "河边",
    members: [
      {
        name: "护林员",
        avatarSrc: null,
        avatarColor: "#8b7aff",
        tag: "(NPC)",
      },
      { name: "周往", avatarSrc: AVATARS.zhouwang },
      SELF,
    ],
    scene: scene("#27384a", "#4a6582", "#0c1218", "风雨"),
    seedMessages: [
      {
        id: "rv-1",
        speaker: "护林员",
        avatarSrc: null,
        avatarColor: "#8b7aff",
        tag: "(NPC)",
        text: "河边风比较大，台风第二天水势明显涨了一截。",
      },
      {
        id: "rv-2",
        speaker: "周往",
        avatarSrc: AVATARS.zhouwang,
        text: "刚看到一棵老树被冲倒了，拍了照片在朋友圈。",
      },
      {
        id: "rv-3",
        speaker: "陈昔",
        avatarSrc: null,
        avatarColor: "#8b7aff",
        tag: "(你)",
        text: "大家都注意安全，不要靠河太近。",
        isSelf: true,
      },
    ],
  },
};

/**
 * Fallback for any location not explicitly configured — still renders
 * a usable chat with a neutral backdrop and a single NPC greeting.
 */
function fallbackScene(location: string): ChatScene {
  return {
    location,
    members: [
      {
        name: "当地NPC",
        avatarSrc: null,
        avatarColor: "#8b7aff",
        tag: "(NPC)",
      },
      SELF,
    ],
    scene: scene("#2a3040", "#4a5a78", "#0f1218", "无名"),
    seedMessages: [
      {
        id: "fb-1",
        speaker: "当地NPC",
        avatarSrc: null,
        avatarColor: "#8b7aff",
        tag: "(NPC)",
        text: `欢迎来到${location}，今天这里人不多。`,
      },
    ],
  };
}

export function getChatScene(location: string): ChatScene {
  return SCENES[location] ?? fallbackScene(location);
}

/**
 * Render the scene recipe as inline `style` for a <div> backdrop.
 * The consumer can layer a dark overlay on top if needed.
 */
export function sceneBackgroundStyle(recipe: SceneRecipe): CSSProperties {
  return {
    backgroundColor: recipe.base,
    backgroundImage: recipe.gradient,
  };
}
