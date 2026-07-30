import { ChatModal } from "@/components/chat/chat-modal";

/**
 * Intercepting route for `/chat/[location]`.
 *
 * When the user navigates to a chat URL *from elsewhere in the app*
 * (e.g. tapping a POI on the map), Next routes this slot instead of the
 * regular `/chat/[location]/page.tsx`. The `children` slot stays put at
 * whatever was underneath (usually the map), so the `ChatModal` renders
 * as a true overlay with an iOS-style push animation — the place the
 * user just left is still visible behind it.
 *
 * Hard-loading `/chat/[location]` directly (shared URL / refresh) falls
 * through to the non-intercepted route so users still see a standalone
 * chat page without requiring a modal host underneath.
 */
export default async function InterceptedChatPage({
  params,
}: {
  params: Promise<{ location: string }>;
}) {
  const { location: raw } = await params;
  const location = decodeURIComponent(raw);
  return <ChatModal location={location} />;
}
