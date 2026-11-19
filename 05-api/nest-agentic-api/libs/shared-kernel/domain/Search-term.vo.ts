import { ValueObjectBase } from './Value-object';

/**
 * Free-text search term, normalized so that matching ignores case, accents,
 * compatibility forms and extra whitespace: "  HISTÓRICO " matches
 * "Centro Histórico", and "Ａ" matches "A".
 *
 * Which fields a term is matched against is a rule of each context; this
 * object only knows how to compare text.
 */
export class SearchTerm extends ValueObjectBase<string> {
  constructor(raw: string = '') {
    super(SearchTerm.normalize(raw), 'invalid search term');
  }

  protected validate(value: string): boolean {
    return typeof value === 'string';
  }

  /**
   * NFKD splits accented letters into base letter + combining mark (and
   * folds compatibility forms such as ligatures or full-width letters); the
   * marks are then removed. Internal whitespace runs collapse to one space.
   */
  static normalize(text: string): string {
    if (!text) return '';
    return text
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  isEmpty(): boolean {
    return this.getValue() === '';
  }

  /**
   * True when the term is empty or appears in the given texts. The texts are
   * joined, so a term may span fields ("centro hermosillo" matches name
   * "Centro" + city "Hermosillo").
   */
  matches(...texts: string[]): boolean {
    if (this.isEmpty()) return true;
    return SearchTerm.normalize(texts.join(' ')).includes(this.getValue());
  }
}
