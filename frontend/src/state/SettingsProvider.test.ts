import { applyTheme } from './SettingsProvider'

describe('applyTheme', () => {
  it('pins day or night with data-theme and removes it to follow the system', () => {
    const root = document.createElement('html')
    applyTheme('dark', root)
    expect(root.getAttribute('data-theme')).toBe('dark')
    applyTheme('light', root)
    expect(root.getAttribute('data-theme')).toBe('light')
    applyTheme('auto', root)
    expect(root.hasAttribute('data-theme')).toBe(false)
  })
})
