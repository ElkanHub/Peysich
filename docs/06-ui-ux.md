# 06 — UI / UX

Stack: **shadcn/ui + Tailwind**, morphed into a Peysich design system. shadcn is copy-in code we
own, so "morphing" is real: we restyle tokens and refine components once, and every screen
inherits the premium look.

## The premium morph (what actually changes)

- **Design tokens first**: a Peysich palette (one confident brand hue + calm neutrals + strict
  semantic colors for success/warning/danger), a type scale (Inter or Geist), consistent radii,
  and a two-elevation shadow system. All defined as CSS variables → theming and future
  white-labeling are token swaps.
- **Component refinement pass** over the ~15 components we use everywhere (button, input, table,
  dialog, select, tabs, toast, card, badge, skeleton…): tighter spacing rhythm (4px grid),
  subtle borders over heavy shadows, restrained motion (150–200ms, no bouncing).
- **Density**: dashboards are data tools — comfortable-dense tables (not marketing-page airy),
  generous touch targets on mobile.
- **Dark mode**: token-ready from day one, shipped when core is stable.

## Layout: one shell, zero surprises

Every school-plane page uses the same fixed shell. **Nothing moves between pages.**

```
┌────────────┬──────────────────────────────────────────────┐
│            │  Topbar: page title · search · notifs · user │
│  Sidebar   ├──────────────────────────────────────────────┤
│  (modules  │  Page header: title + [primary action]  ←── always top-right
│  for this  │  Filters/tabs row (when applicable)          │
│  school +  │                                              │
│  role)     │  Content: table / cards / form               │
│            │                                              │
│            │  Pagination  ←── always bottom, same style   │
└────────────┴──────────────────────────────────────────────┘
```

**The stability rules (your requirement, made law):**

1. **Primary action lives top-right of the page header. Always.** "Add Student", "Record Payment",
   "Mark Attendance" — same position, same style, every page. If a role/module can't perform it,
   the button is absent — never relocated, never disabled-and-moved.
2. **Row actions live in the last table column. Always.** View / Edit / Delete in a fixed-order
   menu; destructive actions styled consistently and always behind a confirm dialog.
3. **Buttons never reflow while loading** — loading states swap label→spinner *inside* the same
   button footprint; skeletons reserve exact layout space so nothing jumps (zero layout shift).
4. **Same entity, same form** — create and edit share one form component (video's pattern:
   react-hook-form + the shared Zod schema), in a sheet/dialog for quick items, full page for
   students/staff.
5. **Confirmations & toasts are uniform** — one confirm dialog component, one toast position
   (bottom-right), one error style. Users learn the system once.

## Tables: the performance & UX contract

Tables are 70% of this product. One shared `DataTable` used by every module, implementing the
video's patterns plus the best practice on top:

- **Server-side everything**: pagination (10–25/page), sorting, filtering — all in the DB query.
  Never ship the full list to the browser.
- **URL is the state** (video's pattern): `?page=3&search=ama&classId=5` — shareable, back-button
  works, refresh keeps position. No client state managers.
- **Skeleton rows** on load with fixed row height → no jumping; instant perceived speed.
- **Debounced search** (300ms) hitting the indexed `pg_trgm` queries; searches the columns users
  expect per list (name, class, subject — as in the video).
- **Count + data in one transaction**; page-count math server-side; prev/next disabled at bounds
  (video's `hasPrev/hasNext` logic).
- **Empty states teach**: no rows → an explanation + the primary action ("No students yet — Add
  your first student or Import CSV"), not a blank grid.
- **Mobile**: tables collapse to cards below `md`; same data, same actions.
- Column sets are **role-aware and fixed per role** — a teacher always sees the same student
  columns; we don't ship user-configurable columns in v1 (consistency > knobs).

## Role dashboards (composed from enabled modules)

Each role's home is a widget grid; widgets are declared by module manifests (doc 03), so the
dashboard automatically reflects the switchboard:

- **School admin**: student/staff counts, fees collected vs outstanding, attendance today,
  upcoming events, recent announcements.
- **Teacher**: today's lessons, my classes' attendance status, assignments to mark.
- **Parent**: per-child cards — attendance summary, latest results, fees due (pay button),
  announcements/events.
- **Student** (where enabled): timetable today, homework due, latest results.

## Settings & account (done properly, per your note)

- **My Account** (every user): profile + photo, phone/email, password change, notification
  preferences (SMS/email/in-app per event type), active sessions with sign-out-everywhere.
- **School Settings** (admin, tabbed): School profile & branding → Academic years & terms →
  Levels & classes → Subjects → Grading scheme → Fees setup → Users & roles →
  Billing & plan → SMS credits. Each tab is one clear form with explicit Save
  (auto-save only for toggles) and unsaved-changes guard.
- **Danger zone** styled and separated (archive class, reset term…), each behind typed confirmation.

## Accessibility & i18n baseline

- Keyboard navigable, visible focus rings, WCAG AA contrast (checked once at token level —
  cheap because of the token system).
- English UI at launch; all strings through a translation layer from day one so adding
  French/Twi later is content work, not refactoring.
