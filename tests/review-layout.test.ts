import { test } from "node:test";
import assert from "node:assert/strict";
import { combineCards, readCards, ReviewCard } from "../src/core/reviewLayout";

const cards: ReviewCard[] = [
  { id: "hr", kind: "signal", signals: ["hr"] },
  { id: "rr", kind: "signal", signals: ["rr"] },
  { id: "motion", kind: "signal", signals: ["phoneacc"] },
  { id: "events", kind: "timeline" },
];
test("Combining graphs keeps every selected signal and supports multi-signal overlays", () => {
  const combined = combineCards(cards, "rr", "hr");
  assert.equal(combined.length, 3);
  assert.deepEqual(
    combined.flatMap((c) => (c.kind === "signal" ? c.signals : [])),
    ["hr", "rr", "phoneacc"],
  );
  assert.deepEqual(combineCards(combined, "motion", "hr")[0], {
    id: "hr",
    kind: "signal",
    signals: ["hr", "rr", "phoneacc"],
  });
  assert.equal(combineCards(cards, "hr", "events"), cards);
});
test("Saved preferences reload intact and cannot introduce unavailable or duplicate signals", () => {
  const combined = combineCards(cards, "rr", "hr");
  const raw = JSON.stringify({ version: 1, cards: combined });
  assert.deepEqual(
    readCards(raw, ["hr", "rr", "phoneacc"], false, true),
    combined,
  );
  assert.equal(readCards(raw, ["hr"], false, true), null);
  assert.equal(readCards(raw, ["hr", "rr", "phoneacc"], false, false), null);
  assert.equal(
    readCards(
      JSON.stringify({
        version: 1,
        cards: [
          ...combined,
          { id: "another", kind: "signal", signals: ["hr"] },
        ],
      }),
      ["hr", "rr", "phoneacc"],
      false,
      true,
    ),
    null,
  );
  assert.equal(
    readCards('{"version":999,"cards":[]}', ["hr"], false, true),
    null,
  );
});
