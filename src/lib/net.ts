// Which chain, contracts and game server the web app talks to (set in .env, see .env.example).

import { defineChain, getAddress, isAddress, type Address } from 'viem'

const env = import.meta.env
const addr = (v: string | undefined): Address | null => (v && isAddress(v) ? getAddress(v) : null)

export const CHAIN_ID = Number(env.VITE_CHAIN_ID || 4663)
const KNOWN: Record<number, { name: string; rpc: string; explorer: string }> = {
  4663: { name: 'Robinhood Chain', rpc: 'https://rpc.mainnet.chain.robinhood.com', explorer: 'https://robinhoodchain.blockscout.com' },
  46630: { name: 'Robinhood Chain Testnet', rpc: 'https://rpc.testnet.chain.robinhood.com', explorer: '' },
  31337: { name: 'Local Hardhat', rpc: 'http://127.0.0.1:8545', explorer: '' },
}
const known = KNOWN[CHAIN_ID] ?? { name: `Chain ${CHAIN_ID}`, rpc: '', explorer: '' }

export const NET = {
  chainId: CHAIN_ID,
  name: env.VITE_CHAIN_NAME || known.name,
  rpcUrl: env.VITE_RPC_URL || known.rpc,
  explorer: (env.VITE_EXPLORER_URL || known.explorer).replace(/\/$/, ''),
  api: (env.VITE_API_URL || 'http://localhost:8787').replace(/\/$/, ''),
  contracts: {
    token: addr(env.VITE_TOKEN_ADDRESS),
    fish: addr(env.VITE_FISH_ADDRESS),
    shop: addr(env.VITE_SHOP_ADDRESS),
    arena: addr(env.VITE_ARENA_ADDRESS),
  },
}

// the game only works once all four contracts are configured
export const LIVE = Object.values(NET.contracts).every(Boolean)

export const chain = defineChain({
  id: NET.chainId,
  name: NET.name,
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [NET.rpcUrl] } },
  blockExplorers: NET.explorer ? { default: { name: 'Explorer', url: NET.explorer } } : undefined,
})

export const txUrl = (hash: string) => (NET.explorer ? `${NET.explorer}/tx/${hash}` : '')
export const addressUrl = (a: string) => (NET.explorer ? `${NET.explorer}/address/${a}` : '')
