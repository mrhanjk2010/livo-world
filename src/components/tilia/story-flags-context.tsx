"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { CAB_CONDUCTOR_LOCATION } from "@/lib/tilia/cab-carriage";
import {
  MUSIC_HALL_CONCERT_LOCATION,
  TEA_ROOM_VIOLIN_LOCATION,
} from "@/lib/tilia/music-hall-concert";
import {
  DEFAULT_STORY_FLAGS,
  purgePersistedStoryFlags,
  type ActiveDestinyVisit,
  type StoryFlags,
  type StoryWorldClock,
} from "@/lib/tilia/story-flags";
import type { DestinyMarkerDef } from "@/lib/tilia/destiny-markers";
import {
  ONE_WEEK_LATER_CLOCK,
  ONE_WEEK_LEDGER_LOCATION,
  ONE_WEEK_WHISPER_LOCATION,
  PATROL_INSPECTION_LOCATION,
} from "@/lib/tilia/one-week-later";

const ONE_WEEK_LOCATIONS = [
  PATROL_INSPECTION_LOCATION,
  ONE_WEEK_WHISPER_LOCATION,
  ONE_WEEK_LEDGER_LOCATION,
] as const;

type StoryFlagsContextValue = StoryFlags & {
  beginDestinyVisit: (marker: DestinyMarkerDef) => void;
  finishDestinyVisit: () => void;
  resetConcertDestinyCycle: () => void;
  /** 跳到一周后：推进时钟，供地图落下三枚命运。Demo 可随时强制切换。 */
  jumpToOneWeekLater: () => void;
  /** 回到今天当前时刻（Demo 系统菜单）。 */
  resetToCurrentDay: () => void;
  /** 备好「地图扩展」这一段：那句话进推荐短语，地图不动。 */
  armCabExpansion: () => void;
  /** 让驾驶车厢向你开放（在回应里说到驾驶室/车头之后）。 */
  revealCabCarriage: () => void;
  /** 把这一段整个收回：车厢、命运、推荐短语都退掉（仅演示用）。 */
  resetCabExpansion: () => void;
  isPotentialDestinyCleared: (chatLocation: string) => boolean;
};

const StoryFlagsContext = createContext<StoryFlagsContextValue | null>(null);

function withClearedLocation(
  prev: readonly string[],
  location: string,
): readonly string[] {
  return prev.includes(location) ? prev : [...prev, location];
}

