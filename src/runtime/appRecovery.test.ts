import { afterEach, describe, expect, it, vi } from 'vitest'
import { isRecoverableChunkError, markClientStable } from './appRecovery'

describe('application recovery', () => {
  afterEach(() => {
    vi.useRealTimers()
    window.history.replaceState({}, '', '/')
  })

  it.each([
    new TypeError('Failed to fetch dynamically imported module'),
    new Error('Loading chunk 42 failed'),
    new Error('ChunkLoadError'),
    'Importing a module script failed',
  ])('recognizes stale deployment chunks', (error) => {
    expect(isRecoverableChunkError(error)).toBe(true)
  })

  it('does not clear caches for an ordinary render bug', () => {
    expect(isRecoverableChunkError(new Error('Cannot read properties of undefined'))).toBe(false)
  })

  it('removes one-time recovery parameters after the client stays stable', () => {
    vi.useFakeTimers()
    window.history.replaceState({}, '', '/?vexor-reload=123&keep=yes')

    markClientStable(10)
    vi.advanceTimersByTime(10)

    expect(window.location.search).toBe('?keep=yes')
  })
})
