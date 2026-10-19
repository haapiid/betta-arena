// Chain access: a public client for reads and logs, the signer key for EIP-712 permits and
// snapshots, and the operator wallet that commits, reveals and settles rounds.

import { createPublicClient, createWalletClient, defineChain, getContract, http, formatUnits, parseUnits } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { bettaArenaAbi, bettaFishAbi, bettaShopAbi, erc20Abi } from '../../src/chain/abi.ts'
import { ENV } from './env.ts'

export const chain = defineChain({
  id: ENV.chainId,
  name: ENV.chainId === 4663 ? 'Robinhood Chain' : ENV.chainId === 46630 ? 'Robinhood Chain Testnet' : `Chain ${ENV.chainId}`,
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [ENV.rpcUrl] } },
})

export const publicClient = createPublicClient({ chain, transport: http(ENV.rpcUrl) })
export const signer = privateKeyToAccount(ENV.signerKey)
export const operator = createWalletClient({ chain, transport: http(ENV.rpcUrl), account: privateKeyToAccount(ENV.operatorKey) })

export const arena = getContract({ address: ENV.arena, abi: bettaArenaAbi, client: { public: publicClient, wallet: operator } })
export const shop = getContract({ address: ENV.shop, abi: bettaShopAbi, client: publicClient })
export const fish = getContract({ address: ENV.fish, abi: bettaFishAbi, client: publicClient })
export const token = getContract({ address: ENV.token, abi: erc20Abi, client: publicClient })

let decimals = 18
export async function loadDecimals() {
  decimals = Number(await token.read.decimals())
  return decimals
}
// amounts shown in the game are whole tokens (fees and prices are whole numbers)
export const toTokens = (wei: bigint) => Number(formatUnits(wei, decimals))
export const toWei = (tokens: number) => parseUnits(String(tokens), decimals)

const blockTimes = new Map<bigint, number>()
export async function blockTime(n: bigint): Promise<number> {
  let t = blockTimes.get(n)
  if (t === undefined) {
    t = Number((await publicClient.getBlock({ blockNumber: n })).timestamp) * 1000
    blockTimes.set(n, t)
    if (blockTimes.size > 500) blockTimes.delete(blockTimes.keys().next().value!)
  }
  return t
}

// the chain's clock; a quiet chain can go a while without a block, so never fall behind wall time
export async function chainNow(): Promise<number> {
  return Math.max(Number((await publicClient.getBlock()).timestamp) * 1000, Date.now())
}
