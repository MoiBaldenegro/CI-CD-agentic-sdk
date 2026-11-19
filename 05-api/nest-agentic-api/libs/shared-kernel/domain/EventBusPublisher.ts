import { EventBase } from './Event-base';

export interface EventBusPublisher {
  publish(event: EventBase): void;
}
