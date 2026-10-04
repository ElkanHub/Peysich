/** The dashboard photograph and greeting (src/ui/welcome-hero.tsx). */

export type HeroRole = "admin" | "teacher" | "parent" | "student" | "platform";
const IMAGES = ["admin", "teacher", "parent", "student"] as const;
/** How often a person sees the picture for their own role. */
const OWN_SHARE = 0.7;

/** A picture for this load: usually the role's own, sometimes one of the others.
 *  The console has no picture of its own, so it leans on the head's. */
export function pickHero(role: HeroRole): (typeof IMAGES)[number] {
  const own = role === "platform" ? "admin" : role;
  if (Math.random() < OWN_SHARE) return own;
  const others = IMAGES.filter((i) => i !== own);
  return others[Math.floor(Math.random() * others.length)];
}

/** Good morning / afternoon / evening, by the clock in Ghana (UTC). */
export function greeting(now = new Date()) {
  const h = now.getUTCHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}
