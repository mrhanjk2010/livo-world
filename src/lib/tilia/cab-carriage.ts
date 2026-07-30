/**
 * 「地图扩展」剧情节点 —— 驾驶车厢向你开放。
 *
 * 链路：
 *   演示菜单切到「地图扩展」→ 只是把这一段备好（那句话进推荐短语），
 *     地图不动
 *   在「回应这一刻」说出「把 XK-101 藏在驾驶室会不会更安全」
 *     → 这句话被递到车头，列车长让人开了那道锁着的折棚门
 *     → 地图补上驾驶车厢：它一直在，只是从不对乘客开放
 *     → 车厢里落下一枚命运：列车长在驾驶室等你
 *
 * 两个 flag 分开是有意的：`cabExpansionArmed` 只备料，`cabRevealed` 才扩图。
 * 演示时要能先切到这一段、再当着人把那句话说出去，让扩图发生在话音之后。
 *
 * 口径（重要）：不要写成「世界临时造了一节车厢」——一列火车当然有车头，
 * 凭空长出车厢会立刻假掉。变的不是世界，是你的通行范围：地图只画你去得到
 * 的地方，你那句话让人替你开了门，地图才补上这一节。也别写成「你终于自己
 * 发现了车头」——那就丢了因果，是你说的话把门推开的。
 */

import { groupSceneSrcForLocation } from "@/lib/tilia/chat-backgrounds";
import type { DestinyChatScene } from "@/lib/tilia/destiny-chat";
import type { DestinyMarkerDef } from "@/lib/tilia/destiny-markers";
import type { DestinyImpactDraft } from "@/lib/tilia/destiny-from-voice";
import { nearRoom } from "@/lib/tilia/train";

export const CAB_CONDUCTOR_LOCATION = "驾驶室·车头风声";

/** 这枚命运的 id 前缀，地图按它增删。 */
export const CAB_MARKER_ID = "destiny-cab-conductor";

/** 演示脚本 id，API / UI 用它识别这条支线。 */
export const CAB_SCRIPT_ID = "cab-carriage";

const AVATAR = {
  you: "/figma/tilia/avatar-you-art.png",
  staen: "/figma/tilia/avatar-char-a.png",
} as const;

/** 演示时点一下就能发出去的那句话（切到「地图扩展」后进推荐短语）。 */
export const CAB_RESPOND_PHRASE = "把 XK-101 藏在驾驶室会不会更安全";

/**
 * 触发词。说到车头这套东西就算命中 —— 演示时不会正好敲出推荐短语的
 * 每一个字（空格、XK-100/101 都可能敲错），所以把驾驶室、列车长、司机、
 * 谁在开车都算进来，宁可宽一点。
 */
const CAB_VOICE_KEYS = [
  "驾驶车厢",
  "驾驶室",
  "列车长",
  "车头",
  "司机",
  "司炉",
  "机车",
  "锅炉",
  "谁在开",
  "开这趟车",
  "开车的人",
] as const;

export function isCabVoice(voiceText: string): boolean {
  const v = voiceText.trim();
  return CAB_VOICE_KEYS.some((k) => v.includes(k));
}

const CAB_TITLE = "藏进车头";

const CAB_PROLOGUE =
  "你那句话没等落地就被人递到了车头。半小时后，走廊尽头那道锁了十天的折棚门开了半扇——门后是一节乘客从不被带进来的车厢：炉火、黄铜手柄、一整面被风雪正面撞着的前窗。列车长在里面，像是专门等你。";

/**
 * 命运草稿。位置写死在驾驶室，不走随机落点 —— 这是脚本命运。
 */
export function buildCabDestinyImpact(): DestinyImpactDraft {
  return {
    kind: "potential",
    title: CAB_TITLE,
    storyTitle: `潜在·${CAB_TITLE}`,
    prologue: CAB_PROLOGUE,
    memberId: "staen",
    roomId: "cab-driver",
    ...nearRoom("cab-driver", 0.04, -0.12),
    chatLocation: CAB_CONDUCTOR_LOCATION,
    scriptId: CAB_SCRIPT_ID,
  };
}

/** 驾驶室那枚潜在命运：你 + 列车长。 */
export function buildCabConductorMarker(): DestinyMarkerDef {
  return {
    id: CAB_MARKER_ID,
    kind: "potential",
    title: CAB_TITLE,
    storyTitle: `潜在·${CAB_TITLE}`,
    prologue: CAB_PROLOGUE,
    ...nearRoom("cab-driver", 0.04, -0.12),
    speakers: [{ kind: "you" }, { kind: "npc", name: "列车长" }],
    roomId: "cab-driver",
    // 内圆放驾驶室场景，pair 布局下没有男主头像可放。
    sceneSrc: "/figma/tilia/destiny-chat/scene-cab-driver.png",
    chatLocation: CAB_CONDUCTOR_LOCATION,
  };
}

/** 世界动态里那条「地图刚刚变长了」的播报。 */
export const CAB_REVEAL_FEED_TEXT =
  "车厢连接处那道锁着的门开了 · 驾驶车厢向你开放";

