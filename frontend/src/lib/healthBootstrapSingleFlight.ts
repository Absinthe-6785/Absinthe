/**
 * Account-scoped single-flight boundary for the durable Health bootstrap.
 *
 * UI generations may be cancelled or recreated (including by React
 * StrictMode), but the underlying account-scoped durable operation must not
 * be started twice while it is active.
 */
const inFlightHealthBootstraps = new Map<string, Promise<unknown>>();

export function runHealthBootstrapSingleFlight<T>(
  accountId: string,
  start: () => Promise<T>,
): Promise<T> {
  const key = accountId.trim();
  if (!key) return Promise.reject(new Error('health_bootstrap_account_required'));

  const current = inFlightHealthBootstraps.get(key) as Promise<T> | undefined;
  if (current) return current;

  const promise = Promise.resolve().then(start);
  inFlightHealthBootstraps.set(key, promise);

  const release = () => {
    if (inFlightHealthBootstraps.get(key) === promise) {
      inFlightHealthBootstraps.delete(key);
    }
  };
  promise.then(release, release);
  return promise;
}
