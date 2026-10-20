// Engine settings, from the environment (see engine/.env.example).
import { getAddress, isAddress, type Address, type Hex } from 'viem'

const opt = (k: string, d = '') => (process.env[k] ?? d).trim()
const addr = (v: string): Address | null => (v && isAddress(v) ? getAddress(v) : null)
const list = (v: string) => v.split(',').map((s) => addr(s.trim())).filter((a): a is Address => !!a)

export const config = {
  port: Number(opt('PORT', '5050')),
  rpcUrl: opt('RPC_URL', 'https://rpc.mainnet.chain.robinhood.com'),
  chainId: Number(opt('CHAIN_ID', '4663')),
  dataDir: opt('DATA_DIR', './data'),
  // empty = standby: the site shows the pre-launch state and nothing is indexed or bought
  token: addr(opt('TOKEN_ADDRESS')),
  // the creator wallet: it launched the token on Pons, so the fee escrow pays it. Keep a little ETH on it for gas.
  key: (opt('ENGINE_KEY') || undefined) as Hex | undefined,
  startBlock: opt('START_BLOCK') ? BigInt(opt('START_BLOCK')) : null,
  pollSeconds: Number(opt('POLL_SECONDS', '4')),
  // a buyback starts when the fee escrow holds at least this much
  buybackStepEth: opt('BUYBACK_STEP_ETH', '0.02'),
  gasBufferEth: opt('GAS_BUFFER_ETH', '0.0008'),
  slippageBps: Number(opt('SLIPPAGE_BPS', '300')),
  // smallest buy that throws a betta into the ring (dust buys can't farm fights)
  fightMinTokens: opt('FIGHT_MIN_TOKENS', '10000'),
  shelfSize: Number(opt('SHELF_SIZE', '10')),
  shelfMinTokens: opt('SHELF_MIN_TOKENS', '0'),
  // addresses that are never holders (team, treasury, CEX...) and extra places where selling happens (pools)
  exclude: list(opt('EXCLUDE')),
  sellSinks: list(opt('SELL_SINKS')),
  ponsEscrow: getAddress(opt('PONS_FEE_ESCROW', '0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e')),
  v4Router: getAddress(opt('UNISWAP_ROUTER_ADDRESS', '0x8876789976dEcBfCbBbe364623C63652db8C0904')),
  // the site's public address (https://...), for the absolute links in link previews
  siteUrl: opt('SITE_URL', 'http://localhost:3110').replace(/\/$/, ''),
  allowedOrigins: opt('ALLOWED_ORIGINS', 'http://localhost:3110').split(',').map((s) => s.trim()),
}

export const DEAD = '0x000000000000000000000000000000000000dEaD' as Address
export const ZERO = '0x0000000000000000000000000000000000000000' as Address
