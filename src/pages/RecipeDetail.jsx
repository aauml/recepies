import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

function getPortionInfo(name, qty, unit) {
  const g = parseFloat(qty)
  if (!g || isNaN(g)) return null
  const parts = []
  if (unit === 'g') parts.push(`${(g / 28.35).toFixed(1)} oz`)
  else if (unit === 'ml') parts.push(`${(g / 29.57).toFixed(1)} fl oz`)

  const lower = (name || '').toLowerCase()
  const estimates = [
    [/onion/, 150, 'medium onion'],
    [/garlic/, 5, 'clove'],
    [/potato/, 180, 'medium potato'],
    [/carrot/, 120, 'medium carrot'],
    [/tomato/, 150, 'medium tomato'],
    [/egg/, 55, 'egg'],
    [/pepper|bell/, 170, 'pepper'],
    [/zucchini|courgette/, 200, 'medium zucchini'],
    [/lemon/, 60, 'lemon'],
    [/lime/, 45, 'lime'],
    [/cilantro|coriander.*fresh/, 30, 'bunch'],
    [/parsley/, 30, 'bunch'],
    [/basil/, 20, 'bunch'],
    [/ginger/, 15, 'thumb piece'],
    [/avocado/, 170, 'avocado'],
    [/banana/, 120, 'banana'],
    [/apple/, 180, 'apple'],
    [/celery/, 60, 'stalk'],
  ]
  if (unit === 'g') {
    for (const [regex, weight, label] of estimates) {
      if (regex.test(lower)) {
        const count = g / weight
        const rounded = Math.round(count * 2) / 2
        if (rounded >= 0.5) {
          const plural = rounded !== 1 && !label.includes('bunch') && !label.includes('piece') ? 's' : ''
          parts.push(`~${rounded} ${label}${plural}`)
        }
        break
      }
    }
  }
  return parts.length > 0 ? parts.join(', ') : null
}

export default function RecipeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [recipe, setRecipe] = useState(null)
  const [bowlMode, setBowlMode] = useState(1)
  const [loading, setLoading] = useState(true)
  const [addedToShopping, setAddedToShopping] = useState(false)

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
      <div className="bg-accent text-white px-5 pt-4 pb-5 safe-top">
        <div className="flex items-center justify-between mb-2">
          <Link to="/recipes" className="text-white/80 text-sm no-underline inline-block min-h-0 min-w-0">
            &#8592; Back
          </Link>
          <Link
            to={`/recipes/${recipe.id}/edit`}
            className="text-white/80 text-sm no-underline inline-block min-h-0 min-w-0 bg-white/15 px-3 py-1 rounded-lg"
          >
            &#9998; Edit
          </Link>
        </div>
        <h1 className="text-xl font-bold leading-tight">{recipe.title}</h1>
        {recipe.description && (
          <p className="text-white/70 text-sm mt-1">{recipe.description}</p>
        )}
      </div>

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
      <div className="flex gap-4 px-5 py-3 text-sm text-warm-text-dim">
        {time && <span>&#9201; {time}</span>}
        {servings && <span>&#127860; {servings} servings</span>}
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
              {(group.items || []).map((item, ii) => {
                const estimate = item.estimate || getPortionInfo(item.name, item.qty, item.unit)
                return (
                  <li key={ii} className="bg-warm-card rounded-lg px-3 py-2">
                    <div className="flex justify-between text-sm">
                      <span>{item.name}</span>
                      <span className="font-semibold text-accent tabular-nums">{item.qty}{item.unit}</span>
                    </div>
                    {estimate && (
                      <div className="text-[0.65rem] text-warm-text-dim mt-0.5">{estimate}</div>
                    )}
                  </li>
                )
              })}
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
                  {/* Step ingredients with portions */}
                  {step.ingredients?.length > 0 && (
                    <div className="mt-2 bg-warm-bg rounded-lg px-3 py-2">
                      {step.ingredients.map((ing, i) => {
                        const est = ing.estimate || getPortionInfo(ing.name, ing.qty?.replace(/[^\d.]/g, ''), ing.qty?.replace(/[\d.]/g, '') || 'g')
                        return (
                          <div key={i} className="flex justify-between text-xs py-0.5">
                            <span className="text-warm-text-dim">{ing.name}</span>
                            <div className="text-right">
                              <span className="font-semibold text-accent">{ing.qty}</span>
                              {est && <span className="text-warm-text-dim ml-1">({est})</span>}
                            </div>
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
            {recipe.source_urls.filter(u => u).map((url, i) => (
              <li key={i}>
                <a href={url} target="_blank" rel="noopener noreferrer" className="text-accent text-sm break-all">
                  {url.replace(/^https?:\/\//, '').split('/')[0]}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

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
