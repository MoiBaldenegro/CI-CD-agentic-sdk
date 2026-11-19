/**
 * Runs a use case as one unit: every write made inside `work` (through the
 * repositories) is committed together, or none is if `work` throws. A `run`
 * inside another `run` joins the outer one.
 *
 * The application services own it: a use case that writes more than one
 * aggregate (create a tenant and give it its trial, revoke a license and
 * suspend the tenant) wraps its steps in `run`, so a failure halfway leaves
 * nothing half-done.
 */
export interface TransactionPort {
  run<T>(work: () => Promise<T>): Promise<T>;
}

/** No transaction: for tests whose repositories have nothing to roll back. */
export const NO_TRANSACTION: TransactionPort = {
  run: (work) => work(),
};
