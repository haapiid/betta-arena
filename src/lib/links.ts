// Community links. Fill them in .env (VITE_LINK_*); an empty link shows as "Coming soon".

const env = import.meta.env

// only plain https links make it onto the page (no javascript:, data: or http: by mistake)
function safeUrl(v: string | undefined) {
  const s = (v ?? '').trim()
  if (!s) return ''
  try {
    if (new URL(s).protocol === 'https:') return s
  } catch {
    /* not a URL */
  }
  console.warn(`Ignoring community link that is not https: ${s}`)
  return ''
}

export const LINKS = {
  x: safeUrl(env.VITE_LINK_X),
  telegram: safeUrl(env.VITE_LINK_TELEGRAM),
  discord: safeUrl(env.VITE_LINK_DISCORD),
  dexscreener: safeUrl(env.VITE_LINK_DEXSCREENER),
  buy: safeUrl(env.VITE_LINK_BUY),
  docs: safeUrl(env.VITE_LINK_DOCS),
}

// ERC-20 contract address. Anything that is not a 0x + 40 hex address (a typo, an old Solana
// address) is hidden rather than shown to people who might send funds to it.
const rawToken = (env.VITE_TOKEN_ADDRESS || '').trim()
export const TOKEN_ADDRESS: string = /^0x[0-9a-fA-F]{40}$/.test(rawToken) ? rawToken : ''
if (rawToken && !TOKEN_ADDRESS) console.warn(`VITE_TOKEN_ADDRESS is not a valid Ethereum address: ${rawToken}`)
