import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { MeasurementBadges } from '../lib/portions'
import AppHeader from '../components/AppHeader'

export default function RecipeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [recipe, setRecipe] = useState(null)
  const [bowlMode, setBowlMode] = useState(1)
  const [loading, setLoading] = useState(true)
  const [addedToShopping, setAddedToShopping] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [creator, setCreator] = useState(null)

  useEffect(() => {
    supabase
      .from('recipes')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error) console.error('Recipe fetch error:', error)
        setRecipe(data)
        setLoading(false)
        if (data?.created_by) {
          supabase.from('profiles').select('display_name, avatar_url').eq('id', data.created_by).single()
            .then(({ data: p }) => { if (p) setCreator(p) })
        }
      })
  }, [id])

  async function addToShopping() {
    const ings = bowlMode === 1 ? recipe.ingredients_1bowl : recipe.ingredients_2bowl
    if (!ings || !user) return
    const rows = []
    for (const group of ings) {
      for (const item of (group.items || [])) {
        if (!item.name?.trim()) continue
        rows.push({
          user_id: user.id,
          item_name: item.name,
          quantity: `${item.qty || ''}${item.unit || ''}`,
          category: item.category || 'other',
          recipe_id: recipe.id,
        })
      }
    }
    if (rows.length > 0) {
      await supabase.from('shopping_list').insert(rows)
      setAddedToShopping(true)
      setTimeout(() => setAddedToShopping(false), 3000)
    }
  }

  const [deleteError, setDeleteError] = useState('')

  async function deleteRecipe() {
    setDeleting(true)
    setDeleteError('')
    const { error } = await supabase.from('recipes').delete().eq('id', id)
    if (error) {
      console.error('Delete recipe error:', error)
      setDeleteError(error.message || 'Could not delete recipe')
      setDeleting(false)
      return
    }
    setDeleting(false)
    navigate('/recipes')
  }

  async function handleAiEdit() {
    if (!aiPrompt.trim() || !recipe) return
    setAiLoading(true)
    setAiError('')
    try {
      const resp = await fetch('/api/edit-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipe, instruction: aiPrompt.trim() }),
      })
      if (!resp.ok) throw new Error('AI edit failed')
      const updated = await resp.json()
      // Save to DB
      const { error } = await supabase.from('recipes').update({
        ...updated,
        updated_at: new Date().toISOString(),
      }).eq('id', id)
      if (!error) {
        setRecipe((r) => ({ ...r, ...updated }))
        setAiPrompt('')
      }
    } catch (err) {
      setAiError(err.message)
    }
    setAiLoading(false)
  }

  if (loading) return <div className="flex items-center justify-center min-h-dvh text-warm-text-dim">Loading...</div>
  if (!recipe) return <div className="flex items-center justify-center min-h-dvh text-warm-text-dim">Recipe not found</div>

  const ingredients = bowlMode === 1 ? recipe.ingredients_1bowl : recipe.ingredients_2bowl
  const steps = bowlMode === 1 ? recipe.steps_1bowl : recipe.steps_2bowl
  const servings = bowlMode === 1 ? recipe.servings_1bowl : recipe.servings_2bowl
  const time = bowlMode === 1 ? recipe.time_1bowl : recipe.time_2bowl

  const has2bowl = recipe.ingredients_2bowl && recipe.steps_2bowl

  return (
    <div className="min-h-dvh pb-24 bg-warm-bg">
      {/* Header */}
      <AppHeader title={recipe.title} subtitle={recipe.description}>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            to={`/recipes/${recipe.id}/edit`}
            className="text-white/80 text-sm no-underline inline-block min-h-0 min-w-0 bg-white/15 px-3 py-1 rounded-lg"
          >
            &#9998; Edit
          </Link>
          <button
            onClick={() => setShowDelete(true)}
            className="text-white/60 text-sm min-h-0 min-w-0 bg-white/10 px-3 py-1 rounded-lg"
          >
            &#128465;
          </button>
        </div>
      </AppHeader>

      {/* Delete confirm */}
      {showDelete && (
        <div className="mx-5 mt-3 bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm text-red-800 font-semibold mb-2">Delete this recipe?</p>
          <p className="text-xs text-red-600 mb-3">This cannot be undone.</p>
          <div className="flex gap-2">
            <button
              onClick={deleteRecipe}
              disabled={deleting}
              className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold min-h-0 disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
            <button
              onClick={() => setShowDelete(false)}
              className="px-4 py-2 rounded-lg bg-warm-card border border-warm-border text-sm text-warm-text min-h-0"
            >
              Cancel
            </button>
          </div>
          {deleteError && <p className="text-xs text-red-600 mt-2">{deleteError}</p>}
        </div>
      )}

      {/* Bowl toggle */}
      {has2bowl && (
        <div className="mx-5 -mt-3 bg-accent-dark rounded-xl flex overflow-hidden">
          {[1, 2].map((n) => (
            <button
              key={n}
              onClick={() => setBowlMode(n)}
              className={`flex-1 py-2.5 text-sm font-semibold min-h-0 transition-colors ${
                bowlMode === n ? 'bg-white text-accent' : 'bg-transparent text-white/60'
              }`}
            >
              {n === 1 ? '1 Bowl' : '2 Bowls'}
            </button>
          ))}
        </div>
      )}

      {/* Meta bar */}
      <div className="flex gap-4 px-5 py-3 text-sm text-warm-text-dim flex-wrap">
        {time && <span>&#9201; {time}</span>}
        {servings && <span>&#127860; {servings} servings</span>}
        {creator && (
          <span className="flex items-center gap-1">
            {creator.avatar_url && <img src={creator.avatar_url} alt="" className="w-4 h-4 rounded-full object-cover" />}
            by {creator.display_name}
          </span>
        )}
      </div>

      {/* Tags */}
      {recipe.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-5 mb-3">
          {recipe.tags.map((tag) => (
            <span key={tag} className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-accent-light text-accent-dark">{tag}</span>
          ))}
        </div>
      )}

      {/* Ingredients */}
      <section className="mx-5 mb-4">
        <h2 className="text-base font-bold text-warm-text mb-2">Ingredients</h2>
        {(ingredients || []).map((group, gi) => (
          <div key={gi} className="mb-3">
            {group.group && (
              <h3 className="text-xs uppercase tracking-wide text-warm-text-dim font-semibold mb-1.5">{group.group}</h3>
            )}
            <ul className="list-none p-0 flex flex-col gap-1">
              {(group.items || []).map((item, ii) => (
                  <li key={ii} className="bg-warm-card rounded-lg px-3 py-2">
                    <div className="flex justify-between items-start text-sm">
                      <span>{item.name}</span>
                      <MeasurementBadges name={item.name} qty={item.qty} unit={item.unit} estimate={item.estimate} />
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </section>

      {/* Steps */}
      <section className="mx-5 mb-4">
        <h2 className="text-base font-bold text-warm-text mb-2">Steps</h2>
        <ol className="list-none p-0 flex flex-col gap-3">
          {(steps || []).map((step, si) => (
            <li key={si} className="bg-warm-card rounded-xl p-4">
              <div className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {si + 1}
                </span>
                <div className="flex-1">
                  <p className="font-semibold text-sm leading-snug">{step.action}</p>
                  {step.detail && <p className="text-warm-text-dim text-xs mt-1 leading-relaxed">{step.detail}</p>}
                  {(step.temp || step.speed || step.time) && (
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {step.temp && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[#fff3e0] text-[#e65100] font-mono">
                          {step.temp}
                        </span>
                      )}
                      {step.speed && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-light text-green font-mono">
                          {step.reverse ? '\u21BB ' : ''}Speed {step.speed}
                        </span>
                      )}
                      {step.time && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-accent-light text-accent-dark font-mono">
                          {step.time}
                        </span>
                      )}
                    </div>
                  )}
                  {step.accessories?.length > 0 && (
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {step.accessories.map((a, i) => (
                        <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-warm-bg text-warm-text-dim border border-warm-border">
                          &#128295; {a}
                        </span>
                      ))}
                    </div>
                  )}
                  {step.ingredients?.length > 0 && (
                    <div className="mt-2 bg-warm-bg rounded-lg px-3 py-2">
                      {step.ingredients.map((ing, i) => {
                        const qtyNum = ing.qty?.replace(/[^\d.]/g, '') || ''
                        const qtyUnit = ing.qty?.replace(/[\d.\s]/g, '') || 'g'
                        return (
                          <div key={i} className="flex justify-between items-start text-xs py-0.5">
                            <span className="text-warm-text-dim">{ing.name}</span>
                            <MeasurementBadges name={ing.name} qty={qtyNum} unit={qtyUnit} estimate={ing.estimate} compact />
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {step.note && (
                    <div className="mt-2 bg-[#fff9e6] rounded-lg px-3 py-1.5 text-xs text-[#8a6d00]">
                      &#128221; {step.note}
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Nutrition */}
      {recipe.nutrition && (
        <section className="mx-5 mb-4">
          <h2 className="text-base font-bold text-warm-text mb-2">Nutrition (per serving)</h2>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(recipe.nutrition).filter(([k]) => k !== 'per_serving').map(([key, val]) => (
              <div key={key} className="bg-warm-card rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-accent">{val}</div>
                <div className="text-xs text-warm-text-dim capitalize">{key}</div>
              </div>
            ))}
          </div>
          {recipe.insulin_load && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-warm-text-dim font-semibold">Insulin Load:</span>
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <span key={n} className={`w-6 h-2.5 rounded-full ${n <= recipe.insulin_load ? 'bg-accent' : 'bg-warm-border'}`} />
                ))}
              </div>
              <span className="text-xs font-bold text-accent">{recipe.insulin_load}/5</span>
            </div>
          )}
        </section>
      )}

      {/* Source URLs */}
      {recipe.source_urls?.length > 0 && recipe.source_urls.some(u => u) && (
        <section className="mx-5 mb-4">
          <h2 className="text-base font-bold text-warm-text mb-2">Sources</h2>
          <ul className="list-none p-0 flex flex-col gap-1">
            {recipe.source_urls.filter(u => u).map((url, i) => {
              const display = url.replace(/^https?:\/\//, '').replace(/\/$/, '')
              const shortDisplay = display.length > 60 ? display.slice(0, 57) + '...' : display
              return (
                <li key={i}>
                  <a href={url} target="_blank" rel="noopener noreferrer" className="text-accent text-sm">
                    {shortDisplay}
                  </a>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* AI Edit */}
      <section className="mx-5 mb-4">
        <h2 className="text-base font-bold text-warm-text mb-2">&#129302; AI Edit</h2>
        <div className="bg-warm-card rounded-xl border border-warm-border p-3">
          <textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="Ask AI to modify this recipe, e.g.: &quot;verify and fix the source links&quot;, &quot;add more spice&quot;, &quot;replace butter with coconut oil&quot;, &quot;check the proportions for 2 bowls&quot;"
            rows={3}
            className="w-full py-2 px-3 rounded-lg bg-warm-bg border border-warm-border text-sm text-warm-text outline-none focus:border-accent resize-none"
          />
          {aiError && <p className="text-xs text-red-600 mt-1">{aiError}</p>}
          <button
            onClick={handleAiEdit}
            disabled={aiLoading || !aiPrompt.trim()}
            className="mt-2 w-full py-2.5 rounded-xl bg-accent text-white text-sm font-semibold disabled:opacity-50"
          >
            {aiLoading ? 'Updating recipe...' : 'Apply changes'}
          </button>
        </div>
      </section>

      {/* Actions */}
      <div className="mx-5 flex flex-col gap-2">
        <Link
          to={`/recipes/${recipe.id}/cook`}
          className="w-full py-3.5 rounded-xl bg-accent text-white text-center font-bold text-sm no-underline active:scale-[0.98] transition-transform"
        >
          &#128293; Cook this recipe
        </Link>
        <button
          onClick={addToShopping}
          disabled={addedToShopping}
          className={`w-full py-3 rounded-xl font-semibold text-sm border transition-all ${
            addedToShopping
              ? 'bg-green-50 border-green-300 text-green-700'
              : 'bg-warm-card border-warm-border text-warm-text active:scale-[0.98]'
          }`}
        >
          {addedToShopping
            ? `\u2713 Added ${bowlMode === 2 ? '2-bowl' : ''} ingredients to shopping`
            : `\uD83D\uDED2 Add to shopping list${has2bowl ? ` (${bowlMode === 1 ? '1 Bowl' : '2 Bowls'})` : ''}`
          }
        </button>
      </div>
    </div>
  )
}
