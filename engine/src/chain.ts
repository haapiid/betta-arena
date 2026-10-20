// Chain access: reads, logs, and the creator wallet that claims fees and buys back.

import { createPublicClient, createWalletClient, defineChain, http, parseAbi } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { config } from './config.ts'

export const chain = defineChain({
  id: config.chainId,
  name: config.chainId === 4663 ? 'Robinhood Chain' : `Chain ${config.chainId}`,
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [config.rpcUrl] } },
})

export const pub = createPublicClient({ chain, transport: http(config.rpcUrl) })
export const account = config.key ? privateKeyToAccount(config.key) : null
export const wallet = account ? createWalletClient({ chain, transport: http(config.rpcUrl), account }) : null

export const erc20Abi = parseAbi([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'function balanceOf(address) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function transfer(address to, uint256 amount) returns (bool)',
  // Pons tokens point at their bonding curve
  'function curve() view returns (address)',
])
// the Pons fee escrow holds the creator's share of trading fees, per creator
export const escrowAbi = parseAbi(['function balanceOf(address) view returns (uint256)', 'function claim()'])
// the Pons bonding curve (Family v2): buy with ETH, tokens to `recipient`
export const curveAbi = parseAbi(['function buy(uint256 quoteIn, uint256 minTokensOut, address recipient) payable returns (uint256)'])
