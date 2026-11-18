import { test } from "node:test";
import assert from "node:assert/strict";
import { mapInboxCounts, badgeText, badgeLabel, sumCounts } from "./counts.ts";
import { compareSemver } from "../utils.ts";

test("compareSemver", () => {
  assert.equal(compareSemver("0.5.0", "1.0.0"), -1);
  assert.equal(compareSemver("1.0.0", "1.0.0"), 0);
  assert.equal(compareSemver("1.10.0", "1.9.9"), 1);
  assert.equal(compareSemver(null, "1.0.0"), -1);
  assert.equal(compareSemver("", "0.0.1"), -1);
  assert.equal(compareSemver("1.0", "1.0.0"), 0);
  assert.equal(compareSemver("2.0.0", "1.99.99"), 1);
});

test("mapInboxCounts: Mapping und Härtung", () => {
  assert.deepEqual(mapInboxCounts({ urlaub: 3, auslagen: "2", feedback: -1, registrierungen: null }), {
    urlaub: 3, auslagen: 2, feedback: 0, registrierungen: 0,
  });
  assert.deepEqual(mapInboxCounts(null), { urlaub: 0, auslagen: 0, feedback: 0, registrierungen: 0 });
  assert.equal(mapInboxCounts({ urlaub: 2.7 }).urlaub, 2);
});

test("Badge-Text und -Label", () => {
  assert.equal(badgeText(3), "3");
  assert.equal(badgeText(9), "9");
  assert.equal(badgeText(10), "9+");
  assert.equal(badgeLabel("urlaub", 1), "1 offener Urlaubsantrag");
  assert.equal(badgeLabel("urlaub", 3), "3 offene Urlaubsanträge");
  assert.equal(sumCounts({ urlaub: 1, auslagen: 2, feedback: 3, registrierungen: 4 }, ["feedback", "registrierungen"]), 7);
});
