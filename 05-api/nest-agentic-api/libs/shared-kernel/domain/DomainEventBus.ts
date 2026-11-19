import { EventSubscriber } from './EvenSubscriber';
import { EventBase } from './Event-base';

export interface DomainEventBus {
  subscribe(subscriber: EventSubscriber): void;
  unsubscribe(subscriber: EventSubscriber): void;
  publish(event: EventBase): void;
}
