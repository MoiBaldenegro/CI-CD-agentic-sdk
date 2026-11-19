export type EventName = string;

export abstract class EventBase {
  constructor(
    readonly eventId: string,
    readonly ocurredOn: Date,
  ) {}

  abstract getName(): EventName;
}
