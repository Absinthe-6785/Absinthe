// Synthetic-only API. There is no production auth adapter or deploy configuration.
const fields = ['title', 'category', 'ingredients', 'steps', 'memo', 'starred'];
const defaults = { category: 'Other', ingredients: '', steps: '', memo: '', starred: false };
const columns = 'id, user_id, title, category, ingredients, steps, memo, starred, created_at, deleted_at, edit_revision';
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const find = `SELECT ${columns} FROM recipes WHERE id = ? AND user_id = ? AND deleted_at IS NULL`;

function parseEdit(payload, update) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const body = {};
  for (const key of fields) {
    const value = Object.hasOwn(payload, key) ? payload[key] : defaults[key];
    if (typeof value !== (key === 'starred' ? 'boolean' : 'string')) return null;
    body[key] = value;
  }
  if (update) {
    const rev = payload.expected_revision;
    if (typeof rev !== 'string' || !uuid.test(rev)) return null;
    body.expected_revision = rev.toLowerCase();
  }
  return body;
}

function apiRow(row) {
  return { ...row, starred: row.starred === 1 };
}

function isRecipeRow(row) {
  return row && [row.id, row.user_id, row.edit_revision].every(value => typeof value === 'string' && uuid.test(value))
    && fields.slice(0, -1).every(key => typeof row[key] === 'string')
    && typeof row.created_at === 'string'
    && (row.starred === 0 || row.starred === 1);
}

function fixtureHeaders(stats) {
  return {
    'x-fixture-queries': String(stats.queries),
    'x-fixture-rows-read': String(stats.reads),
    'x-fixture-rows-written': String(stats.writes),
  };
}

