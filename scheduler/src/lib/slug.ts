/**
 * Turn an arbitrary title into a URL-safe slug.
 *
 * - lowercases and trims
 * - replaces whitespace and underscores with a single hyphen
 * - drops anything that is not [a-z0-9-]
 *   (CJK titles therefore yield an empty slug — the caller should fall back to
 *    a manual slug, which the admin form already prompts for)
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
