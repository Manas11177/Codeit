import { useState } from 'react'
import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import { CAT_POSE_SRC } from '../../cat/catAssets'
import type { CatMood } from '../../cat/catMessages'
import './CatToast.css'

type CatToastProps = {
  message: string
  mood: CatMood
  leaving?: boolean
  onDismiss: () => void
}

/** Reactions mode: the spinning black rainbow cat and its line. Companion does not render this. */
export function CatToast({ message, leaving = false, onDismiss }: CatToastProps) {
  const [failed, setFailed] = useState(false)

  return (
    <div className={`cat-toast${leaving ? ' is-leaving' : ''}`} role="status" aria-live="polite">
      <button
        type="button"
        className="cat-toast__dismiss"
        aria-label="Dismiss cat message"
        onClick={onDismiss}
      />
      <div className="cat-toast__panel">
        <p className="cat-toast__bubble">{message}</p>
        <div className="cat-toast__cat">
          {failed ? (
            <span className="cat-toast__emoji" aria-hidden="true">
              🐱
            </span>
          ) : (
            <DotLottieReact
              src={CAT_POSE_SRC.talk}
              loop
              autoplay
              className="cat-toast__lottie"
              dotLottieRefCallback={(dot) => {
                if (!dot) return
                ;(dot as unknown as { addEventListener: (type: string, cb: () => void) => void }).addEventListener(
                  'loadError',
                  () => setFailed(true),
                )
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