export async function handleRecipeRequest(request, env, user, measure = false) {
    const url = new URL(request.url);
    const stats = { queries: 0, reads: 0, writes: 0 };
    const respond = (body, status = 200) => Response.json(body, {
      status,
      headers: {
        'cache-control': 'no-store',
        ...(measure && fixtureHeaders(stats)),
      },
    });

    const collection = url.pathname === '/api/recipes';
    const trash = url.pathname === '/api/recipes/trash';
    const match = /^\/api\/recipes\/([0-9a-f-]+)(\/star|\/restore)?$/i.exec(url.pathname);
    const id = match && uuid.test(match[1]) ? match[1].toLowerCase() : null;
    const star = id && match[2] === '/star';
    const restore = id && match[2] === '/restore';
    const method = request.method;
    const missing = () => respond({ detail: 'Not found' }, 404);
    if (trash && method !== 'GET') return missing();
    if (match?.[2] && !(star && method === 'PUT') && !(restore && method === 'POST')) return missing();
    if (!collection && !trash && !id) return missing();
    if (id && !star && method === 'PUT') return respond({ detail: 'Reload the app before editing Recipes' }, 428);

    async function query(sql, values, mutation = false) {
      stats.queries++;
      const statement = env.DB.prepare(sql);
      const result = await (values.length ? statement.bind(...values) : statement).all();
      if (result.success !== true || !Array.isArray(result.results)) throw new Error('Unconfirmed database result');
      if (mutation) {
        const { changes, changed_db, rows_written } = result.meta;
        if (changes !== result.results.length || changes > 1 ||
            changed_db !== (changes === 1) || !Number.isSafeInteger(rows_written) ||
            (changes === 0 ? rows_written !== 0 : rows_written < 1)) {
          throw new Error('Contradictory write acknowledgement');
        }
      }
      stats.reads += result.meta.rows_read;
      stats.writes += result.meta.rows_written;
      return result.results;
    }

    try {
      if (trash) {
        const rows = await query(`SELECT ${columns} FROM recipes
          WHERE user_id = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC, id`, [user]);
        if (!rows.every(row => isRecipeRow(row) && row.user_id === user && typeof row.deleted_at === 'string')) {
          throw new Error('Unconfirmed trash result');
        }
        return respond(rows.map(apiRow));
      }
      if (restore || (id && method === 'DELETE')) {
        const deletedAt = restore ? null : new Date().toISOString();
        const next = crypto.randomUUID();
        // Only lifecycle columns change. The state predicate is not a revision
        // fence: a delayed request can still act in a subsequent lifecycle.
        const saved = await query(`UPDATE recipes SET deleted_at=?, edit_revision=?
          WHERE id=? AND user_id=? AND deleted_at IS ${restore ? 'NOT NULL' : 'NULL'} RETURNING ${columns}`,
          [deletedAt, next, id, user], true);
        if (saved.length === 0) {
          if (restore) {
            const [active] = await query(
              'SELECT id FROM recipes WHERE id=? AND user_id=? AND deleted_at IS NULL', [id, user]);
            if (active?.id === id) return respond({ detail: 'Recipe is not deleted' }, 409);
          }
          return missing();
        }
        const [row] = saved;
        if (!isRecipeRow(row) || row.id !== id || row.user_id !== user ||
            row.deleted_at !== deletedAt || row.edit_revision !== next) {
          throw new Error('Unconfirmed Recipe lifecycle transition');
        }
        return restore
          ? respond(apiRow(row))
          : respond({ deleted: true, recipe_id: id, account_id: user, deleted_at: deletedAt });
      }
      if (star) {
        const body = await request.json().catch(() => null);
        if (!body || typeof body.starred !== 'boolean') return respond({ detail: 'Invalid favorite target' }, 422);
        const target = Number(body.starred);
        const next = crypto.randomUUID();
        const saved = await query(`UPDATE recipes SET starred=?, edit_revision=?
          WHERE id=? AND user_id=? AND deleted_at IS NULL RETURNING ${columns}`, [target, next, id, user], true);
        if (saved.length === 0) return missing();
        const [row] = saved;
        if (!isRecipeRow(row) || row.id !== id || row.user_id !== user || row.deleted_at !== null ||
            row.starred !== target || row.edit_revision !== next) {
          throw new Error('Unconfirmed favorite update');
        }
        return respond(apiRow(row));
      }
      if (collection && method === 'GET') {
        return respond((await query(`SELECT ${columns} FROM recipes
          WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC, id`, [user])).map(apiRow));
      }
      if (id && method === 'GET') {
        const [row] = await query(find, [id, user]);
        return row ? respond(apiRow(row)) : missing();
      }
      const updating = id && method === 'PATCH';
      if (!(collection && method === 'POST') && !updating) {
        return respond({ detail: 'Method not allowed' }, 405);
      }
      const body = parseEdit(await request.json().catch(() => null), updating);
      if (!body) return respond({ detail: 'Invalid recipe or expected revision' }, 422);
      const values = fields.map(key => key === 'starred' ? Number(body[key]) : body[key]);
      const target = updating ? id : crypto.randomUUID();
      const next = crypto.randomUUID();
      const saved = updating
        ? await query(`UPDATE recipes SET title=?, category=?, ingredients=?, steps=?, memo=?, starred=?, edit_revision=?
          WHERE id=? AND user_id=? AND deleted_at IS NULL AND edit_revision=? RETURNING ${columns}`,
          [...values, next, target, user, body.expected_revision], true)
        : await query(`INSERT INTO recipes (id, user_id, title, category, ingredients, steps, memo, starred, created_at, edit_revision)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING ${columns}`, [target, user, ...values, new Date().toISOString(), next], true);
      if (updating && saved.length === 0) {
        // The CAS statement cannot leak another owner's row. Read current only on compare failure.
        const [current] = await query(find, [target, user]);
        return current
          ? respond({ detail: { code: 'RECIPE_EDIT_CONFLICT', current: apiRow(current) } }, 409)
          : missing();
      }
      const [row] = saved;
      if (saved.length !== 1 || row.id !== target || row.user_id !== user || row.deleted_at !== null ||
          row.edit_revision !== next || !fields.every((key, index) => row[key] === values[index])) {
        throw new Error('Unconfirmed write');
      }
      return respond(apiRow(row));
    } catch {
      // Do not claim rollback or repeat a write when its outcome is unknown.
      return respond({ detail: 'Recipe operation not confirmed' }, 503);
    }
}

export default {
  fetch(request, env) {
    const fail = (detail, status) => Response.json({ detail }, {
      status, headers: { 'cache-control': 'no-store', ...fixtureHeaders({ queries: 0, reads: 0, writes: 0 }) },
    });
    if (env.RECIPE_FIXTURE_ONLY !== 'miniflare' || new URL(request.url).hostname !== 'recipe-fixture.invalid') {
      return fail('Not found', 404);
    }
    const auth = request.headers.get('authorization') ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const user = token && env.ACTORS && Object.hasOwn(env.ACTORS, token) ? env.ACTORS[token] : null;
    return typeof user === 'string' ? handleRecipeRequest(request, env, user, true) : fail('Unauthorized', 401);
  },
};
