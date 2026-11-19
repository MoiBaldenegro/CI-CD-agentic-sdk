import { parseIntakeResponse, toRepositoryName } from '../task-intake.service';

describe('parseIntakeResponse', () => {
  it('lee preguntas', () => {
    expect(
      parseIntakeResponse('{"status":"questions","questions":["¿Qué stack?"]}'),
    ).toEqual({ status: 'questions', questions: ['¿Qué stack?'] });
  });

  it('tolera texto alrededor del JSON', () => {
    const text =
      'Claro:\n```json\n{"status":"questions","questions":["a"]}\n```';
    expect(parseIntakeResponse(text).status).toBe('questions');
  });

  it('arma la ficha y normaliza el nombre del repo', () => {
    const result = parseIntakeResponse(
      JSON.stringify({
        status: 'ready',
        task: {
          title: 'Landing cafetería',
          description: 'Haz una landing',
          repositoryName: 'Landing Cafetería!!',
          visibility: 'public',
          acceptanceCriteria: ['Tiene menú', ''],
        },
      }),
    );

    expect(result).toEqual({
      status: 'ready',
      task: {
        title: 'Landing cafetería',
        description: 'Haz una landing',
        repositoryName: 'landing-cafeteria',
        visibility: 'public',
        acceptanceCriteria: ['Tiene menú'],
      },
    });
  });

  it('visibilidad desconocida queda privada', () => {
    const result = parseIntakeResponse(
      '{"status":"ready","task":{"title":"t","description":"d","visibility":"x"}}',
    );
    expect(result.status === 'ready' && result.task.visibility).toBe('private');
  });

  it.each([
    'sin json',
    '{"status":"otro"}',
    '{"status":"questions","questions":[]}',
    '{"status":"ready","task":{"title":"","description":"d"}}',
  ])('rechaza %s', (text) => {
    expect(() => parseIntakeResponse(text)).toThrow();
  });
});

describe('toRepositoryName', () => {
  it.each([
    ['Mi Proyecto Ñandú', 'mi-proyecto-nandu'],
    ['---', 'proyecto-factory'],
    ['a'.repeat(150), 'a'.repeat(100)],
  ])('%s -> %s', (input, expected) => {
    expect(toRepositoryName(input)).toBe(expected);
  });
});
