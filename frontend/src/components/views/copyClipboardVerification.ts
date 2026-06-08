/**
 * copyClipboardVerification.ts — TEMPORARY live clipboard payload capture (UX-3A.2 QA)
 * Full dumps only — no truncation. Remove after QA confirms payload shape.
 */
import type { CopyTraceReport } from './copyDiagnostics';
import { classifyClipboardHtml } from './copyDiagnostics';
import { clipboardToBlocks } from './pasteOrchestrator';

export type ClipboardPayloadVariant =
  | 'A-semantic-details-summary'
  | 'B-h3-btsummary'
  | 'C-dom-be-toggle-wrap'
  | 'other';

export interface ClipboardByteDiff {
  index: number;
  expectedChar: string;
  actualChar: string;
  expectedContext: string;
  actualContext: string;
}

export interface CopyClipboardVerification {
  label: string;
  path: CopyTraceReport['path'] | null;
  preventedDefault: boolean;
  htmlClassification: string;
  payloadVariant: ClipboardPayloadVariant;
  expectedHtml: string;
  actualHtml: string;
  expectedPlain: string;
  actualPlain: string;
  htmlLengthExpected: number;
  htmlLengthActual: number;
  plainLengthExpected: number;
  plainLengthActual: number;
  htmlMatchesExpected: boolean;
  plainMatchesExpected: boolean;
  firstHtmlDiff: ClipboardByteDiff | null;
  firstPlainDiff: ClipboardByteDiff | null;
  parserRoute: string;
  parsedFirstBlockType: string | null;
  readSource: 'sync-clipboardData' | 'async-navigator.clipboard.read';
}

let lastVerification: CopyClipboardVerification | null = null;

export function getLastCopyClipboardVerification(): CopyClipboardVerification | null {
  return lastVerification;
}

