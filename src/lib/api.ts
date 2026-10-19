// Game server client. A session comes from Sign-In With Ethereum (one signature, no gas) and is
// kept in this browser per wallet.

import { createSiweMessage } from 'viem/siwe'
import type { Address } from 'viem'
import { NET } from './net'
import { signMessage } from './wallet'

const key = (a: string) => `betta-arena:session:${a.toLowerCase()}`
// fallback when localStorage is blocked
const memo = new Map<string, string>()
function session(a: string) {
  try {
    return localStorage.getItem(key(a)) ?? memo.get(a.toLowerCase()) ?? null
  } catch {
    return memo.get(a.toLowerCase()) ?? null
  }
}

export class ApiError extends Error {
  constructor(msg: string, readonly status: number) {
    super(msg)
  }
}

export async function api<T = unknown>(path: string, opts: { body?: unknown; as?: string } = {}): Promise<T> {
  const tok = opts.as ? session(opts.as) : null
  let r: Response
  try {
    r = await fetch(NET.api + path, {
      method: opts.body === undefined ? 'GET' : 'POST',
      headers: { 'content-type': 'application/json', ...(tok ? { authorization: `Bearer ${tok}` } : {}) },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    })
  } catch {
    throw new ApiError('The game server is unreachable. Check your connection.', 0)
  }
  const j = await r.json().catch(() => ({}))
  if (!r.ok) {
    if (r.status === 401 && opts.as) clearSession(opts.as)
    throw new ApiError(j.msg ?? `Server error (${r.status}).`, r.status)
  }
  return j as T
}

export const hasSession = (a: string) => !!session(a)
export function clearSession(a: string) {
  memo.delete(a.toLowerCase())
  try {
    localStorage.removeItem(key(a))
  } catch {
    /* ignore */
  }
}

/** Ask the wallet to sign the sign-in message and store the session. */
export async function signIn(address: Address) {
  const { nonce } = await api<{ nonce: string }>('/api/auth/nonce', { body: {} })
  const message = createSiweMessage({
    address,
    chainId: NET.chainId,
    domain: window.location.host,
    uri: window.location.origin,
    nonce,
    version: '1',
    statement: 'Sign in to Betta Arena. This signature costs nothing and does not move any funds.',
  })
  const signature = await signMessage(address, message)
  const r = await api<{ token: string }>('/api/auth/verify', { body: { message, signature } })
  try {
    localStorage.setItem(key(address), r.token)
  } catch {
    /* private mode: the session lasts until the tab closes */
  }
  memo.set(address.toLowerCase(), r.token)
  return r.token
}