export function StoryFlagsProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useState<StoryFlags>(DEFAULT_STORY_FLAGS);

  useEffect(() => {
    purgePersistedStoryFlags();
  }, []);

  const beginDestinyVisit = useCallback((marker: DestinyMarkerDef) => {
    const visit: ActiveDestinyVisit = {
      id: marker.id,
      kind: marker.kind,
      chatLocation: marker.chatLocation,
    };
    setFlags((prev) => ({ ...prev, activeDestinyVisit: visit }));
  }, []);

  const finishDestinyVisit = useCallback(() => {
    setFlags((prev) => {
      const visit = prev.activeDestinyVisit;
      if (!visit) return prev;

      let cleared = prev.clearedPotentialLocations;
      let violinInTeaRoom = prev.violinInTeaRoom;
      let hasViolin = prev.hasViolin;
      let weekLaterReady = prev.weekLaterReady;
      let cabExpansionArmed = prev.cabExpansionArmed;
      let cabRevealed = prev.cabRevealed;

      if (visit.kind === "potential") {
        cleared = withClearedLocation(cleared, visit.chatLocation);
      }

      if (visit.chatLocation === MUSIC_HALL_CONCERT_LOCATION) {
        violinInTeaRoom = true;
      }

      if (visit.chatLocation === TEA_ROOM_VIOLIN_LOCATION) {
        violinInTeaRoom = false;
        hasViolin = true;
        // 拿到琴后，可跳到一周后触发巡警检查等命运。
        if (!prev.weekLaterArrived) weekLaterReady = true;
      }

      // 检查结束时你说出了对车头的好奇 —— 退出这一刻，世界给出回答。
      if (visit.chatLocation === PATROL_INSPECTION_LOCATION) {
        cabExpansionArmed = true;
        cabRevealed = true;
        cleared = cleared.filter((loc) => loc !== CAB_CONDUCTOR_LOCATION);
      }

      return {
        ...prev,
        clearedPotentialLocations: cleared,
        violinInTeaRoom,
        hasViolin,
        weekLaterReady,
        cabExpansionArmed,
        cabRevealed,
        activeDestinyVisit: null,
      };
    });
  }, []);

  const resetConcertDestinyCycle = useCallback(() => {
    setFlags((prev) => ({
      ...prev,
      violinInTeaRoom: false,
      activeDestinyVisit: null,
      clearedPotentialLocations: prev.clearedPotentialLocations.filter(
        (loc) =>
          loc !== MUSIC_HALL_CONCERT_LOCATION &&
          loc !== TEA_ROOM_VIOLIN_LOCATION,
      ),
    }));
  }, []);

  const jumpToOneWeekLater = useCallback(() => {
    setFlags((prev) => {
      if (prev.weekLaterArrived) return prev;
      const clock: StoryWorldClock = { ...ONE_WEEK_LATER_CLOCK };
      return {
        ...prev,
        // Demo 可随时跳；产品链路里拿到琴后也会走这里。
        hasViolin: true,
        weekLaterReady: false,
        weekLaterArrived: true,
        worldClock: clock,
        // 重跳时让三枚潜在命运重新出现。
        clearedPotentialLocations: prev.clearedPotentialLocations.filter(
          (loc) => !(ONE_WEEK_LOCATIONS as readonly string[]).includes(loc),
        ),
      };
    });
  }, []);

  const resetToCurrentDay = useCallback(() => {
    setFlags((prev) => ({
      ...prev,
      weekLaterArrived: false,
      weekLaterReady: prev.hasViolin,
      worldClock: null,
      clearedPotentialLocations: prev.clearedPotentialLocations.filter(
        (loc) => !(ONE_WEEK_LOCATIONS as readonly string[]).includes(loc),
      ),
    }));
  }, []);

  const armCabExpansion = useCallback(() => {
    setFlags((prev) =>
      prev.cabExpansionArmed && !prev.cabRevealed
        ? prev
        : { ...prev, cabExpansionArmed: true, cabRevealed: false },
    );
  }, []);

  const revealCabCarriage = useCallback(() => {
    setFlags((prev) =>
      prev.cabRevealed
        ? prev
        : {
            ...prev,
            cabExpansionArmed: true,
            cabRevealed: true,
            // 重新开放时让车头那枚命运也重新可进。
            clearedPotentialLocations: prev.clearedPotentialLocations.filter(
              (loc) => loc !== CAB_CONDUCTOR_LOCATION,
            ),
          },
    );
  }, []);

  const resetCabExpansion = useCallback(() => {
    setFlags((prev) =>
      !prev.cabExpansionArmed && !prev.cabRevealed
        ? prev
        : { ...prev, cabExpansionArmed: false, cabRevealed: false },
    );
  }, []);

  const isPotentialDestinyCleared = useCallback(
    (chatLocation: string) =>
      flags.clearedPotentialLocations.includes(chatLocation),
    [flags.clearedPotentialLocations],
  );

  const value = useMemo<StoryFlagsContextValue>(
    () => ({
      ...flags,
      beginDestinyVisit,
      finishDestinyVisit,
      resetConcertDestinyCycle,
      jumpToOneWeekLater,
      resetToCurrentDay,
      armCabExpansion,
      revealCabCarriage,
      resetCabExpansion,
      isPotentialDestinyCleared,
    }),
    [
      flags,
      beginDestinyVisit,
      finishDestinyVisit,
      resetConcertDestinyCycle,
      jumpToOneWeekLater,
      resetToCurrentDay,
      armCabExpansion,
      revealCabCarriage,
      resetCabExpansion,
      isPotentialDestinyCleared,
    ],
  );

  return (
    <StoryFlagsContext.Provider value={value}>
      {children}
    </StoryFlagsContext.Provider>
  );
}

export function useStoryFlags(): StoryFlagsContextValue {
  const ctx = useContext(StoryFlagsContext);
  if (!ctx) {
    return {
      ...DEFAULT_STORY_FLAGS,
      beginDestinyVisit: () => {},
      finishDestinyVisit: () => {},
      resetConcertDestinyCycle: () => {},
      jumpToOneWeekLater: () => {},
      resetToCurrentDay: () => {},
      armCabExpansion: () => {},
      revealCabCarriage: () => {},
      resetCabExpansion: () => {},
      isPotentialDestinyCleared: () => false,
    };
  }
  return ctx;
}
