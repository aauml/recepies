import { NavLink, useNavigate } from 'react-router-dom'

const tabs = [
  { to: '/recipes', icon: '\uD83D\uDCD6', label: 'Recipes' },
  { to: '/shopping', icon: '\uD83D\uDED2', label: 'Shopping' },
  { to: '/inventory', icon: '\uD83D\uDCE6', label: 'Inventory' },
  { to: '/history', icon: '\uD83D\uDCCA', label: 'History' },
]

export default function TabBar({ shoppingCount = 0 }) {
  const navigate = useNavigate()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-warm-card border-t border-warm-border flex safe-bottom z-50">
      {/* Logo / Home button */}
      <button
        onClick={() => navigate('/recipes')}
        className="flex flex-col items-center justify-center gap-0.5 pt-2 pb-1 px-3 min-h-0 bg-transparent"
      >
        <span className="text-[1.4em] leading-none">&#127858;</span>
        <span className="text-[0.55em] text-accent font-bold tracking-tight">TM6</span>
      </button>

      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center gap-0.5 pt-2 pb-1 text-[0.65em] relative ${
              isActive ? 'text-accent font-semibold' : 'text-warm-text-dim'
            }`
          }
        >
          <span className="text-[1.7em]">{tab.icon}</span>
          {tab.to === '/shopping' && shoppingCount > 0 && (
            <span className="absolute top-1 right-[calc(50%-16px)] bg-accent text-white text-[0.8em] w-4 h-4 rounded-full flex items-center justify-center font-bold">
              {shoppingCount}
            </span>
          )}
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}
