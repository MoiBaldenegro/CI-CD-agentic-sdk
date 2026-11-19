import { TransactionPort } from '../domain/Transaction';

/** An in-memory store that can be put back as it was. */
export interface Snapshotable {
  /** Copies the current state; the returned function restores it. */
  snapshot(): () => void;
}

/**
 * Test double of TransactionPort: if the work throws, every participant (the
 * in-memory repositories, the recording event bus) goes back to how it was
 * before `run`, like a rolled-back database transaction. A nested `run`
 * joins the outer one.
 */
export class InMemoryTransaction implements TransactionPort {
  private depth = 0;
  /** Outermost `run` calls that threw and were rolled back. */
  rollbacks = 0;

  constructor(private readonly participants: Snapshotable[]) {}

  async run<T>(work: () => Promise<T>): Promise<T> {
    if (this.depth > 0) return work();

    const restores = this.participants.map((participant) =>
      participant.snapshot(),
    );
    this.depth++;
    try {
      return await work();
    } catch (error) {
      restores.forEach((restore) => restore());
      this.rollbacks++;
      throw error;
    } finally {
      this.depth--;
    }
  }
}

/** Snapshot of a Map-backed store. */
export function snapshotMap<K, V>(rows: Map<K, V>): () => void {
  const copy = new Map(rows);
  return () => {
    rows.clear();
    copy.forEach((value, key) => rows.set(key, value));
  };
}