export function classifyClipboardPayloadVariant(html: string): ClipboardPayloadVariant {
  if (/<details\b[^>]*class=["'][^"']*btoggle/i.test(html)
    && /<summary\b/i.test(html)) {
    return 'A-semantic-details-summary';
  }
  if (/<h[1-6]\b[^>]*class=["'][^"']*btsummary/i.test(html)
    || /<h3\b[^>]*class=["'][^"']*btsummary/i.test(html)) {
    return 'B-h3-btsummary';
  }
  if (/\bbe-toggle-wrap\b/i.test(html) || /\bbe-toggle-children\b/i.test(html)) {
    return 'C-dom-be-toggle-wrap';
  }
  return 'other';
}

export function firstByteDifference(expected: string, actual: string): ClipboardByteDiff | null {
  const max = Math.max(expected.length, actual.length);
  for (let i = 0; i < max; i++) {
    if (expected[i] !== actual[i]) {
      const ctx = 24;
      return {
        index: i,
        expectedChar: expected[i] ?? '(end)',
        actualChar: actual[i] ?? '(end)',
        expectedContext: expected.slice(Math.max(0, i - ctx), i + ctx),
        actualContext: actual.slice(Math.max(0, i - ctx), i + ctx),
      };
    }
  }
  return null;
}

function parserRouteForHtml(html: string, plain: string): { route: string; firstType: string | null } {
  const hasStructure = /<[a-z]/i.test(html);
  const pasted = clipboardToBlocks({
    getData: (t) => (t === 'text/html' ? html : t === 'text/plain' ? plain : ''),
  });
  if (html && hasStructure) {
    return {
      route: 'clipboardToBlocks → htmlHasBlockStructure → htmlDocumentToBlocks',
      firstType: pasted?.[0]?.type ?? null,
    };
  }
  if (plain) {
    return {
      route: 'clipboardToBlocks → plain fallback → markdownToBlocks',
      firstType: pasted?.[0]?.type ?? null,
    };
  }
  return { route: 'clipboardToBlocks → null', firstType: null };
}

function buildVerification(
  label: string,
  report: CopyTraceReport | null,
  expectedHtml: string,
  expectedPlain: string,
  actualHtml: string,
  actualPlain: string,
  readSource: CopyClipboardVerification['readSource'],
): CopyClipboardVerification {
  const parser = parserRouteForHtml(actualHtml, actualPlain);
  const verification: CopyClipboardVerification = {
    label,
    path: report?.path ?? null,
    preventedDefault: report?.preventedDefault ?? false,
    htmlClassification: classifyClipboardHtml(actualHtml),
    payloadVariant: classifyClipboardPayloadVariant(actualHtml),
    expectedHtml,
    actualHtml,
    expectedPlain,
    actualPlain,
    htmlLengthExpected: expectedHtml.length,
    htmlLengthActual: actualHtml.length,
    plainLengthExpected: expectedPlain.length,
    plainLengthActual: actualPlain.length,
    htmlMatchesExpected: expectedHtml === actualHtml,
    plainMatchesExpected: expectedPlain === actualPlain,
    firstHtmlDiff: firstByteDifference(expectedHtml, actualHtml),
    firstPlainDiff: firstByteDifference(expectedPlain, actualPlain),
    parserRoute: parser.route,
    parsedFirstBlockType: parser.firstType,
    readSource,
  };
  return verification;
}

function dumpVerification(v: CopyClipboardVerification): void {
  // eslint-disable-next-line no-console
  console.warn('[UX-3A copy:clipboard-verify]', {
    label: v.label,
    readSource: v.readSource,
    path: v.path,
    preventedDefault: v.preventedDefault,
    payloadVariant: v.payloadVariant,
    htmlClassification: v.htmlClassification,
    htmlMatchesExpected: v.htmlMatchesExpected,
    plainMatchesExpected: v.plainMatchesExpected,
    htmlLengthExpected: v.htmlLengthExpected,
    htmlLengthActual: v.htmlLengthActual,
    plainLengthExpected: v.plainLengthExpected,
    plainLengthActual: v.plainLengthActual,
    firstHtmlDiff: v.firstHtmlDiff,
    firstPlainDiff: v.firstPlainDiff,
    parserRoute: v.parserRoute,
    parsedFirstBlockType: v.parsedFirstBlockType,
  });
  // eslint-disable-next-line no-console
  console.warn('[UX-3A copy:clipboard-verify:expected-html:FULL]', v.expectedHtml);
  // eslint-disable-next-line no-console
  console.warn('[UX-3A copy:clipboard-verify:actual-html:FULL]', v.actualHtml);
  // eslint-disable-next-line no-console
  console.warn('[UX-3A copy:clipboard-verify:expected-plain:FULL]', v.expectedPlain);
  // eslint-disable-next-line no-console
  console.warn('[UX-3A copy:clipboard-verify:actual-plain:FULL]', v.actualPlain);
}

/** Sync read from ClipboardEvent after production copy handler. */
export function verifyCopyClipboardSync(
  e: ClipboardEvent,
  report: CopyTraceReport | null,
  label = 'production-copy',
): CopyClipboardVerification {
  const expectedHtml = report?.expectedHtml ?? '';
  const expectedPlain = report?.expectedPlain ?? '';
  const actualHtml = e.clipboardData?.getData('text/html') ?? '';
  const actualPlain = e.clipboardData?.getData('text/plain') ?? '';
  const verification = buildVerification(
    label,
    report,
    expectedHtml,
    expectedPlain,
    actualHtml,
    actualPlain,
    'sync-clipboardData',
  );
  lastVerification = verification;
  dumpVerification(verification);
  return verification;
}

/** Async read via navigator.clipboard.read (post browser default). */
export function scheduleAsyncClipboardVerification(
  report: CopyTraceReport | null,
  label = 'production-copy-async',
): void {
  if (!navigator.clipboard?.read) return;

  window.setTimeout(async () => {
    try {
      const items = await navigator.clipboard.read();
      let actualHtml = '';
      let actualPlain = '';
      for (const item of items) {
        if (item.types.includes('text/html')) {
          actualHtml = await (await item.getType('text/html')).text();
        }
        if (item.types.includes('text/plain')) {
          actualPlain = await (await item.getType('text/plain')).text();
        }
      }
      const expectedHtml = report?.expectedHtml ?? '';
      const expectedPlain = report?.expectedPlain ?? '';
      const verification = buildVerification(
        label,
        report,
        expectedHtml,
        expectedPlain,
        actualHtml,
        actualPlain,
        'async-navigator.clipboard.read',
      );
      lastVerification = verification;
      dumpVerification(verification);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[UX-3A copy:clipboard-verify:async] read failed', err);
    }
  }, 0);
}
