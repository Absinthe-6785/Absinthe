import type { NoteBase } from '../../../noteUtils';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import { getDatabaseFieldValue } from '../databaseViews/databaseFieldValues';
import { computeRollup } from '../rollups/computeRollup';
import type {
  FormulaDefinition,
  FormulaErrorCode,
  FormulaInput,
  FormulaValue,
} from './formulaModels';

export interface FormulaEvalContext {
  note: NoteBase;
  service: KnowledgeIndexService;
  notesById: ReadonlyMap<string, NoteBase>;
  /** Formula column values keyed by lowercase column key */
  formulaValues: ReadonlyMap<string, FormulaValue>;
  /** Column keys participating in dependency cycles */
  cyclicKeys?: ReadonlySet<string>;
}

type Token =
  | { type: 'number'; value: number }
  | { type: 'ident'; name: string }
  | { type: 'op'; op: '+' | '-' | '*' | '/' }
  | { type: 'lparen' }
  | { type: 'rparen' };

type NumericResult = { ok: true; value: number } | { ok: false; error: FormulaErrorCode };

function errorValue(error: FormulaErrorCode): FormulaValue {
  return { raw: null, display: '—', error };
}

function successValue(raw: number): FormulaValue {
  const display = Number.isInteger(raw) ? String(raw) : String(Number(raw.toFixed(4)));
  return { raw, display };
}

function tokenize(source: string): { tokens: Token[] } | { error: FormulaErrorCode } {
  const tokens: Token[] = [];
  let index = 0;

  while (index < source.length) {
    const char = source[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    if (char === '(') {
      tokens.push({ type: 'lparen' });
      index += 1;
      continue;
    }
    if (char === ')') {
      tokens.push({ type: 'rparen' });
      index += 1;
      continue;
    }
    if ('+-*/'.includes(char)) {
      tokens.push({ type: 'op', op: char as '+' | '-' | '*' | '/' });
      index += 1;
      continue;
    }

    if (/[0-9.]/.test(char)) {
      let end = index + 1;
      while (end < source.length && /[0-9.]/.test(source[end])) {
        end += 1;
      }
      const parsed = Number(source.slice(index, end));
      if (!Number.isFinite(parsed)) {
        return { error: 'invalid_expression' };
      }
      tokens.push({ type: 'number', value: parsed });
      index = end;
      continue;
    }

    if (/[A-Za-z_]/.test(char)) {
      let end = index + 1;
      while (end < source.length && /[A-Za-z0-9_]/.test(source[end])) {
        end += 1;
      }
      tokens.push({ type: 'ident', name: source.slice(index, end) });
      index = end;
      continue;
    }

    return { error: 'invalid_expression' };
  }

  return { tokens };
}

class Parser {
  private pos = 0;

  constructor(
    private readonly tokens: Token[],
    private readonly bindings: Map<string, number>,
  ) {}

  parse(): NumericResult {
    const result = this.parseExpression();
    if (!result.ok) return result;
    if (this.peek()) return { ok: false, error: 'invalid_expression' };
    return result;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private consume(): Token | undefined {
    return this.tokens[this.pos++];
  }

  private parseExpression(): NumericResult {
    let left = this.parseTerm();
    if (!left.ok) return left;

    while (true) {
      const token = this.peek();
      if (!token || token.type !== 'op' || (token.op !== '+' && token.op !== '-')) {
        return left;
      }
      this.consume();
      const right = this.parseTerm();
      if (!right.ok) return right;
      left = {
        ok: true,
        value: token.op === '+' ? left.value + right.value : left.value - right.value,
      };
    }
  }

  private parseTerm(): NumericResult {
    let left = this.parseFactor();
    if (!left.ok) return left;

    while (true) {
      const token = this.peek();
      if (!token || token.type !== 'op' || (token.op !== '*' && token.op !== '/')) {
        return left;
      }
      this.consume();
      const right = this.parseFactor();
      if (!right.ok) return right;
      if (token.op === '/') {
        if (right.value === 0) {
          return { ok: false, error: 'division_by_zero' };
        }
        left = { ok: true, value: left.value / right.value };
      } else {
        left = { ok: true, value: left.value * right.value };
      }
    }
  }

  private parseFactor(): NumericResult {
    const token = this.peek();
    if (!token) return { ok: false, error: 'invalid_expression' };

    if (token.type === 'op' && token.op === '-') {
      this.consume();
      const inner = this.parseFactor();
      if (!inner.ok) return inner;
      return { ok: true, value: -inner.value };
    }

    if (token.type === 'number') {
      this.consume();
      return { ok: true, value: token.value };
    }

    if (token.type === 'ident') {
      this.consume();
      const value = this.bindings.get(token.name);
      if (value === undefined) {
        return { ok: false, error: 'missing_input' };
      }
      return { ok: true, value };
    }

    if (token.type === 'lparen') {
      this.consume();
      const inner = this.parseExpression();
      if (!inner.ok) return inner;
      const closing = this.consume();
      if (!closing || closing.type !== 'rparen') {
        return { ok: false, error: 'invalid_expression' };
      }
      return inner;
    }

    return { ok: false, error: 'invalid_expression' };
  }
}

function parseNumericField(raw: string): NumericResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: 'missing_property' };
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return { ok: false, error: 'type_mismatch' };
  }
  return { ok: true, value: parsed };
}

