import { useNavigate } from 'react-router-dom'

export default function AppHeader({ title, subtitle, children }) {
  const navigate = useNavigate()

  return (
    <header className="bg-accent text-white px-5 pt-4 pb-4 safe-top">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/recipes')}
          className="flex items-center gap-2 min-h-0 bg-transparent shrink-0"
        >
          <span className="text-2xl leading-none">&#127858;</span>
          <span className="text-[0.7rem] font-bold tracking-tight opacity-70">TM6</span>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold leading-tight">{title}</h1>
          {subtitle && <p className="text-white/60 text-xs mt-0.5">{subtitle}</p>}
        </div>
        {children}
      </div>
    </header>
  )
}
