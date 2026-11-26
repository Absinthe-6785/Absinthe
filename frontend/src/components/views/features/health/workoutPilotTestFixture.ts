// Test-only: no client socket, project configuration, or hosted database.
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Worker } from 'node:worker_threads';
import type { HealthProps } from '../../../../types';
import { hashCanonicalPayload, LocalDatabaseError, type LocalDatabaseRepository } from '../../../../lib/localDatabase';
import { WorkoutSessionRepository } from '../../../../lib/workoutSessionRepository';
import type { WorkoutSessionV1 } from '../../../../lib/workoutSessionV1';
import {
  createWorkoutEditorBodyweightSet, createWorkoutEditorEntry, createWorkoutSessionEditor,
  projectWorkoutSessionEditor, type WorkoutEditorIdFactory,
} from './workoutSessionEditorAdapter';

type Commit = NonNullable<HealthProps['testOnlyCommitNewWorkout']>;
const rowFields = new Set(['id', 'block_id', 'exercise_blocks', 'sets']);
const blockFields = new Set(['id', 'name', 'type', 'tags']);
const setFields = new Set(['type', 'set', 'kg', 'reps', 'assisted_reps', 'done', 'is_dropset']);
const only = (value: object, allowed: ReadonlySet<string>) => Reflect.ownKeys(value)
  .every(key => typeof key === 'string' && allowed.has(key));

/** One new, single-entry/single-set draft only. Never translate persisted or mixed input. */
export function singleNewWorkoutPilot(repository: LocalDatabaseRepository, date: string,
  { idFactory, abortFirstTransaction = false }: { idFactory?: WorkoutEditorIdFactory; abortFirstTransaction?: boolean } = {}) {
  let pending: { draftHash: string; session: WorkoutSessionV1 } | undefined;
  let mayAttempt = true;
  let abort = abortFirstTransaction;
  const commit: Commit = async input => {
    const [row] = input.workouts;
    const [set] = row?.sets ?? [];
    const block = row?.exercise_blocks;
    if (!mayAttempt || !input.isCurrent() || input.accountId !== repository.namespace.userId
      || input.date !== date || input.workouts.length !== 1 || !block
      || !only(row, rowFields) || !only(block, blockFields)
      || row.block_id === '__session__' || row.block_id !== block.id
      || !/^temp-\d+$/.test(row.id.slice(0, -(block.id.length + 1))) || !row.id.endsWith(`-${block.id}`)
      || block.type !== 'bodyweight' || row.sets.length !== 1 || set.type !== 'bodyweight'
      || set.set !== 1 || !set.done || set.reps === '' || ![0, '0', ''].includes(set.kg)
      || !only(set, setFields)) {
      throw new Error('WORKOUT_PILOT_UNSUPPORTED_DRAFT');
    }
    const draftHash = hashCanonicalPayload(input.workouts);
    if (pending && pending.draftHash !== draftHash) throw new Error('WORKOUT_PILOT_RETRY_DRAFT_CHANGED');
    if (!pending) {
      const editor = createWorkoutSessionEditor(date, idFactory);
      const entry = createWorkoutEditorEntry({ id: block.id, name: block.name,
        tags: block.tags ?? [], type: 'bodyweight', cardioMode: null }, idFactory);
      entry.sets.push(createWorkoutEditorBodyweightSet({
        repsInput: set.reps, assistedRepsInput: set.assisted_reps ?? null,
        dropset: set.is_dropset ?? false, done: set.done,
      }, 1, idFactory));
      editor.entries.push(entry);
      pending = { draftHash, session: projectWorkoutSessionEditor(editor) };
    }
    mayAttempt = false;
    const testOnlyAbortAt = abort ? 'after_writes' : undefined;
    abort = false;
    try {
      await new WorkoutSessionRepository(repository).createWorkoutSession(pending.session, { testOnlyAbortAt });
    } catch (error) {
      // The repository waits for rollback before returning this particular result.
      // Failed/indeterminate operations remain latched; a confirmed abort reuses the IDs.
      if (error instanceof LocalDatabaseError && error.code === 'TRANSACTION_ABORTED') mayAttempt = true;
      throw error;
    }
  };
  return commit;
}

export const PILOT_OWNER = '11111111-1111-4111-8111-111111111111';
export const PILOT_FOREIGN = '22222222-2222-4222-8222-222222222222';
export const PILOT_ORIGIN = 'https://workout-pilot.invalid';
const PROJECT = 'workout-pilot-test';
export const PILOT_PGLITE_PACKAGE = process.env.ABSINTHE_WORKOUT_TEST_PGLITE_PACKAGE;

type Db = {
  exec(sql: string): Promise<unknown>;
  query<T>(sql: string, values?: unknown[]): Promise<{ rows: T[] }>;
  close(): Promise<void>;
};
type Fields = Record<string, unknown>;
const routes = {
  '/api/sync/v2/generations': ['ensure_remote_health_generation_v2', 'uuid,text,text,text,text'],
  '/api/sync/v2/workouts/authority': ['read_health_workout_authority_v1', 'uuid,text,text,text,text'],
  '/api/sync/v2/workouts/generations': ['register_health_workout_generation_v1', 'uuid,text,text,text,text'],
  '/api/sync/v2/workouts/mutations': ['apply_health_workout_mutation_v1',
    'uuid,text,text,text,text,uuid,bigint,uuid,text,text,text,bigint,bigint,jsonb,text,text,text'],
  '/api/sync/v2/workouts/changes': ['pull_health_workout_changes_v1', 'uuid,text,text,text,text,uuid,bigint,bigint,uuid,integer'],
} as const;

