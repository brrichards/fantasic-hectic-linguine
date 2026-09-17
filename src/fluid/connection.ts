import type { AzureLocalConnectionConfig, AzureRemoteConnectionConfig } from '@fluidframework/azure-client'
// The example apps import this internal entry the same way; see #26985 upstream.
import { InsecureTokenProvider } from '@fluidframework/test-runtime-utils/internal'

/** The environment variables the connection reads, as Vite exposes them. */
export type FluidEnv = Record<string, string | undefined>

/** Who this client is, as stamped into every token it sends. */
export interface TokenUser {
  id: string
  name: string
}

export type ConnectionConfig = AzureRemoteConnectionConfig | AzureLocalConnectionConfig

const LOCAL_ENDPOINT = 'http://localhost:7070'

function required(env: FluidEnv, name: string): string {
  const value = env[name]
  if (!value) throw new Error(`Azure mode needs ${name} to be set`)
  return value
}

/**
 * Builds the connection for the Fluid client from the environment. Local
 * tinylicious is the default. Setting VITE_FLUID_CLIENT=azure switches to
 * Azure Fluid Relay with the tenant, endpoint, and key from the environment.
 * In both modes the tokens are signed on the client, which is fine locally
 * and only suitable for trying the relay out.
 */
export function connectionConfigFromEnv(env: FluidEnv, user: TokenUser): ConnectionConfig {
  if (env.VITE_FLUID_CLIENT !== 'azure') {
    return {
      type: 'local',
      endpoint: LOCAL_ENDPOINT,
      tokenProvider: new InsecureTokenProvider('local', user),
    }
  }
  return {
    type: 'remote',
    tenantId: required(env, 'VITE_FLUID_TENANT_ID'),
    endpoint: required(env, 'VITE_FLUID_ENDPOINT'),
    tokenProvider: new InsecureTokenProvider(required(env, 'VITE_FLUID_TENANT_KEY'), user),
  }
}
