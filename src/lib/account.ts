// The connected wallet: read-only. The site only asks for the address (to find your fish, your jar and
// your place on the shelf). It never asks for a signature or a transaction; buying happens on Pons.

import { useEffect, useState } from 'react'

type Eth = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown>; on?: (e: string, f: (a: unknown) => void) => void; removeListener?: (e: string, f: (a: unknown) => void) => void }
const eth = () => (window as Window & { ethereum?: Eth }).ethereum
const KEY = 'betta-arena:account'
const EVENT = 'betta:account'

function saved() {
  try {
    const a = localStorage.getItem(KEY)
    return a && /^0x[0-9a-f]{40}$/.test(a) ? a : null
  } catch {
    return null
  }
}
function set(a: string | null) {
  try {
    if (a) localStorage.setItem(KEY, a)
    else localStorage.removeItem(KEY)
  } catch {
    /* private mode: it lasts until the tab closes */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: a }))
}

export const hasWallet = () => !!eth()

/** Ask the wallet for its address. Returns an error message, or null when connected. */
export async function connectWallet(): Promise<string | null> {
  const p = eth()
  if (!p) return 'No wallet found in this browser. Install MetaMask or Rabby, or paste an address in Your jar.'
  try {
    const acc = (await p.request({ method: 'eth_requestAccounts' })) as string[]
    if (!acc?.[0]) return 'The wallet did not share an address.'
    set(acc[0].toLowerCase())
    return null
  } catch {
    return 'The wallet did not share an address.'
  }
}

export function disconnectWallet() {
  set(null)
  void eth()?.request({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] }).catch(() => {})
}

/** The connected address (lower case), shared by every component. */
export function useAccount() {
  const [addr, setAddr] = useState<string | null>(saved)
  useEffect(() => {
    const on = (e: Event) => setAddr((e as CustomEvent<string | null>).detail)
    window.addEventListener(EVENT, on)
    // switching accounts in the wallet follows along; locking the wallet keeps the last address
    const p = eth()
    const changed = (a: unknown) => {
      const next = (a as string[])?.[0]?.toLowerCase()
      if (next && saved()) set(next)
    }
    p?.on?.('accountsChanged', changed)
    return () => {
      window.removeEventListener(EVENT, on)
      p?.removeListener?.('accountsChanged', changed)
    }
  }, [])
  return addr
}
