import { EventBase } from './Event-base';

function generateId() {
  return crypto.randomUUID();
}

export abstract class DomainEvent<T> extends EventBase {
  constructor(private readonly data: T) {
    super(generateId(), new Date());
  }

  getData(): T {
    return this.data;
  }
}
