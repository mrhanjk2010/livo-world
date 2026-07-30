/**
 * Default for the implicit `children` slot at the app root.
 *
 * Next requires a `default.tsx` for every parallel slot whenever a
 * soft-navigation produces a URL that the slot has no active match for
 * in its router cache — this happens with intercepting-route modals,
 * where the child slot stays at its previous state while the URL points
 * at the modal route.
 *
 * Returning `null` is the right behavior here: if the router cache has
 * a cached `children` subtree (e.g. the map), Next will keep using it;
 * if it doesn't, we render nothing and let the intercepting `@modal`
 * slot be the whole screen. Unlike a fallback spinner, this avoids a
 * flash when the user cold-loads a chat URL that then hydrates into a
 * regular page via `/chat/[location]/page.tsx`.
 */
export default function Default() {
  return null;
}
