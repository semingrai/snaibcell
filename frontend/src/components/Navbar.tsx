import { useEffect, useState } from 'react'
import { Activity } from 'lucide-react'

interface Props {
  title: string
  isDark: boolean
  onToggleDark: () => void
  showTimer?: boolean
  elapsedMin?: number
}

export default function Navbar({ title, isDark, onToggleDark, showTimer, elapsedMin }: Props) {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const fmtTime = time.toLocaleTimeString('en-US', { hour12: false })
  const fmtElapsed = elapsedMin !== undefined
    ? `${String(Math.floor(elapsedMin / 60)).padStart(2, '0')}:${String(elapsedMin % 60).padStart(2, '0')}:00`
    : null

  return (
    <nav className={`flex items-center h-14 px-4 md:px-6 border-b shrink-0
      ${isDark ? 'bg-dark-surface border-dark-border' : 'bg-white border-gray-200'}`}>
      {/* Logo */}
      <div className="flex items-center gap-2 mr-6">
        <div className="w-7 h-7 rounded-md bg-gradient-to-br from-blue-700 to-blue-950 flex items-center justify-center">
          <Activity size={14} className="text-brand-lblue" />
        </div>
        <span className={`text-xs font-bold tracking-widest uppercase
          ${isDark ? 'text-txt-primary' : 'text-gray-900'}`}>
          SNAIBCELL
        </span>
      </div>

      {/* Divider */}
      <div className={`w-px h-5 mr-6 ${isDark ? 'bg-dark-border' : 'bg-gray-200'}`} />

      {/* Page title */}
      <span className={`text-sm ${isDark ? 'text-txt-muted' : 'text-gray-500'}`}>{title}</span>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Elapsed timer */}
      {showTimer && fmtElapsed && (
        <div className="flex items-center gap-2 mr-6">
          <span className={`w-2 h-2 rounded-full bg-brand-red animate-pulse`} />
          <span className={`font-mono text-sm font-bold text-brand-red`}>{fmtElapsed}</span>
        </div>
      )}

      {/* Dark toggle */}
      <button
        onClick={onToggleDark}
        className={`text-xs px-3 py-1 border transition-colors
          ${isDark
            ? 'border-dark-border text-txt-muted hover:text-txt-primary'
            : 'border-gray-200 text-gray-500 hover:text-gray-900'
          }`}
      >
        {isDark ? 'Light' : 'Dark'}
      </button>

      {/* Clock */}
      <span className={`hidden sm:block font-mono text-xs ml-4 ${isDark ? 'text-txt-muted' : 'text-gray-400'}`}>
        {fmtTime}
      </span>
    </nav>
  )
}
