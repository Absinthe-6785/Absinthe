// Run PGlite in Node alone: the mounted test's browser globals change WASM asset resolution.
const { createRequire } = require('node:module');
const { parentPort, workerData } = require('node:worker_threads');

async function run() {
  const load = createRequire(workerData.packageFile);
  const { PGlite } = load('@electric-sql/pglite');
  const { pgcrypto } = load('@electric-sql/pglite/contrib/pgcrypto');
  const db = await PGlite.create({ extensions: { pgcrypto } });
  parentPort.on('message', async ({ id, method, sql, values }) => {
    try {
      if (method !== 'exec' && method !== 'query') throw new Error('Unknown PostgreSQL fixture method');
      const result = method === 'exec' ? await db.exec(sql) : await db.query(sql, values);
      parentPort.postMessage({ id, result });
    } catch (error) {
      parentPort.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
    }
  });
}

void run().catch(error => { throw error; });
