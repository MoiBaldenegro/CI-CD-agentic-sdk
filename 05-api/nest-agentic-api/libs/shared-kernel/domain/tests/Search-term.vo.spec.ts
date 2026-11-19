import { SearchTerm } from '../Search-term.vo';

describe('SearchTerm', () => {
  it.each([
    ['  HISTÓRICO ', 'historico'],
    ['Peña', 'pena'],
    ['centro   \t historico', 'centro historico'],
    ['ﬁnanzas', 'finanzas'],
    ['Ｃａｆé', 'cafe'],
    ['', ''],
  ])('normalizes %j to %j', (raw, expected) => {
    expect(new SearchTerm(raw).getValue()).toBe(expected);
  });

  it('matches regardless of case, accents and whitespace', () => {
    const term = new SearchTerm('  centro   HISTORICO ');
    expect(term.matches('Centro Histórico', 'Hermosillo')).toBe(true);
  });

  it('matches across the given texts', () => {
    expect(
      new SearchTerm('centro hermosillo').matches('Centro', 'Hermosillo'),
    ).toBe(true);
  });

  it('does not match unrelated text', () => {
    expect(new SearchTerm('norte').matches('Centro Histórico')).toBe(false);
  });

  it('an empty term matches everything', () => {
    const term = new SearchTerm('   ');
    expect(term.isEmpty()).toBe(true);
    expect(term.matches('anything')).toBe(true);
  });
});
