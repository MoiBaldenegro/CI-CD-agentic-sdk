import { parseTaskAgentOutcome } from '../TaskAgentProtocol';

describe('parseTaskAgentOutcome', () => {
  it('usa IN_REVIEW cuando no hay marcador', () => {
    expect(parseTaskAgentOutcome('hice algo').status).toBe('IN_REVIEW');
  });

  it('respeta COMPLETED explícito', () => {
    const outcome = parseTaskAgentOutcome(
      'listo\n[[FACTORY_STATUS:COMPLETED]]',
    );
    expect(outcome.status).toBe('COMPLETED');
    expect(outcome.summary).toBe('listo');
  });

  it('extrae motivo de BLOCKED', () => {
    const outcome = parseTaskAgentOutcome(
      '[[FACTORY_STATUS:BLOCKED:faltan credenciales]]',
    );
    expect(outcome).toMatchObject({
      status: 'BLOCKED',
      reason: 'faltan credenciales',
    });
  });

  it('toma el último marcador', () => {
    const text =
      '[[FACTORY_STATUS:COMPLETED]] ... [[FACTORY_STATUS:IN_REVIEW]]';
    expect(parseTaskAgentOutcome(text).status).toBe('IN_REVIEW');
  });
});
