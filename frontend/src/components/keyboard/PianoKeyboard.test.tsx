import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PianoKeyboard } from './PianoKeyboard'
import { chordHighlights } from './KeyboardPanel'
import { AM, F } from '../../test/fixtures'

describe('PianoKeyboard', () => {
  it('renders every key in the range, extended to white keys', () => {
    const { container } = render(<PianoKeyboard low={48} high={59} label="kb" />)
    expect(container.querySelectorAll('[data-midi]')).toHaveLength(12)
    const extended = render(<PianoKeyboard low={49} high={58} label="kb2" />)
    expect(extended.container.querySelectorAll('[data-midi]')).toHaveLength(12) // C#..A# grows to C..B
  })

  it('highlights chord tones from the voicing and distinguishes the root', () => {
    const { container } = render(<PianoKeyboard low={48} high={71} highlights={chordHighlights(AM)} label="kb" />)
    const highlighted = [...container.querySelectorAll('[data-highlight]:not([data-highlight="none"])')]
    expect(highlighted.map((k) => [Number(k.getAttribute('data-midi')), k.getAttribute('data-highlight')]))
      .toEqual([[57, 'root'], [60, 'tone'], [64, 'tone']])
    expect(screen.getByRole('button', { name: 'A3, chord root' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'E4, chord tone' })).toHaveTextContent('E4')
  })

  it('updates highlights when the chord changes', () => {
    const { container, rerender } = render(<PianoKeyboard low={48} high={71} highlights={chordHighlights(AM)} label="kb" />)
    rerender(<PianoKeyboard low={48} high={71} highlights={chordHighlights(F)} label="kb" />)
    expect(container.querySelector('[data-midi="65"]')).toHaveAttribute('data-highlight', 'root')
    expect(container.querySelector('[data-midi="64"]')).toHaveAttribute('data-highlight', 'none')
  })

  it('calls onKeyPress with the MIDI number', async () => {
    const onKeyPress = vi.fn<(midi: number) => void>()
    render(<PianoKeyboard low={60} high={64} onKeyPress={onKeyPress} label="kb" />)
    await userEvent.click(screen.getByRole('button', { name: 'D4' }))
    expect(onKeyPress).toHaveBeenCalledWith(62)
  })

  it('respects the label mode', () => {
    render(<PianoKeyboard low={48} high={59} labelMode="none" highlights={chordHighlights(null)} label="kb" />)
    expect(screen.getByRole('group', { name: 'kb' })).toHaveTextContent('')
  })
})
