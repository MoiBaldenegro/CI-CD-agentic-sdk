import { Entity } from './Entity';

/**
 * Entity that is the consistency boundary of its cluster: it has its own
 * repository and lifecycle, and records the domain events of the cluster.
 */
export abstract class AggregateRoot<T> extends Entity<T> {}
