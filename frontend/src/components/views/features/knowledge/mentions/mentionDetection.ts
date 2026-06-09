import { normalizeWikiTitle } from '../../../noteUtils';

/** Remove wiki link regions so plain-text mention scan ignores [[...]] */
export function bodyTextWithoutWikiLinks(body: string): string {
  return body.replace(/\[\[(.+?)\]\]/g, ' ');
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Word boundary — ASCII word chars + Hangul */
const WORD_BEFORE = '(?<![\\w\\uAC00-\\uD7A3])';
const WORD_AFTER = '(?![\\w\\uAC00-\\uD7A3])';

/** Build whole-word, case-insensitive regex for an exact title match */
export function buildTitleMentionRegex(title: string): RegExp {
  return new RegExp(
    `${WORD_BEFORE}${escapeRegExp(title.trim())}${WORD_AFTER}`,
    'i',
  );
}

/** Whether plain text contains a whole-word mention of title (wiki links stripped) */
export function containsWholeWordMention(body: string, title: string): boolean {
  const trimmed = title.trim();
  if (!trimmed) return false;
  return buildTitleMentionRegex(trimmed).test(bodyTextWithoutWikiLinks(body));
}

/** Unlinked mention: title in plain text, not covered by an existing [[title]] link */
export function hasUnlinkedMention(body: string, targetTitle: string): boolean {
  return containsWholeWordMention(body, targetTitle);
}

/** Find the matched mention token in text for excerpt highlighting */
export function findMentionInText(text: string, targetTitle: string): string | null {
  const trimmed = targetTitle.trim();
  if (!trimmed) return null;
  const match = text.match(buildTitleMentionRegex(trimmed));
  return match ? match[0] : null;
}

/** Whether body already has [[targetTitle]] wiki link (backlink, not mention) */
export function bodyHasWikiLinkToTitle(body: string, targetTitle: string): boolean {
  const key = normalizeWikiTitle(targetTitle);
  if (!key) return false;
  const re = /\[\[(.+?)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    if (normalizeWikiTitle(m[1]) === key) return true;
  }
  return false;
}
