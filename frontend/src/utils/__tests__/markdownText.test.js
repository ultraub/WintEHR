import { looksLikeMarkdown, stripMarkdown } from '../markdownText';

describe('markdownText', () => {
  test('detects markdown structure, not plain prose', () => {
    expect(looksLikeMarkdown('# Chief Complaint\nNo complaints.')).toBe(true);
    expect(looksLikeMarkdown('**Patient**: Jane')).toBe(true);
    expect(looksLikeMarkdown('- one\n- two')).toBe(true);
    expect(looksLikeMarkdown('Patient seen today. BP 120/80 * 2 readings.')).toBe(false);
    expect(looksLikeMarkdown(undefined)).toBe(false);
  });

  test('strips syntax into readable preview text', () => {
    expect(stripMarkdown('# Chief Complaint\nNo complaints.')).toBe('Chief Complaint:\nNo complaints.');
    expect(stripMarkdown('**Patient**: Jane, *stable*')).toBe('Patient: Jane, stable');
    expect(stripMarkdown('- a\n- b')).toBe('• a\n• b');
    expect(stripMarkdown('see [guide](http://x.test)')).toBe('see guide');
    expect(stripMarkdown(null)).toBe('');
  });
});
