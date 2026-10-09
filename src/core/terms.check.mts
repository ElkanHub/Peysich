/** The cycle of use — run: pnpm run check:terms
 *  termState / termWritable / whyNotWritable are pure: no database. */
import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgres://check:check@localhost:5432/check"; // never connected to
const { termState, termWritable, whyNotWritable, schoolWritable, addDays, CORRECTION_DAYS } = await import("./terms");

const term = { name: "Term 2", startsAt: "2026-01-06", endsAt: "2026-04-02", openedAt: null as Date | null, closedAt: null as Date | null };

// not opened yet: upcoming, nothing may be written, even on its first day
assert.equal(termState(term, "2026-01-06"), "upcoming");
assert.equal(termWritable(term, "2026-01-06"), false);
assert.match(whyNotWritable(term, "2026-01-06"), /has not opened yet/);

// opened: open inside its dates, writable
const open = { ...term, openedAt: new Date("2026-01-06") };
assert.equal(termState(open, "2026-02-14"), "open");
assert.equal(termWritable(open, "2026-02-14"), true);

// the last day passed: ended, correctable for the window, then not
assert.equal(termState(open, "2026-04-03"), "ended");
assert.equal(termWritable(open, "2026-04-03"), true);
assert.equal(termWritable(open, addDays("2026-04-02", CORRECTION_DAYS)), true);
assert.equal(termWritable(open, addDays("2026-04-02", CORRECTION_DAYS + 1)), false);
assert.match(whyNotWritable(open, "2026-05-01"), /ended on 2 April/);

// closed: closed whatever the date, never writable
const closed = { ...open, closedAt: new Date("2026-04-10") };
assert.equal(termState(closed, "2026-03-01"), "closed");
assert.equal(termWritable(closed, "2026-03-01"), false);
assert.match(whyNotWritable(closed), /is closed/);

// the subscription gates writing: trial, active and past-due (inside grace) may write
assert.deepEqual(["trial", "active", "past_due", "suspended", "expired"].map(schoolWritable), [true, true, true, false, false]);

console.log("terms: ok");
