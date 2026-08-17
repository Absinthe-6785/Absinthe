import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import {
  createAccountNotesAttachmentMutationLockClient,
  NotesAttachmentMutationLockError,
  notesAttachmentMutationLockName,
  withAccountNotesAttachmentMutationLock,
  type NotesAttachmentMutationLockAdapter,
} from './notesAttachmentMutationLock';

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>(next => { resolve = next; });
  return { promise, resolve };
}

class SharedLockAuthority implements NotesAttachmentMutationLockAdapter {
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

async function openDurableDatabase(indexedDB: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('notes-attachment-cross-context-test', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('state');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function durablePut(database: IDBDatabase, key: string, value: unknown): Promise<void> {
  const transaction = database.transaction('state', 'readwrite');
  transaction.objectStore('state').put(value, key);
  await transactionDone(transaction);
}

async function durableGet<T>(database: IDBDatabase, key: string): Promise<T | undefined> {
  const transaction = database.transaction('state', 'readonly');
  const done = transactionDone(transaction);
  const value = await requestValue(transaction.objectStore('state').get(key)) as T | undefined;
  await done;
  return value;
}

describe('POST_RTU_05B cross-context Notes/attachment mutation lock', () => {
  it('fails closed when Web Locks are unavailable', async () => {
    await expect(withAccountNotesAttachmentMutationLock({
      accountId: 'account-a', locks: null, operation: () => 1,
    })).rejects.toEqual(expect.objectContaining<Partial<NotesAttachmentMutationLockError>>({ code: 'UNAVAILABLE' }));
  });

  it('uses an account-scoped non-secret lock name', () => {
    expect(notesAttachmentMutationLockName(' account/a '))
      .toBe('absinthe:notes-attachment-mutation:account%2Fa');
  });

  it('totally orders two independent clients sharing durable state when the writer wins', async () => {
    const indexedDB = new IDBFactory();
    const database = await openDurableDatabase(indexedDB);
    const authority = new SharedLockAuthority();
    const writerContext = createAccountNotesAttachmentMutationLockClient(authority);
    const gcContext = createAccountNotesAttachmentMutationLockClient(authority);
    const writerEntered = deferred();
    const releaseWriter = deferred();
    let gcEntered = false;
    let blobExists = true;

    const writer = writerContext('account-a', async () => {
      writerEntered.resolve();
      await durablePut(database, 'notes', ['attachment://x']);
      await releaseWriter.promise;
    });
    await writerEntered.promise;
    const gc = gcContext('account-a', async () => {
      gcEntered = true;
      const references = await durableGet<string[]>(database, 'notes') ?? [];
      if (!references.includes('attachment://x')) blobExists = false;
    });
    await Promise.resolve();
    expect(gcEntered).toBe(false);
    releaseWriter.resolve();
    await Promise.all([writer, gc]);
    expect(await durableGet(database, 'notes')).toEqual(['attachment://x']);
    expect(blobExists).toBe(true);
    database.close();
  });

  it('totally orders two independent clients sharing durable state when GC wins', async () => {
    const indexedDB = new IDBFactory();
    const database = await openDurableDatabase(indexedDB);
    const authority = new SharedLockAuthority();
    const gcContext = createAccountNotesAttachmentMutationLockClient(authority);
    const writerContext = createAccountNotesAttachmentMutationLockClient(authority);
    const gcEntered = deferred();
    const releaseGc = deferred();
    const events: string[] = [];
    let writerEntered = false;
    let blobExists = true;

    const gc = gcContext('account-a', async () => {
      gcEntered.resolve();
      expect(await durableGet<string[]>(database, 'notes')).toBeUndefined();
      await releaseGc.promise;
      blobExists = false;
      events.push('blob-delete');
    });
    await gcEntered.promise;
    const writer = writerContext('account-a', async () => {
      writerEntered = true;
      await durablePut(database, 'notes', ['attachment://x']);
      events.push('reference-commit');
    });
    await Promise.resolve();
    expect(writerEntered).toBe(false);
    releaseGc.resolve();
    await Promise.all([gc, writer]);
    expect(events).toEqual(['blob-delete', 'reference-commit']);
    expect(blobExists).toBe(false);
    expect(await durableGet(database, 'notes')).toEqual(['attachment://x']);
    database.close();
  });

  it('lets a different account proceed while another account is held', async () => {
    const authority = new SharedLockAuthority();
    const firstContext = createAccountNotesAttachmentMutationLockClient(authority);
    const secondContext = createAccountNotesAttachmentMutationLockClient(authority);
    const enteredA = deferred();
    const releaseA = deferred();
    let enteredB = false;
    const accountA = firstContext('account-a', async () => {
      enteredA.resolve();
      await releaseA.promise;
    });
    await enteredA.promise;
    await secondContext('account-b', async () => { enteredB = true; });
    expect(enteredB).toBe(true);
    releaseA.resolve();
    await accountA;
  });

  it('releases the lock after a writer throws', async () => {
    const authority = new SharedLockAuthority();
    const failedContext = createAccountNotesAttachmentMutationLockClient(authority);
    const laterContext = createAccountNotesAttachmentMutationLockClient(authority);
    await expect(failedContext('account-a', async () => { throw new Error('write failed'); }))
      .rejects.toThrow('write failed');
    await expect(laterContext('account-a', async () => 'continued')).resolves.toBe('continued');
  });
});
