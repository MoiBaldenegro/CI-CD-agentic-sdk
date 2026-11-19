import { join } from 'node:path';
import { AGENT_WORK_ROOT, resolveWorkspace } from '../agent.config';

describe('resolveWorkspace', () => {
  it('usa ./work-directory por defecto', () => {
    expect(resolveWorkspace(undefined)).toBe(AGENT_WORK_ROOT);
  });

  it('resuelve rutas relativas dentro de ./work-directory', () => {
    expect(resolveWorkspace('demo')).toBe(join(AGENT_WORK_ROOT, 'demo'));
  });

  it('acepta rutas absolutas dentro de ./work-directory', () => {
    const inside = join(AGENT_WORK_ROOT, 'a', 'b');
    expect(resolveWorkspace(inside)).toBe(inside);
  });

  it.each(['..', '../src', 'demo/../../', 'C:/Users/Moises/Desktop', '/etc'])(
    'rechaza %s',
    (value) => {
      expect(() => resolveWorkspace(value)).toThrow(/fuera de/);
    },
  );
});
