import { DomainEvent } from './Domain-event';
import { EventSubscriber } from './EvenSubscriber';

export interface DomainEventSubscriber<T> extends EventSubscriber {
  onEvent(event: DomainEvent<T>): void;
}
