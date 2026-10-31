import { useTheme } from '../../context/ThemeContext'
import { goTo } from '../../utils/navigation'
import './SiteFooter.css'

export function SiteFooter() {
  const { darkMode } = useTheme()

  return (
    <footer className={`site-footer ${darkMode ? 'site-footer--dark' : 'site-footer--light'}`}>
      <div className="site-footer__inner">
        <nav className="site-footer__links" aria-label="Legal">
          <button type="button" onClick={() => goTo('/terms')}>
            Terms
          </button>
          <button type="button" onClick={() => goTo('/privacy')}>
            Privacy
          </button>
          <button type="button" onClick={() => goTo('/license')}>
            License
          </button>
        </nav>
        <p className="site-footer__contact">Contact: team26101@codementor.app</p>
        <p className="site-footer__credit">CodeMentor, Team 26101</p>
      </div>
    </footer>
  )
}
