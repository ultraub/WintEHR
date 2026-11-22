/**
 * Helpers for text that may or may not be markdown (clinical note bodies come
 * from Synthea as markdown, from the note editor as plain text).
 */

const MARKDOWN_HINT = /(^|\n)\s{0,3}(#{1,6}\s|[-*+]\s|\d+\.\s|>\s)|\*\*[^*\n]+\*\*|__[^_\n]+__/;

/** True when the text carries markdown structure worth rendering. */
export const looksLikeMarkdown = (text) => typeof text === 'string' && MARKDOWN_HINT.test(text);

/**
 * Markdown reduced to readable plain text, for clamped one- or two-line
 * previews where rendered headings and lists would not fit.
 */
export const stripMarkdown = (text) => {
  if (typeof text !== 'string') return '';
  return text
    .replace(/^\s{0,3}#{1,6}\s+(.*)$/gm, '$1:')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s{0,3}[-*+]\s+/gm, '• ')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(^|[\s(])([*_])([^*_\n]+)\2(?=[\s).,;:!?]|$)/g, '$1$3')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/:{2,}/g, ':')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};
