// Sign-In With Ethereum: the wallet signs a one-time message (no gas), the server checks it and
// hands back a session token. Care actions and permits require that token.

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { parseSiweMessage, validateSiweMessage } from 'viem/siwe'
import type { Address, Hex } from 'viem'
import { publicClient } from './chain.ts'
import { ENV } from './env.ts'

const NONCE_TTL = 10 * 60_000
const SESSION_TTL = 7 * 86_400_000
const nonces = new Map<string, number>()

export function newNonce() {
  const n = randomBytes(16).toString('hex')
  nonces.set(n, Date.now() + NONCE_TTL)
  if (nonces.size > 50_000) for (const [k, exp] of nonces) if (exp < Date.now()) nonces.delete(k)
  return n
}

const b64 = (s: string) => Buffer.from(s).toString('base64url')
const sign = (payload: string) => createHmac('sha256', ENV.sessionSecret).update(payload).digest('base64url')

export async function verifyLogin(message: string, signature: Hex): Promise<{ token: string; address: Address } | { error: string }> {
  const m = parseSiweMessage(message)
  if (!m.nonce || !m.address || !m.domain) return { error: 'Malformed sign-in message.' }
  const exp = nonces.get(m.nonce)
  if (!exp || exp < Date.now()) return { error: 'Sign-in expired. Try again.' }
  const allowedHosts = ENV.allowedOrigins.map((o) => new URL(o).host)
  if (!allowedHosts.includes(m.domain)) return { error: 'Sign-in message is for another site.' }
  if (m.chainId !== ENV.chainId) return { error: 'Wrong network in the sign-in message.' }
  if (!validateSiweMessage({ message: m, domain: m.domain, nonce: m.nonce })) return { error: 'Sign-in message is not valid now.' }
  // works for normal wallets and smart-contract wallets (EIP-1271)
  const ok = await publicClient.verifySiweMessage({ message, signature, domain: m.domain, nonce: m.nonce })
  if (!ok) return { error: 'Signature does not match.' }
  nonces.delete(m.nonce)
  const payload = b64(JSON.stringify({ a: m.address.toLowerCase(), e: Date.now() + SESSION_TTL }))
  return { token: `${payload}.${sign(payload)}`, address: m.address }
}

export function sessionAddress(header: string | undefined): string | null {
  const tok = header?.startsWith('Bearer ') ? header.slice(7) : null
  if (!tok) return null
  const [payload, mac] = tok.split('.')
  if (!payload || !mac) return null
  const want = Buffer.from(sign(payload))
  const got = Buffer.from(mac)
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null
  try {
    const { a, e } = JSON.parse(Buffer.from(payload, 'base64url').toString())
    return typeof a === 'string' && e > Date.now() ? a : null
  } catch {
    return null
  }
}
