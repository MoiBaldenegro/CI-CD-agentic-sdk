import type { DomainEvent } from "../../../shared/DomainEvent.js";

export interface DomainEventPublisher {
  publish(events: readonly DomainEvent[]): Promise<void>;
}
