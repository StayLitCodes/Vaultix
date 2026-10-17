import { escapeHtml } from './escape';

describe('escapeHtml', () => {
  it('escapes strings', () => {
    expect(escapeHtml('<b>&"\'</b>')).toBe(
      '&lt;b&gt;&amp;&quot;&#39;&lt;/b&gt;',
    );
  });

  it('preserves numbers', () => {
    expect(escapeHtml(1500)).toBe('1500');
    expect(escapeHtml(0)).toBe('0');
  });

  it('preserves booleans', () => {
    expect(escapeHtml(true)).toBe('true');
    expect(escapeHtml(false)).toBe('false');
  });

  it('preserves bigint', () => {
    expect(escapeHtml(BigInt(9007199254740991))).toBe('9007199254740991');
  });

  it('handles symbols', () => {
    expect(escapeHtml(Symbol('vaultix'))).toBe('Symbol(vaultix)');
  });

  it('returns empty output for null', () => {
    expect(escapeHtml(null)).toBe('');
  });

  it('returns empty output for undefined', () => {
    expect(escapeHtml(undefined)).toBe('');
  });

  it('returns empty output for objects', () => {
    expect(escapeHtml({ toString: () => 'evil' })).toBe('');
    expect(escapeHtml(['a', 'b'])).toBe('');
  });

  it('returns empty output for functions', () => {
    expect(escapeHtml(() => 'evil')).toBe('');
  });
});
