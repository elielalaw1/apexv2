import { Batch, BatchSchema } from "./contract";
export type Ack = {
  version: number;
  batchId: string;
  accepted: number;
  duplicate?: boolean;
};
export type Pending = { id: string; payload: string };
// A lost reply leaves the exact immutable batch in the durable outbox. Retry is safe.
export async function drainOutbox(
  read: () => Promise<Pending[]>,
  send: (batch: Batch) => Promise<Ack>,
  acknowledge: (id: string) => Promise<void>,
  progress: (n: number) => void = () => {},
) {
  let total = 0;
  for (;;) {
    const rows = await read();
    if (!rows.length) return total;
    for (const row of rows) {
      const batch = BatchSchema.parse(JSON.parse(row.payload));
      if (row.id !== batch.batchId)
        throw Error("Outbox ID does not match the batch");
      const ack = await send(batch);
      if (
        ack.version !== 1 ||
        ack.batchId !== batch.batchId ||
        ack.accepted !== batch.samples.length
      )
        throw Error("Server acknowledgment does not match the batch");
      await acknowledge(row.id);
      progress(++total);
    }
  }
}
