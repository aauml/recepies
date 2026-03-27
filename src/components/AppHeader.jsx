import { useNavigate } from 'react-router-dom'
import ThermomixJar from './ThermomixJar'

export default function AppHeader({ title, subtitle, children }) {
  const navigate = useNavigate()

  return (
    <header className="bg-accent text-white px-5 pt-4 pb-4 safe-top">
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('/recipes')}
          className="flex items-center gap-1.5 bg-transparent shrink-0 p-0"
        >
          <ThermomixJar size={20} />
          <span className="text-[0.7rem] font-bold tracking-tight opacity-70">TM6</span>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold leading-snug line-clamp-2">{title}</h1>
          {subtitle && <p className="text-white/60 text-xs mt-0.5 line-clamp-1">{subtitle}</p>}
        </div>
        {children}
      </div>
      <div className="text-[0.5rem] text-white/30 text-right -mt-1 pr-1">v2.2</div>
    </header>
  )
}
