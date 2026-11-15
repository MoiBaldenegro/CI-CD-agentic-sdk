import type { UnitOfWork } from "../../core/domain/outbound/UnitOfWork.port.js";

export class NoopUnitOfWork implements UnitOfWork {
  async run<T>(work: () => Promise<T>): Promise<T> {
    return work();
  }
}
