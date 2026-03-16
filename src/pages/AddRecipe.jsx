import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const CATEGORIES = ['produce', 'dairy', 'pantry', 'protein', 'spices', 'other']
const TAG_OPTIONS = ['soup', 'main', 'side', 'dessert', 'bread', 'sauce', 'snack', 'breakfast', 'vegan', 'meal-prep']
const APPLIANCES = ['Thermomix TM6', 'Air Fryer', 'Oven', 'Combined']

const emptyIngredient = () => ({ name: '', qty: '', unit: 'g', category: 'produce' })
const emptyStep = () => ({ action: '', detail: '', time: '', temp: '', speed: '', reverse: false, accessories: [], ingredients: [] })

export default function AddRecipe() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [saving, setSaving] = useState(false)
  const [aiInput, setAiInput] = useState('')
  const [appliance, setAppliance] = useState('Thermomix TM6')
  const [generating, setGenerating] = useState(false)
  const [aiError, setAiError] = useState('')
  const [generated, setGenerated] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    servings_1bowl: '',
    time_1bowl: '',
    servings_2bowl: '',
    time_2bowl: '',
    tags: [],
    thumbnail_emoji: '🍽',
    source_urls: [''],
    ingredients: [{ group: '', items: [emptyIngredient()] }],
    ingredients_2bowl: [],
    steps: [emptyStep()],
    steps_2bowl: [],
    nutrition: null,
    insulin_load: null,
  })

  function updateField(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function addIngredientGroup() {
    setForm((f) => ({ ...f, ingredients: [...f.ingredients, { group: '', items: [emptyIngredient()] }] }))
  }

  function addIngredient(groupIdx) {
    setForm((f) => {
      const groups = [...f.ingredients]
      groups[groupIdx] = { ...groups[groupIdx], items: [...groups[groupIdx].items, emptyIngredient()] }
      return { ...f, ingredients: groups }
    })
  }

  function updateIngredient(groupIdx, itemIdx, field, value) {
    setForm((f) => {
      const groups = [...f.ingredients]
      const items = [...groups[groupIdx].items]
      items[itemIdx] = { ...items[itemIdx], [field]: value }
      groups[groupIdx] = { ...groups[groupIdx], items }
      return { ...f, ingredients: groups }
    })
  }

  function removeIngredient(groupIdx, itemIdx) {
    setForm((f) => {
      const groups = [...f.ingredients]
      const items = groups[groupIdx].items.filter((_, i) => i !== itemIdx)
      groups[groupIdx] = { ...groups[groupIdx], items }
      return { ...f, ingredients: groups }
    })
  }

  function addStep() {
    setForm((f) => ({ ...f, steps: [...f.steps, emptyStep()] }))
  }

  function updateStep(idx, field, value) {
    setForm((f) => {
      const steps = [...f.steps]
      steps[idx] = { ...steps[idx], [field]: value }
      return { ...f, steps }
    })
  }

  function removeStep(idx) {
    setForm((f) => ({ ...f, steps: f.steps.filter((_, i) => i !== idx) }))
  }

  async function handleGenerate() {
    if (!aiInput.trim()) return
    setGenerating(true)
    setAiError('')

    try {
      const resp = await fetch('/api/generate-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: aiInput, appliance }),
      })

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err.error || `Server error ${resp.status}`)
      }

      const recipe = await resp.json()

      setForm({
        title: recipe.title || '',
        description: recipe.description || '',
        servings_1bowl: recipe.servings_1bowl || '',
        time_1bowl: recipe.time_1bowl || '',
        servings_2bowl: recipe.servings_2bowl || '',
        time_2bowl: recipe.time_2bowl || '',
        tags: recipe.tags || [],
        thumbnail_emoji: recipe.thumbnail_emoji || '🍽',
        source_urls: recipe.source_urls?.length ? recipe.source_urls : [''],
        ingredients: recipe.ingredients_1bowl || [{ group: '', items: [emptyIngredient()] }],
        ingredients_2bowl: recipe.ingredients_2bowl || [],
        steps: recipe.steps_1bowl || [emptyStep()],
        steps_2bowl: recipe.steps_2bowl || [],
        nutrition: recipe.nutrition || null,
        insulin_load: recipe.insulin_load || null,
      })
      setGenerated(true)
    } catch (err) {
      setAiError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  async function handleSave() {
    if (!form.title.trim()) return
    setSaving(true)

    const ingredients = form.ingredients.map((g) => ({
      group: g.group,
      items: g.items.filter((i) => i.name.trim()),
    })).filter((g) => g.items.length > 0)

    const steps = form.steps.filter((s) => s.action.trim()).map((s) => ({
      ...s,
      speed: s.speed ? Number(s.speed) : null,
    }))

    const steps2 = (form.steps_2bowl || []).filter((s) => s.action?.trim()).map((s) => ({
      ...s,
      speed: s.speed ? Number(s.speed) : null,
    }))

    const ingredients2 = (form.ingredients_2bowl || []).map((g) => ({
      group: g.group,
      items: (g.items || []).filter((i) => i.name.trim()),
    })).filter((g) => g.items.length > 0)

    const { data, error } = await supabase.from('recipes').insert({
      title: form.title.trim(),
      description: form.description.trim() || null,
      servings_1bowl: form.servings_1bowl || null,
      time_1bowl: form.time_1bowl || null,
      servings_2bowl: form.servings_2bowl || null,
      time_2bowl: form.time_2bowl || null,
      tags: form.tags,
      thumbnail_emoji: form.thumbnail_emoji || '🍽',
      source_urls: form.source_urls.filter((u) => u.trim()),
      ingredients_1bowl: ingredients,
      steps_1bowl: steps,
      ingredients_2bowl: ingredients2.length > 0 ? ingredients2 : null,
      steps_2bowl: steps2.length > 0 ? steps2 : null,
      nutrition: form.nutrition,
      insulin_load: form.insulin_load,
      created_by: user?.id,
    }).select().single()

    setSaving(false)
    if (!error && data) navigate(`/recipes/${data.id}`)
  }

  const inputClass = 'w-full py-2.5 px-3 rounded-xl bg-warm-card border border-warm-border text-warm-text text-sm outline-none focus:border-accent'

  return (
    <div className="min-h-dvh pb-24 bg-warm-bg">
      <div className="bg-accent text-white px-5 pt-4 pb-4 safe-top flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-white/80 min-h-0 min-w-0 bg-transparent text-sm">
          &#8592; Back
        </button>
        <h1 className="text-lg font-bold">Add Recipe</h1>
      </div>

      <div className="px-5 py-4 flex flex-col gap-4">
        {/* AI Generation Section */}
        <div className="bg-warm-card rounded-2xl p-4 border border-warm-border">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">&#10024;</span>
            <h2 className="text-sm font-bold text-warm-text">AI Recipe Generator</h2>
          </div>

          <textarea
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            className={`${inputClass} resize-none mb-3`}
            rows={3}
            placeholder="Paste a URL, list ingredients, or describe what you want to cook...&#10;&#10;e.g. &quot;lentil soup with coconut milk&quot; or &quot;I have potatoes, leeks, cream&quot;"
          />

          {/* Appliance selector */}
          <div className="flex flex-wrap gap-2 mb-3">
            {APPLIANCES.map((a) => (
              <button
                key={a}
                onClick={() => setAppliance(a)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold min-h-0 min-w-0 border transition-colors ${
                  appliance === a ? 'bg-accent text-white border-accent' : 'bg-warm-bg text-warm-text-dim border-warm-border'
                }`}
              >
                {a === 'Thermomix TM6' ? '🥣 ' : a === 'Air Fryer' ? '🌀 ' : a === 'Oven' ? '🔥 ' : '🍳 '}
                {a}
              </button>
            ))}
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating || !aiInput.trim()}
            className="w-full py-3 rounded-xl bg-accent text-white font-bold text-sm active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
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

          {generated && (
            <p className="text-green-600 text-xs mt-2 font-semibold">&#10003; Recipe generated! Review and edit below, then save.</p>
          )}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-warm-border" />
          <span className="text-xs text-warm-text-dim font-semibold">{generated ? 'REVIEW & EDIT' : 'OR FILL MANUALLY'}</span>
          <div className="flex-1 h-px bg-warm-border" />
        </div>

        {/* Title */}
        <div>
          <label className="text-xs font-semibold text-warm-text-dim uppercase tracking-wide mb-1 block">Title *</label>
          <input value={form.title} onChange={(e) => updateField('title', e.target.value)} className={inputClass} placeholder="e.g. Spiced Lentil Soup" />
        </div>

        {/* Description */}
        <div>
          <label className="text-xs font-semibold text-warm-text-dim uppercase tracking-wide mb-1 block">Description</label>
          <textarea value={form.description} onChange={(e) => updateField('description', e.target.value)} className={`${inputClass} resize-none`} rows={2} placeholder="Short description" />
        </div>

        {/* Meta row */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold text-warm-text-dim uppercase tracking-wide mb-1 block">Emoji</label>
            <input value={form.thumbnail_emoji} onChange={(e) => updateField('thumbnail_emoji', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="text-xs font-semibold text-warm-text-dim uppercase tracking-wide mb-1 block">Time</label>
            <input value={form.time_1bowl} onChange={(e) => updateField('time_1bowl', e.target.value)} className={inputClass} placeholder="45 min" />
          </div>
          <div>
            <label className="text-xs font-semibold text-warm-text-dim uppercase tracking-wide mb-1 block">Servings</label>
            <input value={form.servings_1bowl} onChange={(e) => updateField('servings_1bowl', e.target.value)} className={inputClass} placeholder="4-6" />
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="text-xs font-semibold text-warm-text-dim uppercase tracking-wide mb-1.5 block">Tags</label>
          <div className="flex flex-wrap gap-2">
            {TAG_OPTIONS.map((tag) => (
              <button
                key={tag}
                onClick={() => updateField('tags', form.tags.includes(tag) ? form.tags.filter((t) => t !== tag) : [...form.tags, tag])}
                className={`px-3 py-1 rounded-full text-xs font-semibold min-h-0 min-w-0 border ${
                  form.tags.includes(tag) ? 'bg-accent text-white border-accent' : 'bg-warm-card text-warm-text-dim border-warm-border'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Nutrition (if AI generated) */}
        {form.nutrition && (
          <div>
            <label className="text-xs font-semibold text-warm-text-dim uppercase tracking-wide mb-1.5 block">Nutrition (per serving)</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(form.nutrition).map(([key, val]) => (
                <div key={key} className="bg-warm-card rounded-lg p-2.5 text-center border border-warm-border">
                  <div className="text-sm font-bold text-accent">{val}</div>
                  <div className="text-[0.65rem] text-warm-text-dim capitalize">{key}</div>
                </div>
              ))}
            </div>
            {form.insulin_load && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-warm-text-dim">Insulin Load:</span>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span key={n} className={`w-5 h-2 rounded-full ${n <= form.insulin_load ? 'bg-accent' : 'bg-warm-border'}`} />
                  ))}
                </div>
                <span className="text-xs font-semibold text-accent">{form.insulin_load}/5</span>
              </div>
            )}
          </div>
        )}

        {/* Ingredients */}
        <div>
          <label className="text-xs font-semibold text-warm-text-dim uppercase tracking-wide mb-1.5 block">Ingredients (1 Bowl)</label>
          {form.ingredients.map((group, gi) => (
            <div key={gi} className="mb-3 bg-warm-card rounded-xl p-3">
              <input
                value={group.group}
                onChange={(e) => {
                  const groups = [...form.ingredients]
                  groups[gi] = { ...groups[gi], group: e.target.value }
                  updateField('ingredients', groups)
                }}
                className="w-full py-1.5 px-2 rounded-lg bg-warm-bg border border-warm-border text-xs text-warm-text mb-2 outline-none"
                placeholder="Group name (e.g. Base, Toppings)"
              />
              {group.items.map((item, ii) => (
                <div key={ii} className="flex gap-1.5 mb-1.5">
                  <input
                    value={item.name}
                    onChange={(e) => updateIngredient(gi, ii, 'name', e.target.value)}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-warm-bg border border-warm-border text-xs outline-none"
                    placeholder="Ingredient"
                  />
                  <input
                    value={item.qty}
                    onChange={(e) => updateIngredient(gi, ii, 'qty', e.target.value)}
                    className="w-16 py-1.5 px-2 rounded-lg bg-warm-bg border border-warm-border text-xs outline-none text-center"
                    placeholder="200"
                  />
                  <select
                    value={item.unit}
                    onChange={(e) => updateIngredient(gi, ii, 'unit', e.target.value)}
                    className="w-14 py-1.5 px-1 rounded-lg bg-warm-bg border border-warm-border text-xs outline-none"
                  >
                    <option value="g">g</option>
                    <option value="ml">ml</option>
                    <option value="pcs">pcs</option>
                    <option value="tsp">tsp</option>
                    <option value="tbsp">tbsp</option>
                  </select>
                  <button onClick={() => removeIngredient(gi, ii)} className="text-red-400 text-xs min-h-0 min-w-6 bg-transparent">&#10005;</button>
                </div>
              ))}
              <button onClick={() => addIngredient(gi)} className="text-accent text-xs font-semibold mt-1 min-h-0 min-w-0 bg-transparent">
                + Add ingredient
              </button>
            </div>
          ))}
          <button onClick={addIngredientGroup} className="text-accent text-xs font-semibold min-h-0 min-w-0 bg-transparent">
            + Add ingredient group
          </button>
        </div>

        {/* Steps */}
        <div>
          <label className="text-xs font-semibold text-warm-text-dim uppercase tracking-wide mb-1.5 block">Steps (1 Bowl)</label>
          {form.steps.map((step, si) => (
            <div key={si} className="bg-warm-card rounded-xl p-3 mb-2">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 rounded-full bg-accent text-white text-[0.7em] font-bold flex items-center justify-center shrink-0">
                  {si + 1}
                </span>
                <input
                  value={step.action}
                  onChange={(e) => updateStep(si, 'action', e.target.value)}
                  className="flex-1 py-1.5 px-2 rounded-lg bg-warm-bg border border-warm-border text-xs outline-none font-semibold"
                  placeholder="Action (e.g. Chop vegetables)"
                />
                <button onClick={() => removeStep(si)} className="text-red-400 text-xs min-h-0 min-w-6 bg-transparent">&#10005;</button>
              </div>
              <textarea
                value={step.detail}
                onChange={(e) => updateStep(si, 'detail', e.target.value)}
                className="w-full py-1.5 px-2 rounded-lg bg-warm-bg border border-warm-border text-xs outline-none resize-none mb-2"
                rows={2}
                placeholder="Detail / instructions"
              />
              <div className="grid grid-cols-4 gap-1.5">
                <input value={step.time} onChange={(e) => updateStep(si, 'time', e.target.value)} className="py-1.5 px-2 rounded-lg bg-warm-bg border border-warm-border text-xs outline-none text-center" placeholder="Time" />
                <input value={step.temp} onChange={(e) => updateStep(si, 'temp', e.target.value)} className="py-1.5 px-2 rounded-lg bg-warm-bg border border-warm-border text-xs outline-none text-center" placeholder="Temp" />
                <input value={step.speed} onChange={(e) => updateStep(si, 'speed', e.target.value)} className="py-1.5 px-2 rounded-lg bg-warm-bg border border-warm-border text-xs outline-none text-center" placeholder="Speed" />
                <label className="flex items-center gap-1 text-xs text-warm-text-dim justify-center">
                  <input type="checkbox" checked={step.reverse} onChange={(e) => updateStep(si, 'reverse', e.target.checked)} />
                  &#8635;
                </label>
              </div>
            </div>
          ))}
          <button onClick={addStep} className="text-accent text-xs font-semibold min-h-0 min-w-0 bg-transparent">
            + Add step
          </button>
        </div>

        {/* Source URLs */}
        <div>
          <label className="text-xs font-semibold text-warm-text-dim uppercase tracking-wide mb-1 block">Source URLs</label>
          {form.source_urls.map((url, i) => (
            <input
              key={i}
              value={url}
              onChange={(e) => {
                const urls = [...form.source_urls]
                urls[i] = e.target.value
                updateField('source_urls', urls)
              }}
              className={`${inputClass} mb-1.5`}
              placeholder="https://..."
            />
          ))}
          <button onClick={() => updateField('source_urls', [...form.source_urls, ''])} className="text-accent text-xs font-semibold min-h-0 min-w-0 bg-transparent">
            + Add source
          </button>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving || !form.title.trim()}
          className="w-full py-3.5 rounded-xl bg-accent text-white font-bold text-sm active:scale-[0.98] transition-transform disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Recipe'}
        </button>
      </div>
    </div>
  )
}
