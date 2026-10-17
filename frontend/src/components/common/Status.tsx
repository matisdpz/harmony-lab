import type { ReactNode } from 'react'
import { AlertTriangle, Loader2, RotateCw } from 'lucide-react'
import styles from './Status.module.css'

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <span className={styles.spinner} role="status">
      <Loader2 size={14} className={styles.spin} aria-hidden />
      <span>{label}</span>
    </span>
  )
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className={styles.empty}>
      {icon && <div className={styles.emptyIcon} aria-hidden>{icon}</div>}
      <p className={styles.emptyTitle}>{title}</p>
      {children && <div className={styles.emptyText}>{children}</div>}
      {action && <div className={styles.emptyAction}>{action}</div>}
    </div>
  )
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className={styles.error} role="alert">
      <AlertTriangle size={15} aria-hidden />
      <span className={styles.errorText}>{message}</span>
      {onRetry && (
        <button type="button" className="btn btn-sm" onClick={onRetry}>
          <RotateCw size={13} aria-hidden /> Retry
        </button>
      )}
    </div>
  )
}
