import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function CookingMode() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [recipe, setRecipe] = useState(null)
  const [current, setCurrent] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showFinish, setShowFinish] = useState(false)
  const [rating, setRating] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [editing, setEditing] = useState(false)
  const [editStep, setEditStep] = useState(null)
  const touchStartX = useRef(0)

  useEffect(() => {
    supabase.from('recipes').select('*').eq('id', id).single()
      .then(({ data }) => { setRecipe(data); setLoading(false) })
  }, [id])

  // Wake Lock
  useEffect(() => {
    let wakeLock = null
    async function request() {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen')
        }
      } catch {}
    }
    request()
    const onVisChange = () => { if (document.visibilityState === 'visible') request() }
    document.addEventListener('visibilitychange', onVisChange)
    return () => {
      wakeLock?.release()
      document.removeEventListener('visibilitychange', onVisChange)
    }
  }, [])

  if (loading) return <div className="min-h-dvh bg-dark-bg flex items-center justify-center text-dark-text-dim">Loading...</div>
  if (!recipe) return <div className="min-h-dvh bg-dark-bg flex items-center justify-center text-dark-text-dim">Not found</div>

  const steps = recipe.steps_1bowl || []
  const total = steps.length
  const step = steps[current]
  if (!step) return null

  const progress = ((current + 1) / total) * 100
  const isLast = current === total - 1

  // Ring calculations
  const speedCirc = 2 * Math.PI * 90
  const speedPct = step.speed ? step.speed / 10 : 0
  const speedOffset = speedCirc - speedPct * speedCirc

  const tempCirc = 2 * Math.PI * 80
  const tempNum = step.temp ? parseInt(step.temp) : 0
  const tempPct = tempNum / 140
  const tempOffset = tempCirc - tempPct * tempCirc

  function nav(dir) {
    const next = current + dir
    if (next < 0) return
    if (next >= total) {
      setShowFinish(true)
      return
    }
    setCurrent(next)
  }

  function startEditStep() {
    setEditStep({ ...step })
    setEditing(true)
  }

  async function saveEditStep() {
    const newSteps = [...steps]
    newSteps[current] = editStep
    const { error } = await supabase.from('recipes').update({
      steps_1bowl: newSteps,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    if (!error) {
      setRecipe((r) => ({ ...r, steps_1bowl: newSteps }))
    }
    setEditing(false)
    setEditStep(null)
  }

  async function handleFinish() {
    if (user) {
      await supabase.from('cook_log').insert({
        recipe_id: recipe.id,
        user_id: user.id,
        rating: rating || null,
        feedback: feedback || null,
        bowl_mode: 1,
      })
    }
    navigate(`/recipes/${recipe.id}`)
  }

  function onTouchStart(e) { touchStartX.current = e.touches[0].clientX }
  function onTouchEnd(e) {
    const diff = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(diff) > 60) nav(diff < 0 ? 1 : -1)
  }

  if (showFinish) {
    return (
      <div className="min-h-dvh bg-dark-bg flex flex-col items-center justify-center px-6 text-dark-text">
        <div className="text-5xl mb-4">&#127881;</div>
        <h2 className="text-xl font-bold mb-2">Done!</h2>
        <p className="text-dark-text-dim text-sm mb-6">How did it turn out?</p>

        <div className="flex gap-2 mb-4">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setRating(n)}
              className={`text-3xl min-h-0 min-w-0 ${n <= rating ? 'opacity-100' : 'opacity-30'}`}
            >
              &#11088;
            </button>
          ))}
        </div>

        <textarea
          placeholder="Any notes? (optional)"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows={3}
          className="w-full max-w-sm rounded-xl bg-dark-card border border-[#444] text-dark-text text-sm p-3 outline-none resize-none mb-4"
        />

        <button
          onClick={handleFinish}
          className="w-full max-w-sm py-3.5 rounded-xl bg-dark-warm text-white font-bold text-sm"
        >
          Save & Finish
        </button>
        <button
          onClick={() => navigate(`/recipes/${recipe.id}`)}
          className="text-dark-text-dim text-sm mt-3 min-h-0"
        >
          Skip
        </button>
      </div>
    )
  }

  // Inline edit overlay
  if (editing && editStep) {
    return (
      <div className="min-h-dvh bg-dark-bg text-dark-text flex flex-col">
        <div className="flex justify-between items-center px-5 py-3 safe-top bg-dark-card border-b border-[#333] shrink-0">
          <span className="text-[0.9em] font-semibold">Edit Step {current + 1}</span>
          <button onClick={() => { setEditing(false); setEditStep(null) }} className="text-dark-text-dim text-sm min-h-0 bg-transparent">Cancel</button>
        </div>

        <div className="flex-1 px-5 py-4 flex flex-col gap-3 overflow-y-auto">
          <div>
            <label className="text-xs text-dark-text-dim uppercase tracking-wide mb-1 block">Action</label>
            <input
              value={editStep.action}
              onChange={(e) => setEditStep({ ...editStep, action: e.target.value })}
              className="w-full py-2.5 px-3 rounded-xl bg-dark-card border border-[#444] text-dark-text text-sm outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-dark-text-dim uppercase tracking-wide mb-1 block">Detail</label>
            <textarea
              value={editStep.detail || ''}
              onChange={(e) => setEditStep({ ...editStep, detail: e.target.value })}
              rows={3}
              className="w-full py-2.5 px-3 rounded-xl bg-dark-card border border-[#444] text-dark-text text-sm outline-none resize-none"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-dark-text-dim uppercase tracking-wide mb-1 block">Time</label>
              <input value={editStep.time || ''} onChange={(e) => setEditStep({ ...editStep, time: e.target.value })} className="w-full py-2.5 px-3 rounded-xl bg-dark-card border border-[#444] text-dark-text text-sm outline-none text-center" />
            </div>
            <div>
              <label className="text-xs text-dark-text-dim uppercase tracking-wide mb-1 block">Temp</label>
              <input value={editStep.temp || ''} onChange={(e) => setEditStep({ ...editStep, temp: e.target.value })} className="w-full py-2.5 px-3 rounded-xl bg-dark-card border border-[#444] text-dark-text text-sm outline-none text-center" />
            </div>
            <div>
              <label className="text-xs text-dark-text-dim uppercase tracking-wide mb-1 block">Speed</label>
              <input value={editStep.speed || ''} onChange={(e) => setEditStep({ ...editStep, speed: e.target.value })} className="w-full py-2.5 px-3 rounded-xl bg-dark-card border border-[#444] text-dark-text text-sm outline-none text-center" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-dark-text-dim">
            <input type="checkbox" checked={editStep.reverse || false} onChange={(e) => setEditStep({ ...editStep, reverse: e.target.checked })} />
            Reverse mode (&#8635;)
          </label>
        </div>

        <div className="px-5 py-4 safe-bottom bg-dark-card border-t border-[#333] shrink-0">
          <button
            onClick={saveEditStep}
            className="w-full py-3.5 rounded-xl bg-dark-accent text-white font-bold text-sm"
          >
            Save Step
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-dvh min-h-[100dvh] bg-dark-bg text-dark-text flex flex-col overflow-hidden select-none"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Top bar */}
      <div className="flex justify-between items-center px-5 py-3 safe-top bg-dark-card border-b border-[#333] shrink-0">
        <span className="text-[0.9em] font-semibold max-w-[55%] truncate">{recipe.title}</span>
        <div className="flex items-center gap-3">
          <button onClick={startEditStep} className="text-dark-text-dim text-xs min-h-0 bg-transparent border border-[#444] rounded-lg px-2 py-1">
            &#9998; Edit
          </button>
          <span className="text-[0.8em] text-dark-accent font-bold tabular-nums">{current + 1} / {total}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-[#333] shrink-0">
        <div className="h-full bg-dark-accent transition-[width] duration-400" style={{ width: `${progress}%` }} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-5 gap-4 overflow-y-auto">
        {/* TM6 Ring */}
        <div className="relative w-[220px] h-[220px] shrink-0">
          <svg viewBox="0 0 200 200" className="w-full h-full">
            <circle cx="100" cy="100" r="90" fill="none" stroke="#333" strokeWidth="8" />
            <circle
              cx="100" cy="100" r="90"
              fill="none" stroke="var(--color-speed-ring)" strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={speedCirc}
              strokeDashoffset={speedOffset}
              transform="rotate(-90 100 100)"
              className="transition-[stroke-dashoffset] duration-600"
            />
            {tempNum > 0 && (
              <>
                <circle cx="100" cy="100" r="80" fill="none" stroke="#442200" strokeWidth="4" />
                <circle
                  cx="100" cy="100" r="80"
                  fill="none" stroke="var(--color-temp)" strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={tempCirc}
                  strokeDashoffset={tempOffset}
                  transform="rotate(-90 100 100)"
                  className="transition-[stroke-dashoffset] duration-600"
                />
              </>
            )}
          </svg>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
            <div className={`text-[2.8em] font-extralight tracking-tight leading-none tabular-nums ${step.time ? 'animate-pulse' : ''}`}>
              {step.time || '\u2014'}
            </div>
            <div className="text-[0.7em] text-dark-text-dim mt-0.5 uppercase tracking-widest">
              {step.time ? 'time' : 'no timer'}
            </div>
          </div>
        </div>

        {/* Settings badges */}
        {(step.temp || step.speed || step.time) && (
          <div className="flex gap-3 justify-center flex-wrap">
            {step.temp && (
              <div className="flex items-center gap-1.5 bg-dark-card border border-[#444] rounded-full px-3.5 py-2 text-[0.85em]">
                <span>&#127777;</span>
                <span className="font-semibold text-temp">{step.temp}</span>
              </div>
            )}
            {step.speed && (
              <div className="flex items-center gap-1.5 bg-dark-card border border-[#444] rounded-full px-3.5 py-2 text-[0.85em]">
                <span>&#9889;</span>
                <span className="font-semibold text-dark-accent">{step.reverse ? '\u21BB ' : ''}Speed {step.speed}</span>
              </div>
            )}
            {step.time && (
              <div className="flex items-center gap-1.5 bg-dark-card border border-[#444] rounded-full px-3.5 py-2 text-[0.85em]">
                <span>&#9201;</span>
                <span className="font-semibold">{step.time}</span>
              </div>
            )}
          </div>
        )}

        {/* Accessories */}
        {step.accessories?.length > 0 && (
          <div className="flex gap-2 justify-center flex-wrap">
            {step.accessories.map((a, i) => (
              <span key={i} className="bg-[#2a2520] border border-[#5a4a3a] rounded-xl px-3 py-1 text-[0.75em] text-dark-warm-light flex items-center gap-1">
                &#128295; {a}
              </span>
            ))}
          </div>
        )}

        {/* Step instruction */}
        <div className="text-center px-3 max-w-[380px]">
          <p className="text-[1.15em] font-semibold leading-snug mb-2">{step.action}</p>
          {step.detail && <p className="text-[0.88em] text-dark-text-dim leading-relaxed">{step.detail}</p>}
        </div>

        {/* Step ingredients */}
        {step.ingredients?.length > 0 && (
          <div className="bg-dark-card rounded-xl p-3 px-4 w-full max-w-[360px]">
            <div className="text-[0.72em] uppercase tracking-widest text-dark-text-dim mb-2">
              Ingredients for this step
            </div>
            <ul className="list-none p-0 flex flex-col gap-1">
              {step.ingredients.map((ing, i) => (
                <li key={i} className="flex justify-between text-[0.88em]">
                  <span>{ing.name}</span>
                  <span className="font-semibold text-dark-warm-light tabular-nums">{ing.qty}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex gap-0 px-5 py-4 safe-bottom bg-dark-card border-t border-[#333] shrink-0">
        <button
          onClick={() => nav(-1)}
          className={`flex-1 py-4 rounded-xl font-semibold bg-transparent min-h-0 ${
            current === 0 ? 'invisible' : 'text-dark-text-dim'
          }`}
        >
          &#8592; Previous
        </button>
        <button
          onClick={() => nav(1)}
          className={`flex-1 py-4 rounded-xl font-semibold min-h-0 ${
            isLast
              ? 'bg-dark-warm text-white'
              : 'bg-dark-accent text-white'
          }`}
        >
          {isLast ? '\u2713 Finish' : 'Next \u2192'}
        </button>
      </div>
    </div>
  )
}
