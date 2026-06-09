/**
 * browserClipboardCapture.ts — Dev-only OS clipboard vs handler clipboard capture (UX-3A QA).
 */
import type { CopyTraceReport } from './copyDiagnostics';
import { isEditorQaEnabled } from '../../../../../editorQa';
import {
  classifyClipboardPayloadVariant,
  firstByteDifference,
  type ClipboardByteDiff,
  type ClipboardPayloadVariant,
} from './copyClipboardVerification';

export interface MimePayloadDump {
  itemIndex: number;
  mimeType: string;
  byteLength: number;
  payload: string;
}

export type ChromiumClipboardBehavior =
  | 'unchanged'
  | 'augmented'
  | 'replaced-with-dom'
  | 'replaced-other'
  | 'async-unavailable'
  | 'async-read-failed';

export interface BrowserClipboardReport {
  label: string;
  path: CopyTraceReport['path'] | null;
  preventedDefault: boolean;
  expectedHtml: string;
  expectedPlain: string;
  syncClipboardData: {
    availableMimeTypes: string[];
    html: string;
    plain: string;
    htmlVariant: ClipboardPayloadVariant;
    htmlMatchesExpected: boolean;
    firstHtmlDiffVsExpected: ClipboardByteDiff | null;
  };
  asyncNavigatorClipboard: {
    available: boolean;
    itemCount: number;
    allMimeTypes: string[];
    payloads: MimePayloadDump[];
    html: string;
    plain: string;
    htmlVariant: ClipboardPayloadVariant;
    htmlMatchesExpected: boolean;
    firstHtmlDiffVsExpected: ClipboardByteDiff | null;
    htmlMatchesSync: boolean;
    firstHtmlDiffVsSync: ClipboardByteDiff | null;
    readError: string | null;
  };
  chromiumBehavior: ChromiumClipboardBehavior;
  verdict: string;
}

let lastReport: BrowserClipboardReport | null = null;

export function getLastBrowserClipboardReport(): BrowserClipboardReport | null {
  return lastReport;
}

function listSyncMimeTypes(e: ClipboardEvent): string[] {
  const types: string[] = [];
  const dt = e.clipboardData;
  if (!dt) return types;
  if (typeof dt.types !== 'undefined') {
    for (let i = 0; i < dt.types.length; i++) types.push(dt.types[i]);
  }
  return types;
}

export async function readAllClipboardMimeTypes(): Promise<{
  itemCount: number;
  allMimeTypes: string[];
  payloads: MimePayloadDump[];
  html: string;
  plain: string;
}> {
  const items = await navigator.clipboard.read();
  const allMimeTypes = new Set<string>();
  const payloads: MimePayloadDump[] = [];
  let html = '';
  let plain = '';

  for (let i = 0; i < items.length; i++) {
    for (const mimeType of items[i].types) {
      allMimeTypes.add(mimeType);
      const blob = await items[i].getType(mimeType);
      const text = await blob.text();
      payloads.push({
        itemIndex: i,
        mimeType,
        byteLength: text.length,
        payload: text,
      });
      if (mimeType === 'text/html' && !html) html = text;
      if (mimeType === 'text/plain' && !plain) plain = text;
    }
  }

  return {
    itemCount: items.length,
    allMimeTypes: [...allMimeTypes].sort(),
    payloads,
    html,
    plain,
  };
}

