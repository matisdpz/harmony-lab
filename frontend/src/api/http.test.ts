import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, request } from './http'

function mockFetch(impl: () => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(impl))
}

afterEach(() => vi.unstubAllGlobals())

describe('request', () => {
  it('returns parsed JSON for successful responses', async () => {
    mockFetch(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))
    await expect(request('GET', '/api/x')).resolves.toEqual({ ok: true })
  })

  it('turns problem details into an ApiError with field errors', async () => {
    mockFetch(async () => new Response(JSON.stringify({
      title: 'Validation failed', status: 400, detail: 'chords[0].voicing: is required',
      errors: [{ field: 'chords[0].voicing', message: 'is required' }],
    }), { status: 400, headers: { 'Content-Type': 'application/problem+json' } }))
    const error = await request('POST', '/api/projects', {}).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(400)
    expect((error as ApiError).fieldErrors[0].field).toBe('chords[0].voicing')
    expect((error as ApiError).userMessage).toBe('is required')
  })

  it('reports an unreachable server clearly', async () => {
    mockFetch(async () => {
      throw new TypeError('Failed to fetch')
    })
    const error = await request('GET', '/api/projects').catch((e: unknown) => e) as ApiError
    expect(error.isNetworkError).toBe(true)
    expect(error.message).toContain('Cannot reach the Harmony Lab server')
  })

  it('handles empty and non-JSON error bodies', async () => {
    mockFetch(async () => new Response('<html>Bad gateway</html>', { status: 502 }))
    const error = await request('GET', '/api/projects').catch((e: unknown) => e) as ApiError
    expect(error.status).toBe(502)
    expect(error.message).toContain('server had a problem')
  })

  it('returns undefined for 204 No Content', async () => {
    mockFetch(async () => new Response(null, { status: 204 }))
    await expect(request('DELETE', '/api/projects/1')).resolves.toBeUndefined()
  })
})
