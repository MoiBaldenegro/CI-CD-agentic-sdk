import type { DomainEventPublisher } from "../../core/domain/outbound/DomainEventPublisher.port.js";
import type { DomainEvent } from "../../shared/DomainEvent.js";

export class ConsoleEventPublisher implements DomainEventPublisher {
  async publish(events: readonly DomainEvent[]): Promise<void> {
    for (const event of events) {
      console.log(`[event] ${event.eventName} ${JSON.stringify(event)}`);
    }
  }
}
