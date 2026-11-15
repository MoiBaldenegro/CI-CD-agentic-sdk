import type { DomainEventPublisher } from "../../core/domain/outbound/DomainEventPublisher.port.js";
import type { DomainEvent } from "../../shared/DomainEvent.js";

export class CollectingEventPublisher implements DomainEventPublisher {
  private collected: DomainEvent[] = [];

  async publish(events: readonly DomainEvent[]): Promise<void> {
    this.collected.push(...events);
  }

  pull(): readonly DomainEvent[] {
    const events = this.collected;
    this.collected = [];
    return events;
  }
}
