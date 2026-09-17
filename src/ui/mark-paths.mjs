/* SchoolSpec mark — traced from the master logo (1920px square, ÷10).
 * A stepped "S" of two blocks joined by a band, with two wine wedges
 * riding the diagonals. Shared by the React logo AND the asset generator
 * (scripts/gen-brand-assets.mjs) so every icon comes from one geometry. */

export const MARK_VIEWBOX = "0 0 192 192";
export const WINE = "#5E1D3E";
export const INK = "#1A1218";

/** The stepped S — outer corners rounded, the two inner corners sharp. */
export const MARK_BODY =
  "M24 19H81Q86 19 86 24V69H176Q181 69 181 74V169Q181 174 176 174H119Q114 174 114 169V124H24Q19 124 19 119V24Q19 19 24 19Z";

/** Top-right wedge: vertical left edge, flat base, diagonal back to the tip. */
export const MARK_WEDGE_TOP =
  "M92 26Q92 21 96.5 23L174 59.5Q178.5 62 173 62H95Q92 62 92 59Z";

/** Bottom-left wedge: flat top, vertical right edge, diagonal back to the tip. */
export const MARK_WEDGE_BOTTOM =
  "M108 166Q108 171 103.5 169L26 132.5Q21.5 130 27 130H105Q108 130 108 133Z";
