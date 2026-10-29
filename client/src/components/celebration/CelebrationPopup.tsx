import { useEffect } from 'react'
import './CelebrationPopup.css'

export type CelebrationContent = {
  icon: string
  title: string
  message: string
}

type CelebrationPopupProps = CelebrationContent & {
  onClose: () => void
  autoDismissMs?: number
}

export function CelebrationPopup({
  icon,
  title,
  message,
  onClose,
  autoDismissMs = 5000,
}: CelebrationPopupProps) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, autoDismissMs)
    return () => window.clearTimeout(timer)
  }, [onClose, autoDismissMs])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="celebration" role="dialog" aria-modal="true" aria-labelledby="celebration-title">
      <button
        type="button"
        className="celebration__backdrop"
        aria-label="Dismiss celebration"
        onClick={onClose}
      />
      <div className="celebration__card">
        <div className="celebration__confetti" aria-hidden="true">
          <span /><span /><span /><span /><span /><span />
        </div>
        <p className="celebration__icon" aria-hidden="true">
          {icon}
        </p>
        <h2 id="celebration-title" className="celebration__title">
          {title}
        </h2>
        <p className="celebration__message">{message}</p>
        <button type="button" className="celebration__close" onClick={onClose}>
          Nice!
        </button>
      </div>
    </div>
  )
}
