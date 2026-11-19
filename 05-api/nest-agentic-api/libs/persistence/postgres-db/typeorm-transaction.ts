import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { TransactionPort } from '../../shared-kernel/domain/Transaction';

/**
 * The transaction a use case is running in. It travels with the async call
 * chain (AsyncLocalStorage), so a repository called anywhere inside
 * `TypeOrmTransaction.run` writes through the same connection without the
 * domain passing it around.
 */
interface TransactionContext {
  manager: EntityManager;
  /** Work queued to run inside the transaction right before the commit. */
  beforeCommit: Array<(manager: EntityManager) => Promise<void>>;
  /** Keys of the `beforeCommitOnce` steps already queued. */
  queuedOnce: Set<string>;
}

const storage = new AsyncLocalStorage<TransactionContext>();

/**
 * The manager of the transaction in progress, or the default one (each
 * statement on its own) when there is none.
 */
export function currentManager(dataSource: DataSource): EntityManager {
  return storage.getStore()?.manager ?? dataSource.manager;
}

/** Whether a transaction started by `inTransaction` is in progress. */
export function isInTransaction(): boolean {
  return storage.getStore() !== undefined;
}

/**
 * Runs `work` in the transaction in progress, or opens one (and makes it the
 * current one for everything `work` calls). Repositories use it for writes
 * that must be atomic on their own (a row and its outbox events); inside a
 * use case they simply join it.
 */
export async function inTransaction<T>(
  dataSource: DataSource,
  work: (manager: EntityManager) => Promise<T>,
): Promise<T> {
  const current = storage.getStore();
  if (current) return work(current.manager);

  return dataSource.transaction(async (manager) => {
    const context: TransactionContext = {
      manager,
      beforeCommit: [],
      queuedOnce: new Set(),
    };
    return storage.run(context, async () => {
      const result = await work(manager);
      // A step may queue more work while the queue drains
      for (let i = 0; i < context.beforeCommit.length; i++) {
        await context.beforeCommit[i](manager);
      }
      return result;
    });
  });
}

/**
 * Queues `step` to run inside the current transaction right before it
 * commits. Returns `false` when there is no transaction in progress.
 */
export function beforeCommit(
  step: (manager: EntityManager) => Promise<void>,
): boolean {
  const current = storage.getStore();
  if (!current) return false;
  current.beforeCommit.push(step);
  return true;
}

/**
 * `beforeCommit`, but only the first step queued under `key` in the
 * transaction runs (e.g. one version bump per feed however many changes the
 * transaction made). Returns `false` when there is no transaction in
 * progress.
 */
export function beforeCommitOnce(
  key: string,
  step: (manager: EntityManager) => Promise<void>,
): boolean {
  const current = storage.getStore();
  if (!current) return false;
  if (current.queuedOnce.has(key)) return true;
  current.queuedOnce.add(key);
  current.beforeCommit.push(step);
  return true;
}

/** `TransactionPort` on the service's Postgres connection. */
@Injectable()
export class TypeOrmTransaction implements TransactionPort {
  constructor(private readonly dataSource: DataSource) {}

  run<T>(work: () => Promise<T>): Promise<T> {
    return inTransaction(this.dataSource, () => work());
  }
}
