import type { GuideNoteView, GuideRole } from '../../api/types'
import styles from './Improvisation.module.css'

const GROUPS: { title: string; roles: GuideRole[]; className: string; hint: string }[] = [
  { title: 'Chord tones', roles: ['ROOT', 'CHORD_TONE'], className: styles.groupChord, hint: 'Land on these: always consonant.' },
  { title: 'Safe notes', roles: ['SCALE'], className: styles.groupScale, hint: 'Fill lines with these.' },
  { title: 'Tension notes', roles: ['TENSION'], className: styles.groupTension, hint: 'Expressive, but resolve them.' },
]

/** The notes of the current chord's guide, grouped by role, with the reason for each. */
export function NoteGuide({ guide }: { guide: GuideNoteView[] }) {
  return (
    <div className={styles.guide}>
      {GROUPS.map((group) => {
        const notes = guide.filter((n) => group.roles.includes(n.role))
        return (
          <section key={group.title} className={`${styles.group} ${group.className}`} aria-label={group.title}>
            <h3>{group.title}</h3>
            <p className={styles.hint}>{group.hint}</p>
            <ul>
              {notes.map((n) => (
                <li key={n.pitchClass}>
                  <span className={`mono ${styles.noteName}`}>{n.note}</span>
                  <span>{n.reason}</span>
                </li>
              ))}
              {notes.length === 0 && <li className={styles.hint}>None for this chord.</li>}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
