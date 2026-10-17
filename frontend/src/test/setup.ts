import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup, configure } from '@testing-library/react'

// The whole app is rendered in several tests; allow for slow first renders when files run in parallel.
configure({ asyncUtilTimeout: 4000 })

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})
