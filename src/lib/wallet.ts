// Wallet: any injected EIP-1193 wallet (MetaMask, Rabby, Coinbase, ...). Connects, moves the wallet
// to Robinhood Chain, approves $BETTA spending and sends the game's transactions.

import {
  createPublicClient, createWalletClient, custom, http, maxUint256, numberToHex, BaseError, ContractFunctionRevertedError, UserRejectedRequestError,
  type Address, type Hex,
} from 'viem'
import { erc20Abi } from '../chain/abi'
import { chain, NET } from './net'

interface Eip1193 {
  request: (a: { method: string; params?: unknown[] }) => Promise<unknown>
  on?: (ev: string, fn: (...a: unknown[]) => void) => void
  removeListener?: (ev: string, fn: (...a: unknown[]) => void) => void
}
const eth = () => (window as Window & { ethereum?: Eip1193 }).ethereum

export const hasWallet = () => !!eth()
export const publicClient = createPublicClient({ chain, transport: http(NET.rpcUrl) })

export async function connect(): Promise<Address | null> {
  const p = eth()
  if (!p) {
    window.open('https://metamask.io/download/', '_blank', 'noopener')
    return null
  }
  const acc = (await p.request({ method: 'eth_requestAccounts' })) as Address[]
  if (!acc?.[0]) return null
  await ensureChain()
  return acc[0].toLowerCase() as Address
}

/** Switch the wallet to the game's chain, adding it first if the wallet does not know it. */
export async function ensureChain() {
  const p = eth()!
  const want = numberToHex(NET.chainId)
  if ((await p.request({ method: 'eth_chainId' })) === want) return
  try {
    await p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: want }] })
  } catch (e) {
    if ((e as { code?: number }).code !== 4902) throw e
    await p.request({
      method: 'wallet_addEthereumChain',
      params: [{ chainId: want, chainName: NET.name, nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: [NET.rpcUrl], blockExplorerUrls: NET.explorer ? [NET.explorer] : undefined }],
    })
  }
}

export async function disconnect() {
  try {
    await eth()?.request({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] })
  } catch {
    /* not every wallet supports it */
  }
}

export function onAccountsChanged(fn: (a: Address | null) => void) {
  const p = eth()
  const h = (acc: unknown) => fn(((acc as string[])[0]?.toLowerCase() as Address) ?? null)
  p?.on?.('accountsChanged', h)
  return () => p?.removeListener?.('accountsChanged', h)
}

export function walletClient(account: Address) {
  return createWalletClient({ chain, transport: custom(eth()!), account })
}

export async function signMessage(account: Address, message: string) {
  return walletClient(account).signMessage({ message })
}

/** Send a transaction and wait until it is mined. Throws a readable Error. */
export async function send(account: Address, tx: Parameters<ReturnType<typeof walletClient>['writeContract']>[0]): Promise<Hex> {
  await ensureChain()
  try {
    const hash = await walletClient(account).writeContract(tx)
    const r = await publicClient.waitForTransactionReceipt({ hash })
    if (r.status !== 'success') throw new Error('The transaction failed on chain.')
    return hash
  } catch (e) {
    throw new Error(readable(e))
  }
}

/** Make sure `spender` may take `amount` of $BETTA; asks for a one-time approval if not. */
export async function ensureAllowance(account: Address, spender: Address, amount: bigint) {
  const token = NET.contracts.token!
  const have = await publicClient.readContract({ address: token, abi: erc20Abi, functionName: 'allowance', args: [account, spender] })
  if (have >= amount) return
  await send(account, { address: token, abi: erc20Abi, functionName: 'approve', args: [spender, maxUint256], chain, account })
}

export function readable(e: unknown): string {
  if (e instanceof BaseError) {
    if (e.walk((x) => x instanceof UserRejectedRequestError)) return 'You cancelled it in your wallet.'
    const rev = e.walk((x) => x instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null
    const name = rev?.data?.errorName
    if (name) return REVERTS[name] ?? `The contract refused it (${name}).`
    if (/insufficient funds/i.test(e.message)) return 'Not enough ETH for gas on Robinhood Chain.'
    return e.shortMessage
  }
  const m = (e as { message?: string })?.message ?? String(e)
  if ((e as { code?: number })?.code === 4001) return 'You cancelled it in your wallet.'
  return m.split('\n')[0]
}

const REVERTS: Record<string, string> = {
  ERC20InsufficientBalance: 'Not enough $BETTA in your wallet.',
  ERC20InsufficientAllowance: 'The $BETTA approval is too small. Try again.',
  RegistrationClosed: 'Registration for this round is closed.',
  NotCommitted: 'This round is not open yet. Try again in a minute.',
  AlreadyEntered: 'That fish is already entered.',
  TooManyEntries: 'You already have 3 fish in this round.',
  BracketFull: 'This division is full (16 fish).',
  BadSnapshot: 'The entry pass expired. Try again.',
  BadPermit: 'The purchase pass is no longer valid. Try again.',
  Expired: 'The pass expired. Try again.',
  NonceUsed: 'That pass was already used.',
  PriceAboveMax: 'The price changed. Check it and try again.',
  NotForSale: 'That is not for sale right now.',
  EnforcedPause: 'The game is paused for maintenance. Try again soon.',
  NotFishOwner: 'That fish is not in your wallet.',
}

export const short = (a: string) => (a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a)