function inferChromiumBehavior(
  syncHtml: string,
  asyncHtml: string,
  expectedHtml: string,
  preventedDefault: boolean,
): { behavior: ChromiumClipboardBehavior; verdict: string } {
  if (!navigator.clipboard?.read) {
    return {
      behavior: 'async-unavailable',
      verdict: 'navigator.clipboard.read unavailable — use Chrome/Edge with clipboard permission',
    };
  }

  if (!asyncHtml && !syncHtml) {
    return {
      behavior: 'async-read-failed',
      verdict: 'Both sync and async HTML empty',
    };
  }

  if (syncHtml === asyncHtml) {
    if (syncHtml === expectedHtml) {
      return {
        behavior: 'unchanged',
        verdict: 'OS clipboard matches handler write byte-for-byte (semantic preserved)',
      };
    }
    return {
      behavior: 'unchanged',
      verdict: 'Sync and async HTML identical but differ from blocksToCopyHtml — check handler path',
    };
  }

  const syncDom = /\bbe-toggle-wrap\b/i.test(syncHtml);
  const asyncDom = /\bbe-toggle-wrap\b/i.test(asyncHtml);
  const expectedSemantic = /<details\b[^>]*class=["'][^"']*btoggle/i.test(expectedHtml);

  if (expectedSemantic && (asyncDom || syncDom)) {
    const source = asyncDom && !syncDom
      ? 'async OS clipboard'
      : syncDom
        ? 'sync clipboardData'
        : 'clipboard';
    return {
      behavior: 'replaced-with-dom',
      verdict: `${source} contains .be-toggle-wrap — browser replaced semantic <details class="btoggle">`,
    };
  }

  if (asyncHtml.includes(syncHtml) || syncHtml.includes(asyncHtml)) {
    return {
      behavior: 'augmented',
      verdict: 'Chromium augmented/wrapped HTML (meta/fragment) — core may still be semantic',
    };
  }

  if (!preventedDefault) {
    return {
      behavior: 'replaced-with-dom',
      verdict: 'preventDefault false — browser wrote selection DOM instead of handler HTML',
    };
  }

  return {
    behavior: 'replaced-other',
    verdict: 'Async HTML differs from sync without DOM wrapper pattern — inspect full dumps',
  };
}

function dumpReport(r: BrowserClipboardReport): void {
  if (!isEditorQaEnabled()) return;
  // eslint-disable-next-line no-console
  console.warn('[UX-3A copy:browser-clipboard]', {
    label: r.label,
    path: r.path,
    preventedDefault: r.preventedDefault,
    chromiumBehavior: r.chromiumBehavior,
    verdict: r.verdict,
    syncMimeTypes: r.syncClipboardData.availableMimeTypes,
    asyncMimeTypes: r.asyncNavigatorClipboard.allMimeTypes,
    syncHtmlVariant: r.syncClipboardData.htmlVariant,
    asyncHtmlVariant: r.asyncNavigatorClipboard.htmlVariant,
    syncHtmlMatchesExpected: r.syncClipboardData.htmlMatchesExpected,
    asyncHtmlMatchesExpected: r.asyncNavigatorClipboard.htmlMatchesExpected,
    asyncHtmlMatchesSync: r.asyncNavigatorClipboard.htmlMatchesSync,
    firstHtmlDiffSyncVsExpected: r.syncClipboardData.firstHtmlDiffVsExpected,
    firstHtmlDiffAsyncVsExpected: r.asyncNavigatorClipboard.firstHtmlDiffVsExpected,
    firstHtmlDiffAsyncVsSync: r.asyncNavigatorClipboard.firstHtmlDiffVsSync,
  });

  for (const p of r.asyncNavigatorClipboard.payloads) {
    // eslint-disable-next-line no-console
    console.warn(
      `[UX-3A copy:browser-clipboard:mime:FULL] item=${p.itemIndex} type=${p.mimeType} bytes=${p.byteLength}`,
      p.payload,
    );
  }

  // eslint-disable-next-line no-console
  console.warn('[UX-3A copy:browser-clipboard:sync-html:FULL]', r.syncClipboardData.html);
  // eslint-disable-next-line no-console
  console.warn('[UX-3A copy:browser-clipboard:async-html:FULL]', r.asyncNavigatorClipboard.html);
  // eslint-disable-next-line no-console
  console.warn('[UX-3A copy:browser-clipboard:expected-html:FULL]', r.expectedHtml);
  // eslint-disable-next-line no-console
  console.warn('[UX-3A copy:browser-clipboard:sync-plain:FULL]', r.syncClipboardData.plain);
  // eslint-disable-next-line no-console
  console.warn('[UX-3A copy:browser-clipboard:async-plain:FULL]', r.asyncNavigatorClipboard.plain);
}

export function captureSyncClipboard(
  e: ClipboardEvent,
  report: CopyTraceReport | null,
  label = 'gutter-toggle-copy',
): BrowserClipboardReport['syncClipboardData'] {
  const expectedHtml = report?.expectedHtml ?? '';
  const html = e.clipboardData?.getData('text/html') ?? '';
  const plain = e.clipboardData?.getData('text/plain') ?? '';
  return {
    availableMimeTypes: listSyncMimeTypes(e),
    html,
    plain,
    htmlVariant: classifyClipboardPayloadVariant(html),
    htmlMatchesExpected: html === expectedHtml,
    firstHtmlDiffVsExpected: firstByteDifference(expectedHtml, html),
  };
}

/** After copy handler: read sync clipboardData, then async navigator.clipboard.read(). */
export function scheduleBrowserClipboardCapture(
  e: ClipboardEvent,
  report: CopyTraceReport | null,
  label = 'gutter-toggle-copy',
): void {
  if (!isEditorQaEnabled()) return;
  const expectedHtml = report?.expectedHtml ?? '';
  const expectedPlain = report?.expectedPlain ?? '';
  const sync = captureSyncClipboard(e, report, label);

  const base: BrowserClipboardReport = {
    label,
    path: report?.path ?? null,
    preventedDefault: report?.preventedDefault ?? false,
    expectedHtml,
    expectedPlain,
    syncClipboardData: sync,
    asyncNavigatorClipboard: {
      available: !!navigator.clipboard?.read,
      itemCount: 0,
      allMimeTypes: [],
      payloads: [],
      html: '',
      plain: '',
      htmlVariant: 'other',
      htmlMatchesExpected: false,
      firstHtmlDiffVsExpected: null,
      htmlMatchesSync: false,
      firstHtmlDiffVsSync: null,
      readError: null,
    },
    chromiumBehavior: 'async-unavailable',
    verdict: '',
  };

  if (!navigator.clipboard?.read) {
    const inferred = inferChromiumBehavior(sync.html, '', expectedHtml, report?.preventedDefault ?? false);
    base.chromiumBehavior = inferred.behavior;
    base.verdict = inferred.verdict;
    lastReport = base;
    dumpReport(base);
    return;
  }

  window.setTimeout(async () => {
    try {
      const asyncRead = await readAllClipboardMimeTypes();
      const asyncBlock: BrowserClipboardReport['asyncNavigatorClipboard'] = {
        available: true,
        itemCount: asyncRead.itemCount,
        allMimeTypes: asyncRead.allMimeTypes,
        payloads: asyncRead.payloads,
        html: asyncRead.html,
        plain: asyncRead.plain,
        htmlVariant: classifyClipboardPayloadVariant(asyncRead.html),
        htmlMatchesExpected: asyncRead.html === expectedHtml,
        firstHtmlDiffVsExpected: firstByteDifference(expectedHtml, asyncRead.html),
        htmlMatchesSync: asyncRead.html === sync.html,
        firstHtmlDiffVsSync: firstByteDifference(sync.html, asyncRead.html),
        readError: null,
      };
      const inferred = inferChromiumBehavior(
        sync.html,
        asyncRead.html,
        expectedHtml,
        report?.preventedDefault ?? false,
      );
      const full: BrowserClipboardReport = {
        ...base,
        asyncNavigatorClipboard: asyncBlock,
        chromiumBehavior: inferred.behavior,
        verdict: inferred.verdict,
      };
      lastReport = full;
      dumpReport(full);
    } catch (err) {
      const asyncBlock: BrowserClipboardReport['asyncNavigatorClipboard'] = {
        ...base.asyncNavigatorClipboard,
        readError: err instanceof Error ? err.message : String(err),
      };
      const full: BrowserClipboardReport = {
        ...base,
        asyncNavigatorClipboard: asyncBlock,
        chromiumBehavior: 'async-read-failed',
        verdict: `navigator.clipboard.read() failed: ${asyncBlock.readError}`,
      };
      lastReport = full;
      dumpReport(full);
    }
  }, 0);
}
