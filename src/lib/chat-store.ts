"use client";

import { useSyncExternalStore } from "react";
import { getChatScene, type ChatMessage } from "@/lib/chat-scenes";

/**
 * Per-location chat state — shared by both the free-chat and event-chat
 * surfaces (the user requested they "share one chat window"). The store
 * lives at module scope so it survives modal mount/unmount cycles, which
 * is what gives us "保留所有聊天记录" across visits.
 *
 * State invariants:
 *   - `messages` is the full ordered log including system rows
 *     (arrival, joins/leaves, "事件XXX已结束").
 *   - `activeEventTitle` is set when the user is currently inside an
 *     event session for this location. Closing the chat with a title
 *     set appends a system "事件{title}已结束" message and clears it.
 *   - The first ensure() seeds the log with the scene's seed messages
 *     plus the "你来到X" arrival notice — exactly once per location.
 *     Subsequent visits read the existing log instead of re-seeding,
 *     so the arrival notice is not duplicated on re-entry.
 */

export type LocationChatState = {
  messages: ChatMessage[];
  activeEventTitle: string | null;
};

const states = new Map<string, LocationChatState>();
const listeners = new Set<() => void>();

function notify() {
  // Snapshot listener set so a listener that removes itself during
  // notification (e.g. an unmounting React component) doesn't trip
  // the iterator.
  for (const l of [...listeners]) l();
}

function ensure(location: string): LocationChatState {
  let s = states.get(location);
  if (s) return s;

  const scene = getChatScene(location);
  s = {
    messages: [
      ...scene.seedMessages,
      {
        id: `sys-self-arrive-${scene.location}`,
        isSystem: true,
        text: `你来到${scene.location}`,
      },
    ],
    activeEventTitle: null,
  };
  states.set(location, s);
  return s;
}

/**
 * Replace the location's state object — mandatory for
 * `useSyncExternalStore` to detect a change. Mutating in place would
 * keep the same reference and trigger no re-renders.
 */
function commit(location: string, next: LocationChatState) {
  states.set(location, next);
  notify();
}

export function appendMessages(location: string, ...added: ChatMessage[]) {
  if (added.length === 0) return;
  const cur = ensure(location);
  commit(location, { ...cur, messages: [...cur.messages, ...added] });
}

/**
 * Mark the chat as currently inside an event session. Idempotent for
 * the same title — repeat calls don't re-emit anything.
 */
export function startEvent(location: string, eventTitle: string) {
  const cur = ensure(location);
  if (cur.activeEventTitle === eventTitle) return;
  commit(location, { ...cur, activeEventTitle: eventTitle });
}

/**
 * Close the active event for a location. Appends a "事件{title}已结束"
 * system row and clears `activeEventTitle`. No-op if no event is
 * active, so it's safe to call from a free-chat exit path too.
 */
export function endEvent(location: string) {
  const cur = ensure(location);
  if (!cur.activeEventTitle) return;
  const title = cur.activeEventTitle;
  commit(location, {
    activeEventTitle: null,
    messages: [
      ...cur.messages,
      {
        id: `sys-event-end-${title}-${Date.now()}`,
        isSystem: true,
        text: `事件${title}已结束`,
      },
    ],
  });
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

/**
 * React hook that re-renders whenever the location's chat state
 * changes. Server snapshot returns the same structure so the static
 * export pre-render doesn't crash; SSR users still see the seed log.
 */
export function useLocationChatState(location: string): LocationChatState {
  return useSyncExternalStore(
    subscribe,
    () => ensure(location),
    () => ensure(location),
  );
}
