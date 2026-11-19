/**
 * `%term%` for `LIKE … ESCAPE '\'`, with the wildcards of the user's term
 * (`%`, `_`) and the escape character itself taken literally: searching
 * "50%" finds "50%", not everything that starts with "50".
 */
export function containsPattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, '\\$&')}%`;
}