/** 列车长群聊：那句话递到了车头，锁着的门为你开了半扇。 */
export const CAB_CONDUCTOR_SCENE: DestinyChatScene = {
  location: CAB_CONDUCTOR_LOCATION,
  variant: "group",
  destinyKind: "potential",
  title: "驾驶室",
  venue: "和平号·驾驶车厢·驾驶室",
  backgroundSrc: groupSceneSrcForLocation(CAB_CONDUCTOR_LOCATION),
  inputPlaceholder: "把琴盒放下，或者说点什么",
  sequential: true,
  members: [
    {
      name: "你",
      tag: "(你)",
      avatarSrc: AVATAR.you,
      avatarColor: "#8b7aff",
    },
    {
      name: "列车长",
      tag: "(NPC)",
      avatarSrc: null,
      avatarColor: "#7a5c3a",
    },
    { name: "施塔恩", avatarSrc: AVATAR.staen },
  ],
  beats: [
    {
      id: "cab-p1",
      kind: "prologue",
      title: CAB_TITLE,
      body: "你那句话没等落地就被人递到了车头。半小时后，走廊尽头那道锁了十天的折棚门开了半扇，门轴上的霜被推得一片一片掉。里面是一节乘客从不被带进来的车厢——炉火、煤味、黄铜手柄，一整面被风雪正面撞着的前窗。怀里的琴盒还温着：它替你挡过一次，挡不住第二次。",
    },
    { id: "cab-t1", kind: "time", text: "06:40" },
    {
      id: "cab-s1",
      kind: "system",
      text: "你那句话递到了车头 · 驾驶车厢向你开放",
    },
    {
      id: "cab-n1",
      kind: "narration",
      text: "控制台上蒙着一层薄煤灰，指针都在动——这地方十天没停过，只是从没有乘客站在这儿看过。转椅上坐着一个人，背对着你，肩上落了一层没化的雪。",
    },
    {
      id: "cab-b1",
      kind: "bubble",
      speaker: "列车长",
      avatarSrc: null,
      avatarColor: "#7a5c3a",
      lines: [
        {
          tone: "narration",
          text: "他没有回头，只把左手的手柄往回收了半格。车身随之松了一寸。",
        },
        {
          tone: "dialogue",
          text: "「你托人问了。」",
        },
      ],
    },
    {
      id: "cab-b2",
      kind: "bubble",
      speaker: "列车长",
      avatarSrc: null,
      avatarColor: "#7a5c3a",
      lines: [
        {
          tone: "dialogue",
          text: "「这一节不写在乘客名册上，所以你走了十天也没走过来。要不是你问，我不会让人替你开那道门。」",
        },
      ],
    },
    {
      id: "cab-n2",
      kind: "narration",
      text: "你回头看那道门。折棚的褶子上积了十天的煤灰，只有门轴那一圈是刚被推开的亮色。",
    },
    {
      id: "cab-tr1",
      kind: "trace",
      title: "你为什么会站在这儿",
      items: [
        {
          when: "一周前 11:35",
          text: "你在世界里说起：想去音乐厅听一场音乐会。",
        },
        {
          when: "一周前 23:41",
          text: "茶室矮柜旁，施塔恩把琴放进你怀里——琴要有人抱着才不哑。",
        },
        {
          when: "今晨 06:22",
          text: "餐车临时检查点。琴马下那寸空隙替你挡了一刀。",
        },
        {
          when: "刚才 06:39",
          text: "你问出了口：把 XK-101 藏在驾驶室，会不会更安全。这句话被递到了车头，那道门为你开了半扇。",
        },
      ],
    },
    {
      id: "cab-b3",
      kind: "bubble",
      speaker: "施塔恩",
      avatarSrc: AVATAR.staen,
      lines: [
        {
          tone: "narration",
          text: "他跟着你进来，在门口站住，抬头看了一眼从没见过的天花板。",
        },
        {
          tone: "dialogue",
          text: "「我在这趟车上走了十天，那道门一次没开过。你问了一句，它就开了半扇。」",
        },
      ],
    },
    {
      id: "cab-b4",
      kind: "bubble",
      speaker: "列车长",
      avatarSrc: null,
      avatarColor: "#7a5c3a",
      lines: [
        {
          tone: "narration",
          text: "他终于转过来。脸上有炉火的橙，也有前窗的雪蓝，两种光在他眉骨上分了界。他看的不是你的脸，是你怀里的琴盒。",
        },
        {
          tone: "dialogue",
          text: "「琴里那样东西，再过一站就藏不住了。绒布吃得下声音，吃不下狗鼻子。」",
        },
      ],
    },
    {
      id: "cab-n3",
      kind: "narration",
      text: "你没答话。他抬手在控制台侧面敲了两下——空的。三寸厚的一层夹壁，里面是干的，常年被炉火烘着。",
    },
    {
      id: "cab-b5",
      kind: "bubble",
      speaker: "列车长",
      avatarSrc: null,
      avatarColor: "#7a5c3a",
      lines: [
        {
          tone: "dialogue",
          text: "「巡警上车先查行李，再查人，最后才想到车头。可他们从来想不到车头——因为编制表上，这趟车只有一节车厢。」",
        },
      ],
    },
    {
      id: "cab-n4",
      kind: "narration",
      text: "他说这句话的时候一直看着你，等你听懂。炉膛里塌下去一块煤，火光在他手背上跳了一下。",
    },
    {
      id: "cab-s2",
      kind: "system",
      text: "你可以把 XK-101 留在驾驶室的夹壁里",
    },
    {
      id: "cab-b6",
      kind: "bubble",
      speaker: "列车长",
      avatarSrc: null,
      avatarColor: "#7a5c3a",
      lines: [
        {
          tone: "dialogue",
          text: "「你要藏，就藏在这儿。这道门只有我这儿有钥匙——你不问，它连开都不会开。」",
        },
      ],
    },
    {
      id: "cab-n5",
      kind: "narration",
      text: "前窗外，雪墙一层层撞上来又散开。轨道在雾里只露出两三节枕木——再往前的路，谁也说不上有什么。",
    },
  ],
};
