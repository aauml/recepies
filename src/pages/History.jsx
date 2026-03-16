import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useHousehold } from '../contexts/HouseholdContext'
import AppHeader from '../components/AppHeader'

export default function History() {
  const { user } = useAuth()
  const { householdUserIds, members } = useHousehold()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirmClear, setConfirmClear] = useState(false)

  useEffect(() => {
    if (user) fetchLogs()
  }, [user])

  async function fetchLogs() {
    const { data } = await supabase
      .from('cook_log')
      .select('*, recipes(title, thumbnail_emoji)')
      .in('user_id', householdUserIds)
      .order('cooked_at', { ascending: false })
    setLogs(data || [])
    setLoading(false)
  }

  async function deleteLog(id) {
    await supabase.from('cook_log').delete().eq('id', id)
    setLogs(logs.filter((l) => l.id !== id))
  }

  async function clearAll() {
    const ids = logs.map((l) => l.id)
    if (ids.length === 0) return
    await supabase.from('cook_log').delete().in('id', ids)
    setLogs([])
    setConfirmClear(false)
  }

  function formatDate(iso) {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="min-h-dvh pb-24 bg-warm-bg">
      <AppHeader title="Cook History" subtitle={`${logs.length} entries`}>
        {logs.length > 0 && (
          <button
            onClick={() => setConfirmClear(true)}
            className="text-white/60 text-xs bg-white/10 px-3 py-1.5 rounded-lg shrink-0"
          >
            Clear all
          </button>
        )}
      </AppHeader>

      {/* Confirm clear */}
      {confirmClear && (
        <div className="mx-5 mt-3 bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm text-red-800 font-semibold mb-2">Clear all cooking history?</p>
          <p className="text-xs text-red-600 mb-3">This cannot be undone.</p>
          <div className="flex gap-2">
            <button
              onClick={clearAll}
              className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold"
            >
              Clear all
            </button>
            <button
              onClick={() => setConfirmClear(false)}
              className="px-4 py-2 rounded-lg bg-warm-card border border-warm-border text-sm text-warm-text"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="px-5 py-3 flex flex-col gap-2">
        {loading ? (
          <p className="text-center text-warm-text-dim py-10 text-sm">Loading...</p>
        ) : logs.length === 0 ? (
          <p className="text-center text-warm-text-dim py-10 text-sm">No cooking history yet. Cook a recipe to see it here!</p>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className="bg-warm-card rounded-xl p-4 relative"
            >
              <Link
                to={`/recipes/${log.recipe_id}`}
                className="no-underline text-inherit"
              >
                <div className="flex items-start gap-3 pr-6">
                  <span className="text-2xl">{log.recipes?.thumbnail_emoji || '\uD83C\uDF7D'}</span>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold">{log.recipes?.title || 'Unknown recipe'}</h3>
                    <p className="text-xs text-warm-text-dim mt-0.5">
                      {formatDate(log.cooked_at)}
                      {members.length > 1 && (() => {
                        const m = members.find(mb => mb.user_id === log.user_id)
                        return m ? <span className="ml-1.5">&#8226; {m.display_name}</span> : null
                      })()}
                    </p>
                    {log.rating && (
                      <div className="flex gap-0.5 mt-1">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <span key={n} className={`text-xs ${n <= log.rating ? 'opacity-100' : 'opacity-20'}`}>&#11088;</span>
                        ))}
                      </div>
                    )}
                    {log.feedback && (
                      <p className="text-xs text-accent mt-1 italic">&ldquo;{log.feedback}&rdquo;</p>
                    )}
                  </div>
                </div>
              </Link>
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteLog(log.id) }}
                className="absolute top-3 right-3 text-warm-text-dim/40 text-xs p-1"
              >
                &#128465;
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
