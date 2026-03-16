import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function AddRecipe() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [saving, setSaving] = useState(false)
  const [aiInput, setAiInput] = useState('')
  const [generating, setGenerating] = useState(false)
  const [aiError, setAiError] = useState('')
  const [recipe, setRecipe] = useState(null)

  async function handleGenerate() {
    if (!aiInput.trim()) return
    setGenerating(true)
    setAiError('')
    setRecipe(null)

    try {
      const resp = await fetch('/api/generate-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: aiInput }),
      })

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err.error || `Server error ${resp.status}`)
      }

      setRecipe(await resp.json())
    } catch (err) {
      setAiError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  async function handleSave() {
    if (!recipe?.title) return
    setSaving(true)

    const ingredients = (recipe.ingredients_1bowl || []).map((g) => ({
      group: g.group,
      items: (g.items || []).filter((i) => i.name?.trim()),
    })).filter((g) => g.items.length > 0)

    const steps = (recipe.steps_1bowl || []).filter((s) => s.action?.trim()).map((s) => ({
      ...s,
      speed: s.speed ? Number(s.speed) : null,
    }))

    const ingredients2 = (recipe.ingredients_2bowl || []).map((g) => ({
      group: g.group,
      items: (g.items || []).filter((i) => i.name?.trim()),
    })).filter((g) => g.items.length > 0)

    const steps2 = (recipe.steps_2bowl || []).filter((s) => s.action?.trim()).map((s) => ({
      ...s,
      speed: s.speed ? Number(s.speed) : null,
    }))

    const { data, error } = await supabase.from('recipes').insert({
      title: recipe.title,
      description: recipe.description || null,
      servings_1bowl: recipe.servings_1bowl || null,
      time_1bowl: recipe.time_1bowl || null,
      servings_2bowl: recipe.servings_2bowl || null,
      time_2bowl: recipe.time_2bowl || null,
      tags: recipe.tags || [],
      thumbnail_emoji: recipe.thumbnail_emoji || '🍽',
      source_urls: (recipe.source_urls || []).filter((u) => u),
      ingredients_1bowl: ingredients,
      steps_1bowl: steps,
      ingredients_2bowl: ingredients2.length > 0 ? ingredients2 : null,
      steps_2bowl: steps2.length > 0 ? steps2 : null,
      nutrition: recipe.nutrition || null,
      insulin_load: recipe.insulin_load || null,
      created_by: user?.id,
    }).select().single()

    setSaving(false)
    if (!error && data) navigate(`/recipes/${data.id}`)
  }

  return (
    <div className="min-h-dvh pb-24 bg-warm-bg">
      <div className="bg-accent text-white px-5 pt-4 pb-4 safe-top flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-white/80 min-h-0 min-w-0 bg-transparent text-sm">
          &#8592; Back
        </button>
        <h1 className="text-lg font-bold">Add Recipe</h1>
      </div>

      <div className="px-5 py-4 flex flex-col gap-4">
        {/* AI Generation */}
        <div className="bg-warm-card rounded-2xl p-4 border border-warm-border">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">&#10024;</span>
            <h2 className="text-sm font-bold text-warm-text">AI Recipe Generator</h2>
          </div>

          <textarea
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            className="w-full py-3 px-3 rounded-xl bg-warm-bg border border-warm-border text-warm-text text-sm outline-none focus:border-accent resize-y min-h-[120px]"
            rows={5}
            placeholder={'Paste a URL, list ingredients, or describe what you want to cook...\n\ne.g. "lentil soup with coconut milk"\ne.g. "I have potatoes, leeks, cream, garlic"\ne.g. https://www.example.com/recipe/...'}
          />

          <button
            onClick={handleGenerate}
            disabled={generating || !aiInput.trim()}
            className="w-full mt-3 py-3 rounded-xl bg-accent text-white font-bold text-sm active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {generating ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating recipe...
              </>
            ) : (
              <>&#10024; Generate with AI</>
            )}
          </button>

          {aiError && (
            <p className="text-red-500 text-xs mt-2">{aiError}</p>
          )}
        </div>

        {/* Generated Recipe Preview */}
        {recipe && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-warm-border" />
              <span className="text-xs text-warm-text-dim font-semibold">PREVIEW</span>
              <div className="flex-1 h-px bg-warm-border" />
            </div>

            {/* Title & description */}
            <div className="bg-warm-card rounded-2xl p-4 border border-warm-border">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">{recipe.thumbnail_emoji || '🍽'}</span>
                <h3 className="text-lg font-bold text-warm-text">{recipe.title}</h3>
              </div>
              {recipe.description && <p className="text-warm-text-dim text-sm mt-1">{recipe.description}</p>}
              <div className="flex gap-3 mt-2 text-xs text-warm-text-dim">
                {recipe.time_1bowl && <span>&#9201; {recipe.time_1bowl}</span>}
                {recipe.servings_1bowl && <span>&#127860; {recipe.servings_1bowl} servings</span>}
              </div>
              {recipe.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {recipe.tags.map((tag) => (
                    <span key={tag} className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-accent-light text-accent-dark">{tag}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Ingredients */}
            <div className="bg-warm-card rounded-2xl p-4 border border-warm-border">
              <h3 className="text-sm font-bold text-warm-text mb-2">Ingredients (1 Bowl)</h3>
              {(recipe.ingredients_1bowl || []).map((group, gi) => (
                <div key={gi} className="mb-2">
                  {group.group && <h4 className="text-xs uppercase tracking-wide text-warm-text-dim font-semibold mb-1">{group.group}</h4>}
                  <ul className="list-none p-0 flex flex-col gap-1">
                    {(group.items || []).map((item, ii) => (
                      <li key={ii} className="flex justify-between text-sm bg-warm-bg rounded-lg px-3 py-1.5">
                        <span>{item.name}</span>
                        <span className="font-semibold text-accent tabular-nums">{item.qty}{item.unit}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Steps */}
            <div className="bg-warm-card rounded-2xl p-4 border border-warm-border">
              <h3 className="text-sm font-bold text-warm-text mb-2">Steps (1 Bowl)</h3>
              <ol className="list-none p-0 flex flex-col gap-2">
                {(recipe.steps_1bowl || []).map((step, si) => (
                  <li key={si} className="flex items-start gap-2">
                    <span className="w-6 h-6 rounded-full bg-accent text-white text-[0.65rem] font-bold flex items-center justify-center shrink-0 mt-0.5">{si + 1}</span>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{step.action}</p>
                      {step.detail && <p className="text-warm-text-dim text-xs mt-0.5">{step.detail}</p>}
                      {(step.temp || step.speed || step.time) && (
                        <div className="flex gap-1.5 mt-1 flex-wrap">
                          {step.temp && <span className="text-[0.65rem] px-1.5 py-0.5 rounded-full bg-[#fff3e0] text-[#e65100] font-mono">{step.temp}</span>}
                          {step.speed && <span className="text-[0.65rem] px-1.5 py-0.5 rounded-full bg-green-light text-green font-mono">{step.reverse ? '↻ ' : ''}Spd {step.speed}</span>}
                          {step.time && <span className="text-[0.65rem] px-1.5 py-0.5 rounded-full bg-accent-light text-accent-dark font-mono">{step.time}</span>}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* Nutrition */}
            {recipe.nutrition && (
              <div className="bg-warm-card rounded-2xl p-4 border border-warm-border">
                <h3 className="text-sm font-bold text-warm-text mb-2">Nutrition (per serving)</h3>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(recipe.nutrition).map(([key, val]) => (
                    <div key={key} className="bg-warm-bg rounded-lg p-2 text-center">
                      <div className="text-sm font-bold text-accent">{val}</div>
                      <div className="text-[0.6rem] text-warm-text-dim capitalize">{key}</div>
                    </div>
                  ))}
                </div>
                {recipe.insulin_load && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-warm-text-dim">Insulin Load:</span>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <span key={n} className={`w-5 h-2 rounded-full ${n <= recipe.insulin_load ? 'bg-accent' : 'bg-warm-border'}`} />
                      ))}
                    </div>
                    <span className="text-xs font-semibold text-accent">{recipe.insulin_load}/5</span>
                  </div>
                )}
              </div>
            )}

            {/* Sources */}
            {recipe.source_urls?.some(u => u) && (
              <div className="bg-warm-card rounded-2xl p-4 border border-warm-border">
                <h3 className="text-sm font-bold text-warm-text mb-1">Sources</h3>
                {recipe.source_urls.filter(u => u).map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-accent text-xs break-all block">{url.replace(/^https?:\/\//, '').split('/')[0]}</a>
                ))}
              </div>
            )}

            {/* Save */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3.5 rounded-xl bg-accent text-white font-bold text-sm active:scale-[0.98] transition-transform disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Recipe'}
            </button>

            {/* Regenerate */}
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full py-3 rounded-xl bg-warm-card border border-warm-border text-warm-text-dim font-semibold text-sm"
            >
              &#8635; Regenerate
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
