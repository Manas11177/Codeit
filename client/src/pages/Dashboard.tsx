import { useEffect, useState } from "react";
import { useTheme } from "../context/ThemeContext";
import { useUserStats } from "../hooks/useUserStats";
import { supabase } from "../lib/supabase";
import { LESSON_DATA } from "../carousel/lessonData";
import { ProfileMenu } from "../components/profile/ProfileMenu";
import {
  getNextGoodie,
  getUnlockedGoodieCount,
  REWARD_GOODIES,
} from "../rewards/goodies";
import {
  STATS_UPDATED_EVENT,
  getAchievements,
  getPreferences,
  getPreferredStartLessonId,
  queueStartLesson,
} from "../utils/lessonProgress";
import { goTo, requireAuth } from "../utils/navigation";

function Dashboard() {
  const { darkMode } = useTheme();
  const stats = useUserStats();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [prefsTick, setPrefsTick] = useState(0);

  useEffect(() => {
    function refreshPrefs() {
      setPrefsTick((n) => n + 1);
    }
    window.addEventListener(STATS_UPDATED_EVENT, refreshPrefs);
    return () =>
      window.removeEventListener(STATS_UPDATED_EVENT, refreshPrefs);
  }, []);

  void prefsTick;
  const medalsEarned = getAchievements().filter((item) => item.unlocked).length;
  const rewardsUnlocked = getUnlockedGoodieCount();
  const nextGoodie = getNextGoodie();
  const prefs = getPreferences();
  const dailyTarget =
    prefs && !prefs.skipped && prefs.dailyMinutes
      ? prefs.dailyMinutes
      : null;
  const showPrefsPrompt =
    !prefs ||
    prefs.skipped ||
    !(prefs.goal && prefs.experience && prefs.dailyMinutes);
  const startLessonId = getPreferredStartLessonId();
  const startLessonTitle =
    LESSON_DATA.find((lesson) => lesson.id === startLessonId)?.title ??
    "your first lesson";

  function goToContinue() {
    queueStartLesson(startLessonId);
    void requireAuth("/lessons");
  }

  function openEditPreferences() {
    window.dispatchEvent(new CustomEvent("codementor-edit-preferences"));
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserEmail(data.session?.user?.email ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const goToLogin = () => goTo("/login");
  const goToLessons = () => void requireAuth("/lessons");
  const goToEditor = () => void requireAuth("/virtual-editor");
  const goToProgress = () => void requireAuth("/progress");

  return (
    <div
      className={`relative min-h-screen overflow-hidden transition-colors duration-500 ${
        darkMode
          ? "bg-[#05070b] text-white"
          : "bg-slate-100 text-slate-900"
      }`}
    >
      {/* Background Video */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="fixed inset-0 z-0 h-full w-full object-cover"
      >
        <source
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4"
          type="video/mp4"
        />
      </video>

      {/* Theme-based Video Layer */}
      <div
        className={`fixed inset-0 z-[1] transition-colors duration-500 ${
          darkMode ? "bg-black/45" : "bg-white/65"
        }`}
      />

      {/* Main Content */}
      <div className="relative z-10 min-h-screen">

        {/* Navbar */}
        <nav
          className={`mx-auto flex max-w-7xl items-center justify-between px-6 py-6 md:px-8`}
        >
          {/* Logo */}
          <h1
            className={`text-3xl tracking-tight transition-colors duration-500 ${
              darkMode ? "text-white" : "text-slate-900"
            }`}
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            Code
            <span className={darkMode ? "text-[var(--cm-accent)]" : "text-[var(--cm-accent)]"}>
              Mentor
            </span>
          </h1>

          {/* Navigation */}
          <div
            className={`hidden items-center gap-8 md:flex ${
              darkMode ? "text-white/60" : "text-slate-600"
            }`}
          >
            <a
              href="#dashboard"
              className={`transition-colors ${
                darkMode
                  ? "text-white"
                  : "text-slate-900 font-semibold"
              }`}
            >
              Dashboard
            </a>

            <button
              type="button"
              onClick={goToLessons}
              className="transition-colors hover:text-[var(--cm-accent)]"
            >
              Lessons
            </button>

            <button
              type="button"
              onClick={goToEditor}
              className="transition-colors hover:text-[var(--cm-accent)]"
            >
              Virtual Editor
            </button>

            <button
              type="button"
              onClick={goToProgress}
              className="transition-colors hover:text-[var(--cm-accent)]"
            >
              Progress
            </button>
          </div>

          {/* Right Side — avatar / login only */}
          <div className="flex items-center gap-3">
            {userEmail ? (
              <ProfileMenu email={userEmail} />
            ) : (
              <button
                type="button"
                onClick={goToLogin}
                className={`liquid-glass rounded-full px-6 py-2.5 text-sm transition duration-300 hover:scale-[1.03] ${
                  darkMode ? "text-white" : "text-slate-900"
                }`}
              >
                Login
              </button>
            )}
          </div>
        </nav>

        {/* Hero */}
        <main id="dashboard">

          <section className="mx-auto flex min-h-[calc(100vh-100px)] max-w-7xl flex-col items-center justify-center px-6 py-20 text-center">

            {/* Badge */}
            <div
              className={`liquid-glass animate-fade-rise rounded-full px-5 py-2 text-sm transition-colors duration-500 ${
                darkMode ? "text-white/80" : "text-slate-800"
              }`}
            >
              <span
                className={`mr-2 ${
                  darkMode ? "text-[var(--cm-accent)]" : "text-[var(--cm-accent)]"
                }`}
              >
                ●
              </span>

              Learn • Practice • Grow
            </div>

            {/* Heading */}
            <h2
              className={`mt-8 max-w-6xl text-5xl font-normal leading-[0.95] tracking-[-2px] sm:text-7xl md:text-8xl animate-fade-rise ${
                darkMode ? "text-white" : "text-slate-900"
              }`}
              style={{ fontFamily: "'Instrument Serif', serif" }}
            >
              Learn coding.
              <br />

              <em
                className={`not-italic ${
                  darkMode ? "text-white/50" : "text-slate-500"
                }`}
              >
                Build your future.
              </em>
            </h2>

            {/* Description */}
            <p
              className={`mt-8 max-w-2xl text-base leading-relaxed sm:text-lg animate-fade-rise-delay ${
                darkMode ? "text-white/65" : "text-slate-600"
              }`}
            >
              Learn programming through interactive lessons, coding practice,
              and a virtual editor designed to make your learning journey
              simple and engaging.
            </p>

            {userEmail && showPrefsPrompt ? (
              <button
                type="button"
                onClick={openEditPreferences}
                className={`mt-5 text-sm underline-offset-2 hover:underline animate-fade-rise-delay ${
                  darkMode ? "text-white/50" : "text-slate-500"
                }`}
              >
                Set your goals to personalise your learning
              </button>
            ) : null}

            {/* CTA */}
            <div className="mt-12 flex flex-wrap justify-center gap-4 animate-fade-rise-delay-2">
              <button
                type="button"
                onClick={goToLessons}
                className={`liquid-glass rounded-full px-12 py-4 text-base transition duration-300 hover:scale-[1.03] ${
                  darkMode ? "text-white" : "text-slate-900"
                }`}
              >
                Start Learning →
              </button>
            </div>

            {/* Stats */}
            <div className="mt-20 grid w-full max-w-4xl grid-cols-2 gap-4 md:grid-cols-4">

              {/* Lessons Completed → constellation */}
              <button
                type="button"
                onClick={() => void requireAuth("/constellation")}
                className="liquid-glass rounded-2xl p-5 text-left transition duration-300 hover:-translate-y-1"
                title="Open course constellation"
              >
                <p
                  className={
                    darkMode
                      ? "text-sm text-white/50"
                      : "text-sm text-slate-600"
                  }
                >
                  Lessons Completed
                </p>

                <p
                  className={`mt-2 text-3xl ${
                    darkMode ? "text-white" : "text-slate-900"
                  }`}
                >
                  {stats.lessonsCompleted}/{stats.lessonCount}
                </p>

                <p
                  className={`mt-1 text-xs ${
                    darkMode ? "text-[var(--cm-accent)]" : "text-[var(--cm-accent)]"
                  }`}
                >
                  {stats.topicsCompleted} topics done
                  <span className="ml-1 opacity-80">· View →</span>
                </p>
              </button>

              {/* Streak & Medals */}
              <button
                type="button"
                onClick={() => void requireAuth("/streak")}
                className="liquid-glass rounded-2xl p-5 text-left transition duration-300 hover:-translate-y-1"
                title="Open streak & medals"
              >
                <p
                  className={
                    darkMode
                      ? "text-sm text-white/50"
                      : "text-sm text-slate-600"
                  }
                >
                  Streak & Medals
                </p>

                <p
                  className={`mt-2 text-3xl ${
                    darkMode ? "text-white" : "text-slate-900"
                  }`}
                >
                  {stats.streak} 🔥
                </p>

                <p className="mt-1 text-xs text-orange-500">
                  {medalsEarned} {medalsEarned === 1 ? "medal" : "medals"}
                  <span className="ml-1 opacity-80">· View →</span>
                </p>
                {dailyTarget != null ? (
                  <p
                    className={`mt-2 text-xs ${
                      darkMode ? "text-white/55" : "text-slate-600"
                    }`}
                  >
                    Daily target: {dailyTarget === 30 ? "30+" : dailyTarget} min
                  </p>
                ) : null}
              </button>

              {/* Progress */}
              <button
                type="button"
                onClick={() => void requireAuth("/progress")}
                className="liquid-glass rounded-2xl p-5 text-left transition duration-300 hover:-translate-y-1"
                title="Open progress tracker"
              >
                <p
                  className={
                    darkMode
                      ? "text-sm text-white/50"
                      : "text-sm text-slate-600"
                  }
                >
                  Progress
                </p>

                <p
                  className={`mt-2 text-3xl ${
                    darkMode ? "text-white" : "text-slate-900"
                  }`}
                >
                  {stats.progressPct}%
                </p>

                <div
                  className={`mt-3 h-1.5 overflow-hidden rounded-full ${
                    darkMode ? "bg-white/10" : "bg-slate-300"
                  }`}
                >
                  <div
                    className={`h-full rounded-full ${
                      darkMode ? "bg-white" : "bg-[var(--cm-accent)]"
                    }`}
                    style={{ width: `${stats.progressPct}%` }}
                  />
                </div>
                <p
                  className={`mt-2 text-xs ${
                    darkMode ? "text-[var(--cm-accent)]" : "text-[var(--cm-accent)]"
                  }`}
                >
                  Tracker
                  <span className="ml-1 opacity-80">· View →</span>
                </p>
              </button>

              {/* Rewards */}
              <button
                type="button"
                onClick={() => void requireAuth("/rewards")}
                className="liquid-glass rounded-2xl p-5 text-left transition duration-300 hover:-translate-y-1"
                title="Open rewards"
              >
                <p
                  className={
                    darkMode
                      ? "text-sm text-white/50"
                      : "text-sm text-slate-600"
                  }
                >
                  Rewards
                </p>

                <p
                  className={`mt-2 text-3xl ${
                    darkMode ? "text-white" : "text-slate-900"
                  }`}
                >
                  {rewardsUnlocked} of {REWARD_GOODIES.length}
                </p>

                <p
                  className={`mt-1 text-xs ${
                    darkMode ? "text-amber-300" : "text-amber-700"
                  }`}
                >
                  unlocked
                  <span className="ml-1 opacity-80">· View →</span>
                </p>

                <p
                  className={`mt-3 text-xs ${
                    darkMode ? "text-white/55" : "text-slate-600"
                  }`}
                >
                  {nextGoodie
                    ? `Next: ${nextGoodie.name}`
                    : "All goodies unlocked"}
                </p>
              </button>
            </div>
          </section>

          {/* Learning Cards */}
          <section
            id="lessons"
            className="mx-auto grid max-w-7xl gap-6 px-6 pb-24 md:grid-cols-2"
          >

            {/* Continue Learning */}
            <div className="liquid-glass rounded-3xl p-8 transition duration-500 hover:-translate-y-2">
              <p
                className={`text-sm font-medium tracking-widest ${
                  darkMode ? "text-[var(--cm-accent)]" : "text-[var(--cm-accent)]"
                }`}
              >
                CONTINUE LEARNING
              </p>

              <h3
                className={`mt-4 text-4xl font-normal ${
                  darkMode ? "text-white" : "text-slate-900"
                }`}
                style={{ fontFamily: "'Instrument Serif', serif" }}
              >
                Pick up where you left off.
              </h3>

              <p
                className={`mt-4 max-w-lg leading-7 ${
                  darkMode ? "text-white/55" : "text-slate-600"
                }`}
              >
                Suggested start: {startLessonTitle}. Continue your lessons and
                improve your programming skills through practical learning and
                coding challenges.
              </p>

              <button
                type="button"
                onClick={goToContinue}
                className={`liquid-glass mt-7 rounded-full px-7 py-3 text-sm transition hover:scale-105 ${
                  darkMode ? "text-white" : "text-slate-900"
                }`}
              >
                Continue →
              </button>
            </div>

            {/* Virtual Editor */}
            <div
              id="editor"
              className="liquid-glass rounded-3xl p-8 transition duration-500 hover:-translate-y-2"
            >
              <p
                className={`text-sm font-medium tracking-widest ${
                  darkMode ? "text-purple-300" : "text-purple-600"
                }`}
              >
                VIRTUAL EDITOR
              </p>

              <h3
                className={`mt-4 text-4xl font-normal ${
                  darkMode ? "text-white" : "text-slate-900"
                }`}
                style={{ fontFamily: "'Instrument Serif', serif" }}
              >
                Write. Run. Practice.
              </h3>

              <p
                className={`mt-4 max-w-lg leading-7 ${
                  darkMode ? "text-white/55" : "text-slate-600"
                }`}
              >
                Practice your code inside CodeMentor using an interactive
                virtual coding environment.
              </p>

              <button
                type="button"
                onClick={goToEditor}
                className={`liquid-glass mt-7 rounded-full px-7 py-3 text-sm transition hover:scale-105 ${
                  darkMode ? "text-white" : "text-slate-900"
                }`}
              >
                Open Editor →
              </button>
            </div>
          </section>

          {/* Progress */}
          <section
            id="progress"
            className="mx-auto max-w-7xl px-6 pb-24"
          >
            <div className="liquid-glass rounded-3xl p-8 md:p-10">

              <p
                className={`text-sm tracking-widest ${
                  darkMode ? "text-[var(--cm-accent)]" : "text-[var(--cm-accent)]"
                }`}
              >
                YOUR PROGRESS
              </p>

              <div className="mt-4 flex flex-col justify-between gap-6 md:flex-row md:items-end">

                <div>
                  <h3
                    className={`text-4xl font-normal md:text-5xl ${
                      darkMode ? "text-white" : "text-slate-900"
                    }`}
                    style={{ fontFamily: "'Instrument Serif', serif" }}
                  >
                    Keep building your skills.
                  </h3>

                  <p
                    className={`mt-3 ${
                      darkMode ? "text-white/50" : "text-slate-600"
                    }`}
                  >
                    You're {stats.progressPct}% through your learning journey ({stats.topicsCompleted}/{stats.topicsTotal} topics).
                  </p>

                  <button
                    type="button"
                    onClick={goToProgress}
                    className={`liquid-glass mt-5 rounded-full px-5 py-2.5 text-sm transition duration-300 hover:scale-105 ${
                      darkMode ? "text-white" : "text-slate-900"
                    }`}
                  >
                    Open Progress Tracker & Personalized Training →
                  </button>
                </div>

                <p
                  className={`text-5xl ${
                    darkMode ? "text-white" : "text-slate-900"
                  }`}
                >
                  {stats.progressPct}%
                </p>
              </div>

              <div
                className={`mt-8 h-2 overflow-hidden rounded-full ${
                  darkMode ? "bg-white/10" : "bg-slate-300"
                }`}
              >
                <div
                  className={`h-full rounded-full ${
                    darkMode ? "bg-white" : "bg-[var(--cm-accent)]"
                  }`}
                  style={{ width: `${stats.progressPct}%` }}
                />
              </div>
            </div>
          </section>
        </main>
      </div>

      {/* CSS */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500&display=swap');

        .liquid-glass {
          background: ${
            darkMode
              ? "rgba(255, 255, 255, 0.05)"
              : "rgba(255, 255, 255, 0.38)"
          };

          background-blend-mode: luminosity;

          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);

          border: 1px solid ${
            darkMode
              ? "rgba(255, 255, 255, 0.14)"
              : "rgba(255, 255, 255, 0.65)"
          };

          box-shadow:
            inset 0 1px 1px ${
              darkMode
                ? "rgba(255, 255, 255, 0.12)"
                : "rgba(255, 255, 255, 0.8)"
            },
            0 10px 40px ${
              darkMode
                ? "rgba(0, 0, 0, 0.2)"
                : "rgba(15, 23, 42, 0.12)"
            };

          position: relative;
          overflow: hidden;
        }

        .liquid-glass::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 1px;

          background: linear-gradient(
            180deg,
            ${
              darkMode
                ? "rgba(255,255,255,0.35)"
                : "rgba(255,255,255,0.9)"
            } 0%,
            ${
              darkMode
                ? "rgba(255,255,255,0.08)"
                : "rgba(255,255,255,0.45)"
            } 25%,
            rgba(255,255,255,0) 50%,
            ${
              darkMode
                ? "rgba(255,255,255,0.08)"
                : "rgba(255,255,255,0.4)"
            } 75%,
            ${
              darkMode
                ? "rgba(255,255,255,0.25)"
                : "rgba(255,255,255,0.8)"
            } 100%
          );

          -webkit-mask:
            linear-gradient(#fff 0 0) content-box,
            linear-gradient(#fff 0 0);

          -webkit-mask-composite: xor;
          mask-composite: exclude;

          pointer-events: none;
        }

        @keyframes fade-rise {
          from {
            opacity: 0;
            transform: translateY(24px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-rise {
          animation: fade-rise 0.8s ease-out both;
        }

        .animate-fade-rise-delay {
          animation: fade-rise 0.8s ease-out 0.2s both;
        }

        .animate-fade-rise-delay-2 {
          animation: fade-rise 0.8s ease-out 0.4s both;
        }
      `}</style>
    </div>
  );
}

export default Dashboard;