import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import dialog from './SettingsDialog.module.css'
import styles from './ShortcutsDialog.module.css'

const GROUPS: { title: string; items: [keys: string[], action: string][] }[] = [
  {
    title: 'Workspace',
    items: [
      [['Space'], 'Play or stop the progression'],
      [['Shift', 'Space'], 'Play from the selected chord'],
      [['←', '→'], 'Select the previous or next chord'],
      [['Alt', '←', '→'], 'Move the selected chord'],
      [['Alt', '↑', '↓'], 'Transpose everything by a semitone'],
      [['Enter'], 'Hear the selected chord'],
      [['Delete'], 'Remove the selected chord'],
      [['Ctrl', 'D'], 'Duplicate the selected chord'],
      [['Ctrl', 'Z'], 'Undo'],
      [['Ctrl', 'Shift', 'Z'], 'Redo'],
      [['Ctrl', 'S'], 'Save'],
    ],
  },
  {
    title: 'Improvisation',
    items: [
      [['A', 'W', 'S', 'E', 'D', '…', 'K'], 'Play notes, like a piano keyboard laid on the letters'],
      [['Z', 'X'], 'Octave down or up'],
      [['Space'], 'Start or stop the loop'],
    ],
  },
  {
    title: 'Everywhere',
    items: [
      [['?'], 'Show this list'],
      [['Esc'], 'Close a dialog or menu'],
    ],
  },
]

/** The keyboard shortcuts, in one place instead of hints scattered over the interface. */
export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    closeButton.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className={dialog.backdrop} onMouseDown={onClose}>
      <div className={`${dialog.dialog} ${styles.dialog}`} role="dialog" aria-modal="true" aria-labelledby="shortcuts-title"
           onMouseDown={(e) => e.stopPropagation()}>
        <header className={dialog.header}>
          <h2 id="shortcuts-title">Keyboard shortcuts</h2>
          <button ref={closeButton} type="button" className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close shortcuts">
            <X size={16} />
          </button>
        </header>
        {GROUPS.map((group) => (
          <section key={group.title} className={dialog.section}>
            <h3 className="panel-title">{group.title}</h3>
            <dl className={styles.list}>
              {group.items.map(([keys, action]) => (
                <div key={action} className={styles.row}>
                  <dt>{keys.map((k, i) => <kbd key={i} className="kbd">{k}</kbd>)}</dt>
                  <dd>{action}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
        <p className={styles.note}>On a Mac, use ⌘ instead of Ctrl. A connected MIDI keyboard plays on every page, sustain pedal included.</p>
      </div>
    </div>
  )
}
