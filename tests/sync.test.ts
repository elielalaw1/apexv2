import test from "node:test";
import assert from "node:assert/strict";
import { drainOutbox } from "../src/core/sync";
import { demoBatches } from "../src/core/demo";
test("Lost acknowledgement retries the exact package; mismatched ack leaves it pending", async () => {
  const batch = demoBatches()[0];
  let rows = [{ id: batch.batchId, payload: JSON.stringify(batch) }];
  let committed = 0;
  const received = new Set<string>();
  await assert.rejects(() =>
    drainOutbox(
      async () => rows,
      async (b) => {
        received.add(b.batchId);
        throw Error("Response lost after commit");
      },
      async () => {
        committed++;
        rows = [];
      },
    ),
  );
  assert.equal(rows.length, 1);
  assert.equal(committed, 0);
  await assert.rejects(() =>
    drainOutbox(
      async () => rows,
      async (b) => ({
        version: 1,
        batchId: b.batchId,
        accepted: b.samples.length - 1,
      }),
      async () => {
        rows = [];
      },
    ),
  );
  assert.equal(rows.length, 1);
  const n = await drainOutbox(
    async () => rows,
    async (b) => {
      assert.equal(received.has(b.batchId), true);
      return {
        version: 1,
        batchId: b.batchId,
        accepted: b.samples.length,
        duplicate: true,
      };
    },
    async () => {
      committed++;
      rows = [];
    },
  );
  assert.equal(n, 1);
  assert.equal(committed, 1);
  assert.equal(rows.length, 0);
});
