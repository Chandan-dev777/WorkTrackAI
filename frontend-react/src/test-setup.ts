import '@testing-library/jest-dom'
import { beforeAll, afterEach, afterAll, vi } from 'vitest'
import { server } from './mocks/server'

// canvas-confetti uses rAF + canvas APIs unavailable in jsdom — stub it out
vi.mock('canvas-confetti', () => ({ default: vi.fn() }))

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
