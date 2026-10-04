/** The billing cycles — run: pnpm run check:billing
 *  planPeriod() is pure: no database, nothing charged. */
import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgres://check:check@localhost:5432/check"; // never connected to
const { planPeriod } = await import("./billing");

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const ymd = (x: Date) => x.toISOString().slice(0, 10);
const TERM = 50000, STANDARD = 100000;

// first payment: four months from today, the full price
let q = planPeriod({ now: d("2026-09-10"), cycle: "term", pricePesewas: TERM, suspended: false, samePlan: false });
assert.deepEqual([ymd(q.start), ymd(q.end), q.chargePesewas], ["2026-09-10", "2027-01-10", TERM]);

// an academic year is twelve months
q = planPeriod({ now: d("2026-09-10"), cycle: "year", pricePesewas: 125000, suspended: false, samePlan: false });
assert.equal(ymd(q.end), "2027-09-10");

const current = { periodStart: d("2026-09-10"), periodEnd: d("2027-01-10"), valuePesewas: TERM };

// renewing early: the new period starts where the current one ends — no day lost
q = planPeriod({ now: d("2026-12-20"), cycle: "term", pricePesewas: TERM, suspended: false, samePlan: true, current });
assert.deepEqual([ymd(q.start), ymd(q.end), q.chargePesewas], ["2027-01-10", "2027-05-10", TERM]);

// ten days late, still inside the 14 days: no free days either
q = planPeriod({ now: d("2027-01-20"), cycle: "term", pricePesewas: TERM, suspended: false, samePlan: true, current });
assert.equal(ymd(q.start), "2027-01-10");

// suspended, or later than the 14 days: the period starts on the day of payment
q = planPeriod({ now: d("2027-02-15"), cycle: "term", pricePesewas: TERM, suspended: true, samePlan: true, current });
assert.equal(ymd(q.start), "2027-02-15");
q = planPeriod({ now: d("2027-02-15"), cycle: "term", pricePesewas: TERM, suspended: false, samePlan: true, current });
assert.equal(ymd(q.start), "2027-02-15");

// switching term → academic year on the same plan: the year starts when the term ends
q = planPeriod({ now: d("2026-11-01"), cycle: "year", pricePesewas: 125000, suspended: false, samePlan: true, current });
assert.deepEqual([ymd(q.start), ymd(q.end)], ["2027-01-10", "2028-01-10"]);

// upgrading halfway (61 of 122 days left): starts today, half the old term is credited
q = planPeriod({ now: d("2026-11-10"), cycle: "term", pricePesewas: STANDARD, suspended: false, samePlan: false, current });
assert.deepEqual([ymd(q.start), q.creditPesewas, q.chargePesewas], ["2026-11-10", 25000, 75000]);
assert.equal(q.creditPesewas + q.chargePesewas, STANDARD);

// moving down with more credit than the price: nothing to pay, the rest becomes extra days
q = planPeriod({
  now: d("2026-09-11"), cycle: "term", pricePesewas: TERM, suspended: false, samePlan: false,
  current: { periodStart: d("2026-09-10"), periodEnd: d("2027-01-10"), valuePesewas: STANDARD },
});
assert.equal(q.chargePesewas, 0);
assert.ok(+q.end > +d("2027-01-11"), "credit beyond the price extends the period");

console.log("billing: ok (first payment, renew early and late, suspended, term to year, upgrade credit, downgrade)");
process.exit(0);
