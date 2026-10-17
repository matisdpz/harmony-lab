import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import styles from './ConfirmProvider.module.css'

interface ConfirmOptions {
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

/** Accessible modal confirmation used before destructive or change-discarding actions. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null)
  const confirmButton = useRef<HTMLButtonElement>(null)

  const confirm = useCallback<ConfirmFn>((options) => new Promise((resolve) => setPending({ ...options, resolve })), [])

  const close = useCallback((ok: boolean) => {
    setPending((current) => {
      current?.resolve(ok)
      return null
    })
  }, [])

  useEffect(() => {
    if (!pending) return
    confirmButton.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pending, close])

  const value = useMemo(() => confirm, [confirm])

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {pending && (
        <div className={styles.backdrop} onMouseDown={() => close(false)}>
          <div className={styles.dialog} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title"
               aria-describedby="confirm-message" onMouseDown={(e) => e.stopPropagation()}>
            <h2 id="confirm-title" className={styles.title}>{pending.title}</h2>
            <p id="confirm-message" className={styles.message}>{pending.message}</p>
            <div className={styles.actions}>
              <button type="button" className="btn" onClick={() => close(false)}>Cancel</button>
              <button type="button" ref={confirmButton} className={`btn ${pending.danger ? 'btn-danger' : 'btn-primary'}`}
                      onClick={() => close(true)}>
                {pending.confirmLabel ?? 'Continue'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  const context = useContext(ConfirmContext)
  if (!context) throw new Error('useConfirm must be used inside <ConfirmProvider>')
  return context
}
