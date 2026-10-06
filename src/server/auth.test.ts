import { describe, expect, it } from 'vitest';
import { authorizeCommand } from './auth';

describe('authorizeCommand', () => {
  it('allows everything when no token is configured', () => {
    expect(authorizeCommand('start', null, undefined).ok).toBe(true);
    expect(authorizeCommand('start', null, '').ok).toBe(true);
  });

  it('rejects commands without or with a wrong token', () => {
    expect(authorizeCommand('start', null, 's3cret')).toMatchObject({ ok: false, status: 401 });
    expect(authorizeCommand('start', 'Bearer nope', 's3cret').ok).toBe(false);
    expect(authorizeCommand('start', 'Bearer s3cre', 's3cret').ok).toBe(false);
    expect(authorizeCommand('start', 's3cret', 's3cret').ok).toBe(false); // missing scheme
  });

  it('accepts the right token (scheme is case-insensitive)', () => {
    expect(authorizeCommand('set_valve', 'Bearer s3cret', 's3cret').ok).toBe(true);
    expect(authorizeCommand('set_valve', 'bearer s3cret', 's3cret').ok).toBe(true);
  });

  it('never blocks E-STOP', () => {
    expect(authorizeCommand('estop', null, 's3cret').ok).toBe(true);
    expect(authorizeCommand('estop', 'Bearer wrong', 's3cret').ok).toBe(true);
  });
});
