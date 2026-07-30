/**
 * Default for the `@modal` parallel slot. Rendered whenever the current
 * URL doesn't match an intercepting route under this slot — i.e. every
 * non-chat page. Returning `null` keeps the slot empty so only the main
 * `children` tree is visible.
 */
export default function Default() {
  return null;
}
