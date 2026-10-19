// Minimal Ethereum wallet connection, no library: any injected EIP-1193 wallet (MetaMask, Rabby, Coinbase, ...).
// The wallet is the player's identity; progress is saved per address.

interface EthProvider {
  request: (a: { method: string; params?: unknown[] }) => Promise<unknown>
}

type W = Window & { ethereum?: EthProvider }

// Chain the game runs on (1 = Ethereum mainnet, 11155111 = Sepolia). Set VITE_CHAIN_ID in .env.
export const CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID || 1)
const CHAIN_HEX = `0x${CHAIN_ID.toString(16)}`

export const hasWallet = () => !!(window as W).ethereum

export async function connect(): Promise<string | null> {
  const eth = (window as W).ethereum
  if (!eth) {
    window.open('https://metamask.io/download/', '_blank', 'noopener')
    return null
  }
  try {
    const acc = (await eth.request({ method: 'eth_requestAccounts' })) as string[]
    if (!acc?.[0]) return null
    try {
      if ((await eth.request({ method: 'eth_chainId' })) !== CHAIN_HEX)
        await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_HEX }] })
    } catch (e) {
      console.warn('chain switch declined', e)
    }
    // lowercase so the same address always maps to the same save
    return acc[0].toLowerCase()
  } catch (e) {
    console.error('wallet connect failed', e)
    return null
  }
}

export async function disconnect() {
  try {
    // supported by MetaMask; other wallets simply ignore it
    await (window as W).ethereum?.request({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] })
  } catch {
    /* ignore */
  }
}

export const short = (a: string) => (a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a)
