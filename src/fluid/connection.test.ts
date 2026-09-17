import { InsecureTokenProvider } from '@fluidframework/test-runtime-utils/internal'
import { describe, expect, it } from 'vitest'
import { connectionConfigFromEnv } from './connection'

const user = { id: 'user-1', name: 'Alice' }

const azureEnv = {
  VITE_FLUID_CLIENT: 'azure',
  VITE_FLUID_TENANT_ID: 'tenant-123',
  VITE_FLUID_ENDPOINT: 'https://us.fluidrelay.azure.com',
  VITE_FLUID_TENANT_KEY: 'secret-key',
}

/** Reads the claims out of a JWT without verifying it. */
function claimsOf(jwt: string): { tenantId: string; documentId: string; user: { id: string; name: string } } {
  const payload = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
  return JSON.parse(atob(payload))
}

describe('connectionConfigFromEnv', () => {
  it('connects to local tinylicious when nothing is configured', () => {
    const config = connectionConfigFromEnv({}, user)
    expect(config.type).toBe('local')
    expect(config.endpoint).toBe('http://localhost:7070')
    expect(config.tokenProvider).toBeInstanceOf(InsecureTokenProvider)
  })

  it('stays local when the client is anything other than azure', () => {
    const config = connectionConfigFromEnv({ ...azureEnv, VITE_FLUID_CLIENT: 'tinylicious' }, user)
    expect(config.type).toBe('local')
  })

  it('connects to Azure Fluid Relay with the configured tenant and endpoint', () => {
    const config = connectionConfigFromEnv(azureEnv, user)
    expect(config.type).toBe('remote')
    if (config.type !== 'remote') throw new Error('expected remote')
    expect(config.tenantId).toBe('tenant-123')
    expect(config.endpoint).toBe('https://us.fluidrelay.azure.com')
    expect(config.tokenProvider).toBeInstanceOf(InsecureTokenProvider)
  })

  it.each(['VITE_FLUID_TENANT_ID', 'VITE_FLUID_ENDPOINT', 'VITE_FLUID_TENANT_KEY'])(
    'names %s when azure mode is missing it',
    (missing) => {
      const env = { ...azureEnv, [missing]: undefined }
      expect(() => connectionConfigFromEnv(env, user)).toThrow(missing)
    },
  )

  it('puts the user in the tokens it signs', async () => {
    const config = connectionConfigFromEnv(azureEnv, user)
    const { jwt } = await config.tokenProvider.fetchOrdererToken('tenant-123', 'doc-1')
    const claims = claimsOf(jwt)
    expect(claims.user).toEqual({ id: 'user-1', name: 'Alice' })
    expect(claims.tenantId).toBe('tenant-123')
    expect(claims.documentId).toBe('doc-1')
  })
})
