import { pageOf, pageOffset, pageRequest } from '../../domain/Page';
import { containsPattern } from '../../../persistence/postgres-db/like-pattern';
import { InMemoryTransaction, snapshotMap } from '../In-memory-transaction';

describe('InMemoryTransaction', () => {
  function store() {
    const rows = new Map<string, number>();
    return { rows, snapshot: () => snapshotMap(rows) };
  }

  it('keeps the writes of a run that succeeds', async () => {
    const a = store();
    const tx = new InMemoryTransaction([a]);

    await tx.run(async () => {
      a.rows.set('x', 1);
    });

    expect(a.rows.get('x')).toBe(1);
    expect(tx.rollbacks).toBe(0);
  });

  it('puts every store back when the run throws', async () => {
    const a = store();
    const b = store();
    a.rows.set('kept', 1);
    const tx = new InMemoryTransaction([a, b]);

    await expect(
      tx.run(async () => {
        a.rows.set('kept', 2);
        b.rows.set('new', 3);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect([...a.rows]).toEqual([['kept', 1]]);
    expect(b.rows.size).toBe(0);
    expect(tx.rollbacks).toBe(1);
  });

  it('a nested run joins the outer one', async () => {
    const a = store();
    const tx = new InMemoryTransaction([a]);

    await expect(
      tx.run(async () => {
        await tx.run(async () => {
          a.rows.set('inner', 1);
        });
        throw new Error('outer fails');
      }),
    ).rejects.toThrow('outer fails');

    expect(a.rows.size).toBe(0);
    expect(tx.rollbacks).toBe(1);
  });
});

describe('Page helpers', () => {
  it('keeps the request in range', () => {
    expect(pageRequest(0, 0)).toEqual({ page: 1, limit: 1 });
    expect(pageRequest(2.7, 1000)).toEqual({ page: 2, limit: 100 });
    expect(pageRequest(NaN, NaN)).toEqual({ page: 1, limit: 1 });
  });

  it('slices a list and counts every item', () => {
    const request = pageRequest(2, 2);
    expect(pageOffset(request)).toBe(2);
    expect(pageOf([1, 2, 3, 4, 5], request)).toEqual({
      items: [3, 4],
      total: 5,
      page: 2,
      limit: 2,
    });
    expect(pageOf([1], pageRequest(5, 10)).items).toEqual([]);
  });
});

describe('containsPattern', () => {
  it('takes the LIKE wildcards of the term literally', () => {
    expect(containsPattern('50%')).toBe('%50\\%%');
    expect(containsPattern('a_b')).toBe('%a\\_b%');
    expect(containsPattern('c:\\x')).toBe('%c:\\\\x%');
    expect(containsPattern('centro')).toBe('%centro%');
  });
});
