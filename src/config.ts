// Settings shared by the browser (Vite env) and the server (process.env).

type Env = Record<string, string | undefined>
const viteEnv: Env = (import.meta as { env?: Env }).env ?? {}
const nodeEnv: Env = (globalThis as { process?: { env?: Env } }).process?.env ?? {}

export function env(key: string): string | undefined {
  const v = viteEnv[key] ?? nodeEnv[key]
  return v === '' ? undefined : v
}
