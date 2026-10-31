/**
 * TEMPLATE — review and replace with final legal copy before real launch.
 * These /terms, /privacy and /license pages are plain-language placeholders only.
 */
import { useTheme } from '../context/ThemeContext'
import { goTo } from '../utils/navigation'
import './LegalDoc.css'

export type LegalDocKind = 'terms' | 'privacy' | 'license'

type LegalDocProps = {
  kind: LegalDocKind
}

const COPY: Record<
  LegalDocKind,
  { title: string; updated: string; sections: { heading: string; body: string }[] }
> = {
  terms: {
    title: 'Terms of use',
    updated: 'Draft template',
    sections: [
      {
        heading: 'Learning use',
        body: 'CodeMentor is meant for learning to code. Use the lessons, practice tools and editor to build your skills.',
      },
      {
        heading: 'Fair use',
        body: 'Do not misuse the platform. That includes trying to cheat or game the reward system, harassing others, or using the service in ways that break the law.',
      },
      {
        heading: 'Content as is',
        body: 'Lesson content, feedback and rewards are provided as is for educational purposes. We may update materials as the product improves.',
      },
    ],
  },
  privacy: {
    title: 'Privacy',
    updated: 'Draft template',
    sections: [
      {
        heading: 'What we store',
        body: 'We store your email, learning progress, preferences, display name and avatar so the product can personalise your experience.',
      },
      {
        heading: 'Progress across devices',
        body: 'Progress is saved to your account so it can follow you when you sign in on another device.',
      },
      {
        heading: 'Code in the editor',
        body: 'Code you run in the virtual editor is processed so we can show you results and help you learn.',
      },
      {
        heading: 'No selling your data',
        body: 'We do not sell your information to third parties.',
      },
    ],
  },
  license: {
    title: 'License',
    updated: 'Draft template',
    sections: [
      {
        heading: 'CodeMentor license',
        body: 'License: to be decided by the team.',
      },
      {
        heading: 'Third-party libraries',
        body: 'Open-source and third-party libraries used in CodeMentor keep their own licenses. Those terms continue to apply to those components.',
      },
      {
        heading: 'Cat artwork — peek (cat-peek)',
        body: 'Artist: [artist]. Source: [source link]. Licence: [licence]. Placeholder — replace with the real credit before release.',
      },
      {
        heading: 'Cat artwork — alert (cat-alert)',
        body: 'Artist: [artist]. Source: [source link]. Licence: [licence]. Placeholder — replace with the real credit before release.',
      },
      {
        heading: 'Cat artwork — sleep (cat-sleep)',
        body: 'Artist: [artist]. Source: [source link]. Licence: [licence]. Placeholder — replace with the real credit before release.',
      },
      {
        heading: 'Cat artwork — talk (cat-talk)',
        body: 'Artist: [artist]. Source: [source link]. Licence: [licence]. Placeholder — replace with the real credit before release.',
      },
    ],
  },
}

export function LegalDoc({ kind }: LegalDocProps) {
  const { darkMode } = useTheme()
  const doc = COPY[kind]

  return (
    <div className={`legal ${darkMode ? 'legal--dark' : 'legal--light'}`}>
      <div className="legal__shell">
        <button type="button" className="legal__back" onClick={() => goTo('/')}>
          ← Back to CodeMentor
        </button>
        <p className="legal__eyebrow">{doc.updated}</p>
        <h1>{doc.title}</h1>
        {doc.sections.map((section) => (
          <section key={section.heading} className="legal__section">
            <h2>{section.heading}</h2>
            <p>{section.body}</p>
          </section>
        ))}
      </div>
    </div>
  )
}
