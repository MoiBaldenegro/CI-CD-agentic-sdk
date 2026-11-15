export interface DomainEvent {
  readonly eventId: string;
  readonly eventName: string;
  readonly aggregateId: string;
  readonly occurredAt: Date;
  readonly version: number;
}

export abstract class BaseDomainEvent implements DomainEvent {
  readonly eventId: string;
  readonly eventName: string;
  readonly aggregateId: string;
  readonly occurredAt: Date;
  readonly version: number;

  protected constructor(eventName: string, aggregateId: string, version: number) {
    this.eventId = globalThis.crypto.randomUUID();
    this.eventName = eventName;
    this.aggregateId = aggregateId;
    this.occurredAt = new Date();
    this.version = version;
  }
}
