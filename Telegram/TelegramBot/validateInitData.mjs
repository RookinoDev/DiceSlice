import { createHmac } from 'node:crypto'

/**
 * Validates Telegram Mini App initData per Telegram's documented algorithm:
 *   secret_key = HMAC_SHA256(key="WebAppData", data=botToken)
 *   data_check_string = sorted "key=value" pairs (excluding hash), joined by "\n"
 *   expected_hash = HMAC_SHA256(key=secret_key, data=data_check_string)
 * Never trust initDataUnsafe from the client - this is the only trustworthy source of
 * the Telegram user id on the server.
 */
export function validateInitData(initData, botToken) {
  if (!initData || !botToken) return { valid: false }

  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) return { valid: false }
  params.delete('hash')

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest()
  const expectedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  if (expectedHash !== hash) return { valid: false }

  const userJson = params.get('user')
  if (!userJson) return { valid: false }

  try {
    const user = JSON.parse(userJson)
    return { valid: true, userId: user.id }
  } catch {
    return { valid: false }
  }
}
