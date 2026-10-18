import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { getAudioEngine } from '../audio/audioEngine'
import { decodeMidiMessage } from '../model/midiMessage'
import { useSettings } from './SettingsProvider'

export type MidiStatus = 'unsupported' | 'off' | 'connecting' | 'on' | 'denied'

interface MidiApi {
  status: MidiStatus
  /** Names of the connected input devices. */
  devices: string[]
  /** Notes held on the keyboard, including those kept by the sustain pedal. */
  heldNotes: number[]
  connect: () => Promise<void>
  disconnect: () => void
}

const MidiContext = createContext<MidiApi | null>(null)

/**
 * A real keyboard through the Web MIDI API (Chrome, Edge, Opera, Firefox with permission). Notes play
 * with the current sound and show on the on-screen keyboards. The choice to connect is remembered, so
 * the keyboard reconnects on the next visit once the browser has granted access.
 */
export function MidiProvider({ children }: { children: ReactNode }) {
  const settings = useSettings()
  const supported = typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator
  const [status, setStatus] = useState<MidiStatus>(supported ? 'off' : 'unsupported')
  const [devices, setDevices] = useState<string[]>([])
  const [heldNotes, setHeldNotes] = useState<number[]>([])
  const access = useRef<MIDIAccess | null>(null)
  const pressed = useRef(new Set<number>())
  const sustained = useRef(new Set<number>())
  const pedal = useRef(false)

  const publish = useCallback(() => {
    setHeldNotes([...new Set([...pressed.current, ...sustained.current])].sort((a, b) => a - b))
  }, [])

  const onMessage = useCallback((message: MIDIMessageEvent) => {
    if (!message.data) return
    const event = decodeMidiMessage(message.data)
    if (!event) return
    const engine = getAudioEngine()
    if (event.type === 'on') {
      pressed.current.add(event.note)
      sustained.current.delete(event.note)
      void engine.noteOn(event.note, event.velocity).catch(() => {})
    } else if (event.type === 'off') {
      pressed.current.delete(event.note)
      if (pedal.current) sustained.current.add(event.note)
      else engine.noteOff(event.note)
    } else {
      pedal.current = event.down
      if (!event.down) {
        sustained.current.forEach((note) => engine.noteOff(note))
        sustained.current.clear()
      }
    }
    publish()
  }, [publish])

  const attach = useCallback((midi: MIDIAccess) => {
    const inputs = [...midi.inputs.values()]
    inputs.forEach((input) => { input.onmidimessage = onMessage })
    setDevices(inputs.map((input) => input.name ?? 'MIDI keyboard'))
  }, [onMessage])

  const connect = useCallback(async () => {
    if (!supported) return
    setStatus('connecting')
    try {
      const midi = await navigator.requestMIDIAccess()
      access.current = midi
      attach(midi)
      midi.onstatechange = () => attach(midi)
      setStatus('on')
      settings.update({ midiEnabled: true })
    } catch {
      setStatus('denied')
      settings.update({ midiEnabled: false })
    }
  }, [supported, attach, settings])

  const disconnect = useCallback(() => {
    const midi = access.current
    if (midi) {
      midi.onstatechange = null
      midi.inputs.forEach((input) => { input.onmidimessage = null })
    }
    access.current = null
    pressed.current.forEach((note) => getAudioEngine().noteOff(note))
    sustained.current.forEach((note) => getAudioEngine().noteOff(note))
    pressed.current.clear()
    sustained.current.clear()
    setDevices([])
    setHeldNotes([])
    setStatus(supported ? 'off' : 'unsupported')
    settings.update({ midiEnabled: false })
  }, [supported, settings])

  // Reconnect automatically when the user connected last time.
  const wanted = settings.midiEnabled
  useEffect(() => {
    if (wanted && supported && access.current === null) void connect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const api = useMemo<MidiApi>(() => ({ status, devices, heldNotes, connect, disconnect }),
    [status, devices, heldNotes, connect, disconnect])
  return <MidiContext.Provider value={api}>{children}</MidiContext.Provider>
}

export function useMidi(): MidiApi {
  const context = useContext(MidiContext)
  if (!context) throw new Error('useMidi must be used inside <MidiProvider>')
  return context
}
