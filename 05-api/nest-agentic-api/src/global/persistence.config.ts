export type PersistenceDriver = 'memory' | 'postgres';

export function resolvePersistenceDriver(): PersistenceDriver {
  const fallback =
    process.env.NODE_ENV === 'production' ? 'postgres' : 'memory';
  const driver = (process.env.PERSISTENCE ?? fallback).toLowerCase();
  return driver === 'postgres' ? 'postgres' : 'memory';
}
