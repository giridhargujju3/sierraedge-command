import test from 'node:test';
import assert from 'node:assert/strict';

import { createInviteUrl, getInviteDeliveryMessage, isValidEmail, normalizeEmail } from './invite.ts';

test('normalizeEmail trims and lowercases valid Gmail addresses', () => {
  assert.equal(normalizeEmail('  User.Name+tag@GMAIL.com  '), 'user.name+tag@gmail.com');
});

test('isValidEmail only accepts Gmail addresses', () => {
  assert.equal(isValidEmail('operator@gmail.com'), true);
  assert.equal(isValidEmail('operator@outlook.com'), false);
  assert.equal(isValidEmail('not-an-email'), false);
});

test('createInviteUrl generates a valid accept-invite URL', () => {
  assert.equal(
    createInviteUrl('https://example.com', 'abc123'),
    'https://example.com/accept-invite?token=abc123',
  );
});

test('reports SMTP failures for email invite delivery', () => {
  assert.equal(
    getInviteDeliveryMessage({ ok: false, delivered: false, reason: 'SMTP send failed', error: '535 5.7.8 Username and Password not accepted' }),
    '535 5.7.8 Username and Password not accepted',
  );
  assert.equal(getInviteDeliveryMessage({ ok: true, delivered: true }), '');
});
