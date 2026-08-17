import { loadEnv } from 'vite';

class SharedTestWebLocks {
  private readonly tails = new Map<string, Promise<void>>();

  async request<T>(
    name: string,
    _options: { mode: 'exclusive' },
    callback: (lock: Lock | null) => Promise<T> | T,
  ): Promise<T> {
    const previous = this.tails.get(name) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const tail = previous.catch(() => undefined).then(() => gate);
    this.tails.set(name, tail);
    await previous.catch(() => undefined);
    try {
      return await callback({ name, mode: 'exclusive' } as Lock);
    } finally {
      release();
      if (this.tails.get(name) === tail) this.tails.delete(name);
    }
  }
}

const testNavigator = globalThis.navigator ?? ({} as Navigator);
Object.defineProperty(testNavigator, 'locks', {
  configurable: true,
  value: new SharedTestWebLocks(),
});
if (typeof globalThis.navigator === 'undefined') {
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: testNavigator });
}

const testEnv = loadEnv('test', process.cwd(), 'VITE_');
const env = import.meta.env as Record<string, unknown>;
env.VITE_ABSINTHE_RETURN_TO_USE_ATTACHMENT_ISOLATION =
  testEnv.VITE_ABSINTHE_RETURN_TO_USE_ATTACHMENT_ISOLATION ?? 'false';
