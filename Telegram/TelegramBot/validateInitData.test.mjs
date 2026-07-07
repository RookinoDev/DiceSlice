import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { validateInitData } from './validateInitData.mjs'

const BOT_TOKEN = 'test-bot-token-123'

function buildInitData(fields, botToken = BOT_TOKEN) {
  const params = new URLSearchParams(fields)
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest()
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')
  params.set('hash', hash)
  return params.toString()
}

test('accepts a correctly signed initData and extracts the user id', () => {
  const initData = buildInitData({ auth_date: '1700000000', query_id: 'abc', user: JSON.stringify({ id: 999888, first_name: 'Test' }) })
  const result = validateInitData(initData, BOT_TOKEN)
  assert.equal(result.valid, true)
  assert.equal(result.userId, 999888)
})

test('rejects initData tampered with after signing', () => {
  const initData = buildInitData({ auth_date: '1700000000', user: JSON.stringify({ id: 999888 }) })
  const tampered = initData.replace('999888', '111111')
  const result = validateInitData(tampered, BOT_TOKEN)
  assert.equal(result.valid, false)
})

test('rejects initData signed with a different bot token', () => {
  const initData = buildInitData({ auth_date: '1700000000', user: JSON.stringify({ id: 999888 }) }, 'a-different-token')
  const result = validateInitData(initData, BOT_TOKEN)
  assert.equal(result.valid, false)
})

test('rejects missing hash or missing user field', () => {
  assert.equal(validateInitData('auth_date=1700000000', BOT_TOKEN).valid, false)
  assert.equal(validateInitData('', BOT_TOKEN).valid, false)
  assert.equal(validateInitData(null, BOT_TOKEN).valid, false)
})
