import { useTheme } from '../context/ThemeContext'
import { CourseConstellation } from '../components/lessons/CourseConstellation'
import { goTo, requireAuth } from '../utils/navigation'
import './ConstellationPage.css'

export function ConstellationPage() {
  const { darkMode } = useTheme()

  return (
    <div className={`csp ${darkMode ? 'csp--dark' : 'csp--light'}`}>
      <div className="csp__shell">
        <nav className="csp-nav">
          <button type="button" onClick={() => goTo('/')}>
            ← Dashboard
          </button>
          <button type="button" onClick={() => void requireAuth('/lessons')}>
            Lessons
          </button>
        </nav>

        <CourseConstellation />

        <div className="csp__actions">
          <button
            type="button"
            className="csp__continue"
            onClick={() => void requireAuth('/lessons')}
          >
            Continue learning →
          </button>
        </div>
      </div>
    </div>
  )
}
