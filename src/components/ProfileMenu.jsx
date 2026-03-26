import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useHousehold } from '../contexts/HouseholdContext'
import { api } from '../lib/api'

export default function ProfileMenu({ isOpen, onClose }) {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { household, members } = useHousehold()
  const [editingName, setEditingName] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [savedName, setSavedName] = useState(null)

  if (!isOpen || !user) return null

  const name = savedName || user.user_metadata?.full_name || user.email
  const avatar = user.user_metadata?.avatar_url
  const memberCount = members.length

  function startEditName() {
    setDisplayName(savedName || user.user_metadata?.full_name || '')
    setEditingName(true)
  }

  async function saveName() {
    const trimmed = displayName.trim()
    if (trimmed) {
      await api.profiles.update({ display_name: trimmed })
      setSavedName(trimmed)
    }
    setEditingName(false)
  }

  function goTo(path) {
    onClose()
    navigate(path)
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-[60]" onClick={onClose} />

      {/* Bottom sheet */}
      <div className="fixed bottom-0 left-0 right-0 bg-warm-card rounded-t-2xl z-[61] safe-bottom animate-slide-up">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-warm-border" />
        </div>

        {/* User info */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-warm-border">
          <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center text-lg overflow-hidden shrink-0">
            {avatar ? (
              <img src={avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              name[0].toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">{name}</p>
            <p className="text-xs text-warm-text-dim truncate">{user.email}</p>
          </div>
        </div>

        {/* Menu items */}
        <div className="py-2">
          {/* Household */}
          <button
            onClick={() => goTo('/household')}
            className="w-full flex items-center justify-between px-5 py-3.5 text-left bg-transparent"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">&#127968;</span>
              <div>
                <p className="text-sm font-semibold">Household</p>
                <p className="text-xs text-warm-text-dim">
                  {household ? `${household.name} (${memberCount} members)` : 'Not set up'}
                </p>
              </div>
            </div>
            <span className="text-warm-text-dim text-sm">&#8250;</span>
          </button>

          {/* Display name */}
          <div className="px-5 py-3.5 border-t border-warm-border/50">
            {editingName ? (
              <div className="flex items-center gap-2">
                <span className="text-lg">&#9998;</span>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoFocus
                  onBlur={saveName}
                  onKeyDown={(e) => e.key === 'Enter' && saveName()}
                  className="flex-1 py-1.5 px-2 rounded-lg bg-warm-bg border border-accent text-sm outline-none"
                  placeholder="Display name"
                />
              </div>
            ) : (
              <button
                onClick={startEditName}
                className="w-full flex items-center gap-3 text-left bg-transparent"
              >
                <span className="text-lg">&#9998;</span>
                <div>
                  <p className="text-sm font-semibold">Display Name</p>
                  <p className="text-xs text-warm-text-dim">{savedName || user.user_metadata?.full_name || 'Not set'}</p>
                </div>
              </button>
            )}
          </div>

          {/* Diet preferences */}
          <button
            onClick={() => goTo('/diet')}
            className="w-full flex items-center justify-between px-5 py-3.5 text-left bg-transparent border-t border-warm-border/50"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">&#127813;</span>
              <div>
                <p className="text-sm font-semibold">Diet Preferences</p>
                <p className="text-xs text-warm-text-dim">Vegetarian, allergies, etc.</p>
              </div>
            </div>
            <span className="text-warm-text-dim text-sm">&#8250;</span>
          </button>
        </div>

        {/* Logout */}
        <div className="border-t border-warm-border px-5 py-3">
          <button
            onClick={() => { onClose(); signOut() }}
            className="w-full py-3 rounded-xl text-red-500 text-sm font-semibold bg-red-50"
          >
            Log Out
          </button>
        </div>
      </div>
    </>
  )
}
