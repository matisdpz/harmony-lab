import { INSTRUMENTS, type InstrumentId } from '../../audio/instruments'
import { useAudio } from '../../audio/AudioProvider'
import { Spinner } from '../common/Status'

/** Chooses the sound for all playback. Lives next to the transport so it can be changed while listening. */
export function SoundPicker({ id = 'sound' }: { id?: string }) {
  const audio = useAudio()
  const current = INSTRUMENTS.find((i) => i.id === audio.instrument)
  return (
    <label className="field" htmlFor={id}>
      <span className="field-label">Sound</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <select id={id} className="select" value={audio.instrument} title={current?.description}
                onChange={(e) => audio.setInstrument(e.target.value as InstrumentId)}>
          {INSTRUMENTS.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
        </select>
        {/* first play downloads the piano samples; later switches load the new sound */}
        {(audio.status === 'starting' || (audio.instrumentLoading && audio.status === 'ready')) && <Spinner label="Loading sound" />}
      </span>
    </label>
  )
}