function rollupNumericValue(
  note: NoteBase,
  definition: FormulaInput & { type: 'rollup' },
  context: FormulaEvalContext,
): NumericResult {
  const rollup = computeRollup(
    note,
    definition.definition,
    context.service,
    context.notesById,
  );
  if (rollup.raw === null || rollup.raw === undefined) {
    return { ok: false, error: 'missing_rollup' };
  }
  if (typeof rollup.raw === 'number') {
    return { ok: true, value: rollup.raw };
  }
  if (typeof rollup.raw === 'string') {
    return parseNumericField(rollup.raw);
  }
  return { ok: false, error: 'type_mismatch' };
}

function metadataNumericValue(
  note: NoteBase,
  key: 'updatedAt' | 'createdAt' | 'title',
  context: FormulaEvalContext,
): NumericResult {
  if (key === 'title') {
    const title = getDatabaseFieldValue(note, 'title', context.service);
    return parseNumericField(title);
  }
  if (key === 'updatedAt') {
    return note.updatedAt > 0
      ? { ok: true, value: note.updatedAt }
      : { ok: false, error: 'missing_property' };
  }
  const extended = note as NoteBase & { createdAt?: number };
  if (typeof extended.createdAt === 'number' && extended.createdAt > 0) {
    return { ok: true, value: extended.createdAt };
  }
  return { ok: false, error: 'missing_property' };
}

function resolveInputBinding(
  input: FormulaInput,
  context: FormulaEvalContext,
): NumericResult {
  switch (input.type) {
    case 'field':
      return parseNumericField(
        getDatabaseFieldValue(context.note, input.key, context.service),
      );
    case 'rollup':
      return rollupNumericValue(context.note, input, context);
    case 'metadata':
      return metadataNumericValue(context.note, input.key, context);
    case 'formula': {
      const refKey = input.formulaKey.trim().toLowerCase();
      if (context.cyclicKeys?.has(refKey)) {
        return { ok: false, error: 'cyclic_dependency' };
      }
      const ref = context.formulaValues.get(refKey);
      if (!ref) {
        return { ok: false, error: 'missing_input' };
      }
      if (ref.error) {
        return { ok: false, error: ref.error };
      }
      if (typeof ref.raw !== 'number') {
        return { ok: false, error: 'type_mismatch' };
      }
      return { ok: true, value: ref.raw };
    }
    default:
      return { ok: false, error: 'missing_input' };
  }
}

function buildBindings(
  definition: FormulaDefinition,
  context: FormulaEvalContext,
): { bindings: Map<string, number> } | { error: FormulaErrorCode } {
  const bindings = new Map<string, number>();

  for (const [name, input] of Object.entries(definition.inputs)) {
    const resolved = resolveInputBinding(input, context);
    if (!resolved.ok) {
      return { error: resolved.error };
    }
    bindings.set(name, resolved.value);
  }

  return { bindings };
}

/** Evaluate a single formula for one row note — not persisted */
export function computeFormula(
  note: NoteBase,
  definition: FormulaDefinition,
  context: FormulaEvalContext,
): FormulaValue {
  const bindingResult = buildBindings(definition, { ...context, note });
  if ('error' in bindingResult) {
    return errorValue(bindingResult.error);
  }

  const tokenResult = tokenize(definition.expression);
  if ('error' in tokenResult) {
    return errorValue(tokenResult.error);
  }

  const parser = new Parser(tokenResult.tokens, bindingResult.bindings);
  const parsed = parser.parse();
  if (!parsed.ok) {
    return errorValue(parsed.error);
  }

  return successValue(parsed.value);
}
