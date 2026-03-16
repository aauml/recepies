import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function History() {
  const { user } = useAuth()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) fetchLogs()
  }, [user])

  async function fetchLogs() {
    const { data } = await supabase
      .from('cook_log')
      .select('*, recipes(title, thumbnail_emoji)')
      .eq('user_id', user.id)
      .order('cooked_at', { ascending: false })
    setLogs(data || [])
    setLoading(false)
  }

  function formatDate(iso) {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="min-h-dvh pb-24 bg-warm-bg">
      <header className="bg-accent text-white px-5 pt-4 pb-4 safe-top">
        <h1 className="text-lg font-bold">Cook History</h1>
        <p className="text-white/60 text-xs mt-0.5">{logs.length} entries</p>
      </header>

      <div className="px-5 py-3 flex flex-col gap-2">
        {loading ? (
          <p className="text-center text-warm-text-dim py-10 text-sm">Loading...</p>
        ) : logs.length === 0 ? (
          <p className="text-center text-warm-text-dim py-10 text-sm">No cooking history yet. Cook a recipe to see it here!</p>
        ) : (
          logs.map((log) => (
            <Link
              key={log.id}
              to={`/recipes/${log.recipe_id}`}
              className="bg-warm-card rounded-xl p-4 no-underline text-inherit"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{log.recipes?.thumbnail_emoji || '\uD83C\uDF7D'}</span>
                <div className="flex-1">
                  <h3 className="text-sm font-bold">{log.recipes?.title || 'Unknown recipe'}</h3>
                  <p className="text-xs text-warm-text-dim mt-0.5">{formatDate(log.cooked_at)}</p>
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
          ))
        )}
      </div>
    </div>
  )
}
