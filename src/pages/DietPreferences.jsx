import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import AppHeader from '../components/AppHeader'

const DIET_OPTIONS = [
  { key: 'vegetarian', label: 'Vegetarian', icon: '&#127813;', desc: 'No meat or fish. Eggs and dairy OK.' },
  { key: 'vegan', label: 'Vegan', icon: '&#127793;', desc: 'No animal products at all.' },
  { key: 'gluten_free', label: 'Gluten Free', icon: '&#127838;', desc: 'No wheat, barley, rye, or oats.' },
  { key: 'dairy_free', label: 'Dairy Free', icon: '&#129371;', desc: 'No milk, cheese, butter, or cream.' },
  { key: 'nut_free', label: 'Nut Free', icon: '&#129372;', desc: 'No tree nuts or peanuts.' },
]

export default function DietPreferences() {
  const { user } = useAuth()
  const [prefs, setPrefs] = useState({ vegetarian: true })
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (user) {
      api.profiles.get()
        .then((data) => {
          if (data?.diet_preferences && Object.keys(data.diet_preferences).length > 0) {
            setPrefs(data.diet_preferences)
          }
          setLoading(false)
        })
        .catch(() => setLoading(false))
    }
  }, [user])

  async function toggle(key) {
    const updated = { ...prefs, [key]: !prefs[key] }
    setPrefs(updated)
    setSaved(false)
    await api.profiles.update({ diet_preferences: updated })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="min-h-dvh pb-24 bg-warm-bg">
      <AppHeader title="Diet Preferences" subtitle="Per-user dietary settings" />

      <div className="px-5 py-3">
        {loading ? (
          <p className="text-center text-warm-text-dim py-10 text-sm">Loading...</p>
        ) : (
          <div className="flex flex-col gap-2">
            {DIET_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => toggle(opt.key)}
                className={`flex items-center gap-3 bg-warm-card rounded-xl px-4 py-3.5 text-left transition-all border ${
                  prefs[opt.key]
                    ? 'border-accent bg-accent-light/40'
                    : 'border-warm-border'
                }`}
              >
                <span className="text-2xl" dangerouslySetInnerHTML={{ __html: opt.icon }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{opt.label}</p>
                  <p className="text-xs text-warm-text-dim">{opt.desc}</p>
                </div>
                <div className={`w-10 h-6 rounded-full relative transition-colors ${
                  prefs[opt.key] ? 'bg-accent' : 'bg-warm-border'
                }`}>
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                    prefs[opt.key] ? 'left-[18px]' : 'left-0.5'
                  }`} />
                </div>
              </button>
            ))}
          </div>
        )}

        {saved && (
          <p className="text-center text-green text-xs mt-3 font-semibold">&#10003; Saved</p>
        )}

        <p className="text-xs text-warm-text-dim text-center mt-6">
          These preferences are per-user, not per-household. Each household member can have different dietary needs.
        </p>
      </div>
    </div>
  )
}
