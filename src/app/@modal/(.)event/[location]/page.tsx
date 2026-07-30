import { EventModal } from "@/components/chat/event-modal";

/**
 * Intercepting route for `/event/[location]`.
 *
 * Parallel to the chat intercept — when the event half-sheet's
 * "进入事件" CTA pushes `/event/<loc>` from inside the map, this slot
 * is what Next renders, which keeps the map alive in the `children`
 * slot underneath while `EventModal` slides in over the top.
 *
 * Hard-loading `/event/[location]` directly falls through to
 * `src/app/event/[location]/page.tsx` for a standalone phone frame.
 */
export default async function InterceptedEventPage({
  params,
}: {
  params: Promise<{ location: string }>;
}) {
  const { location: raw } = await params;
  const location = decodeURIComponent(raw);
  return <EventModal location={location} />;
}
