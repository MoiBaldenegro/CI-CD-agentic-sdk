import { EventBase, EventName } from './Event-base';

export interface EventSubscriber {
  suscribeTo(): EventName;
  onEvent(event: EventBase): void;
}