function isolatedPostgresWorker(packageFile: string): Db {
  const worker = new Worker(resolve(process.cwd(), 'test-support/workoutPilotPostgres.cjs'),
    { workerData: { packageFile: resolve(packageFile) } });
  const pending = new Map<number, (reply: { error?: string; result?: unknown }) => void>();
  let id = 0, failure: string | undefined;
  const fail = (error: string) => {
    failure = error;
    for (const complete of pending.values()) complete({ error });
    pending.clear();
  };
  worker.on('message', reply => { pending.get(reply.id)?.(reply); pending.delete(reply.id); });
  worker.on('error', error => fail(error instanceof Error ? error.message : String(error)));
  worker.on('exit', code => fail(`Isolated PostgreSQL test worker exited (${code})`));
  function call<T>(method: 'exec' | 'query', sql: string, values?: unknown[]): Promise<T> {
    return new Promise((done, reject) => {
      if (failure) return reject(new Error(failure));
      const requestId = ++id;
      pending.set(requestId, reply => reply.error ? reject(new Error(reply.error)) : done(reply.result as T));
      worker.postMessage({ id: requestId, method, sql, values });
    });
  }
  return { exec: sql => call('exec', sql), query: (sql, values) => call('query', sql, values),
    close: async () => { await worker.terminate(); } };
}

/** Fetch adapter only. PostgreSQL, not the adapter, commits rows and issues receipts. */
export async function isolatedWorkoutPilotBackend(packageFile: string) {
  const db = isolatedPostgresWorker(packageFile);
  try {
    const backend = resolve(process.cwd(), '../backend');
    const fixture = await readFile(resolve(backend, 'test_remote_mutation_v2_postgres.py'), 'utf8');
    const setup = /^SETUP_SQL = r"""([\s\S]*?)^"""/m.exec(fixture)?.[1];
    if (!setup) throw new Error('Missing existing PostgreSQL fixture');
    await db.exec(setup);
    for (const migration of [
      '202607120001_k323_idempotent_remote_mutation.sql',
      '202609180001_k323_v2_multi_domain_transport.sql',
      '202609190001_rel05f_health_routine_aggregate.sql',
      '202609230001_rel05g1_workout_dormant_foundation.sql',
      '202609240001_rel05g4a_workout_authority_transport.sql',
      '202609270001_rel05g4b1_workout_tombstone_uuid_value.sql',
    ]) await db.exec(await readFile(resolve(backend, 'migrations', migration), 'utf8'));
    for (const owner of [PILOT_OWNER, PILOT_FOREIGN]) {
      await db.query('insert into public.health_workout_capabilities(user_id,project_scope,state) values ($1,$2,$3)',
        [owner, PROJECT, 'FOUNDATION_READY']);
    }
    await db.exec('set role service_role');
    const calls: { url: string; path: string; owner: string; wire: string | null; result: Fields }[] = [];
    let loseMutationResponse = false;
    const fetch: typeof globalThis.fetch = async (input, init) => {
      const url = new URL(String(input));
      if (url.origin !== PILOT_ORIGIN || !Object.prototype.hasOwnProperty.call(routes, url.pathname)) throw new Error('Unexpected pilot request');
      const path = url.pathname as keyof typeof routes;
      const token = new Headers(init?.headers).get('authorization');
      const owner = token === 'Bearer synthetic-a' ? PILOT_OWNER : token === 'Bearer synthetic-b' ? PILOT_FOREIGN : null;
      if (!owner) return Response.json({}, { status: 401 });
      const wire = typeof init?.body === 'string' ? init.body : null;
      const req = wire === null ? Object.fromEntries(url.searchParams) : JSON.parse(wire) as Fields;
      const args: unknown[] = [owner, PROJECT, req.namespaceKey, req.generationId, req.deviceId];
      if (path.endsWith('/generations') && !path.includes('/workouts/') && req.accountId !== owner) {
        return Response.json({}, { status: 403 });
      }
      if (path.endsWith('/mutations') || path.endsWith('/changes')) args.push(req.bindingId, req.authorityEpoch);
      if (path.endsWith('/mutations')) {
        const payload = req.payload as Fields;
        if (payload.kind !== 'entity_snapshot') throw new Error('Pilot supports create only');
        args.push(req.entityId, req.mutationId, req.idempotencyKey, req.operation, req.remoteCasBaseRevision,
          req.localRevision, JSON.stringify(payload), req.payloadHash, hashCanonicalPayload(payload.record), req.requestDigest);
      } else if (path.endsWith('/changes')) {
        args.push(req.cursor ?? 0, req.serverEpoch ?? null, req.limit ?? 100);
      }
      const [rpc, signature] = routes[path];
      const placeholders = signature.split(',').map((type, i) => `$${i + 1}::${type}`).join(',');
      const { rows: [{ result }] } = await db.query<{ result: Fields }>(`select public.${rpc}(${placeholders}) as result`, args);
      calls.push({ url: url.href, path, owner, wire, result });
      if (path.endsWith('/mutations') && loseMutationResponse) {
        loseMutationResponse = false;
        throw new Error('Test lost response after SQL commit');
      }
      // Mirror the existing API adapter's server-owned scope field for discovery/registration.
      const response = path.endsWith('/authority') || path === '/api/sync/v2/workouts/generations'
        ? { ...result, projectScope: PROJECT } : result;
      const status = result.errorCode === 'CAPABILITY_DISABLED' || result.errorCode === 'AUTHORITY_RESET_FENCED'
        ? 423 : result.errorCode ? 409 : 200;
      return Response.json(response, { status });
    };
    return { db, fetch, calls, loseNextMutationResponse: () => { loseMutationResponse = true; } };
  } catch (error) {
    await db.close();
    throw error;
  }
}
