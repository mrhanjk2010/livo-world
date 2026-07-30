"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_DEMO_PRESET,
  layersForPreset,
  type DemoMapLayers,
  type DemoMapPreset,
} from "@/lib/tilia/demo-mode";

type DemoModeContextValue = {
  preset: DemoMapPreset;
  layers: DemoMapLayers;
  setPreset: (preset: DemoMapPreset) => void;
};

const DemoModeContext = createContext<DemoModeContextValue | null>(null);

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const [preset, setPresetState] = useState<DemoMapPreset>(DEFAULT_DEMO_PRESET);

  const setPreset = useCallback((next: DemoMapPreset) => {
    setPresetState(next);
  }, []);

  const value = useMemo<DemoModeContextValue>(
    () => ({
      preset,
      layers: layersForPreset(preset),
      setPreset,
    }),
    [preset, setPreset],
  );

  return (
    <DemoModeContext.Provider value={value}>{children}</DemoModeContext.Provider>
  );
}

export function useDemoMode(): DemoModeContextValue {
  const ctx = useContext(DemoModeContext);
  if (!ctx) {
    // 无 Provider 时退回默认态，避免地图页在非 demo 壳下崩溃。
    return {
      preset: DEFAULT_DEMO_PRESET,
      layers: layersForPreset(DEFAULT_DEMO_PRESET),
      setPreset: () => {},
    };
  }
  return ctx;
}
