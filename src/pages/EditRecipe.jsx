import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const TAG_OPTIONS = ['soup', 'main', 'side', 'dessert', 'bread', 'sauce', 'snack', 'breakfast', 'vegan', 'meal-prep']
const emptyIngredient = () => ({ name: '', qty: '', unit: 'g', category: 'produce' })
const emptyStep = () => ({ action: '', detail: '', time: '', temp: '', speed: '', reverse: false, accessories: [], ingredients: [] })

export default function EditRecipe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(null)

  useEffect(() => {
    supabase.from('recipes').select('*').eq('id', id).single().then(({ data }) => {
      if (data) {
        setForm({
          title: data.title || '',
          description: data.description || '',
          servings_1bowl: data.servings_1bowl || '',
          time_1bowl: data.time_1bowl || '',
          tags: data.tags || [],
          thumbnail_emoji: data.thumbnail_emoji || '🍽',
          source_urls: data.source_urls?.length ? data.source_urls : [''],
          ingredients: data.ingredients_1bowl || [{ group: '', items: [emptyIngredient()] }],
          steps: data.steps_1bowl || [emptyStep()],
          nutrition: data.nutrition,
          insulin_load: data.insulin_load,
        })
      }
      setLoading(false)
    })
  }, [id])

  if (loading) return <div className="flex items-center justify-center min-h-dvh text-warm-text-dim">Loading...</div>
  if (!form) return <div className="flex items-center justify-center min-h-dvh text-warm-text-dim">Recipe not found</div>

  function updateField(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
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

  function addIngredientGroup() {
    setForm((f) => ({ ...f, ingredients: [...f.ingredients, { group: '', items: [emptyIngredient()] }] }))
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

    const { error } = await supabase.from('recipes').update({
      title: form.title.trim(),
      description: form.description.trim() || null,
      servings_1bowl: form.servings_1bowl || null,
      time_1bowl: form.time_1bowl || null,
      tags: form.tags,
      thumbnail_emoji: form.thumbnail_emoji || '🍽',
      source_urls: form.source_urls.filter((u) => u.trim()),
      ingredients_1bowl: ingredients,
      steps_1bowl: steps,
      nutrition: form.nutrition,
      insulin_load: form.insulin_load,
      updated_at: new Date().toISOString(),
    }).eq('id', id)

    setSaving(false)
    if (!error) navigate(`/recipes/${id}`)
  }

  const inputClass = 'w-full py-2.5 px-3 rounded-xl bg-warm-card border border-warm-border text-warm-text text-sm outline-none focus:border-accent'

  return (
    <div className="min-h-dvh pb-24 bg-warm-bg">
      <div className="bg-accent text-white px-5 pt-4 pb-4 safe-top flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-white/80 min-h-0 min-w-0 bg-transparent text-sm">
          &#8592; Back
        </button>
        <h1 className="text-lg font-bold">Edit Recipe</h1>
      </div>

      <div className="px-5 py-4 flex flex-col gap-4">
        {/* Title */}
        <div>
          <label className="text-xs font-semibold text-warm-text-dim uppercase tracking-wide mb-1 block">Title *</label>
          <input value={form.title} onChange={(e) => updateField('title', e.target.value)} className={inputClass} />
        </div>

        {/* Description */}
        <div>
          <label className="text-xs font-semibold text-warm-text-dim uppercase tracking-wide mb-1 block">Description</label>
          <textarea value={form.description} onChange={(e) => updateField('description', e.target.value)} className={`${inputClass} resize-none`} rows={2} />
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

        {/* Ingredients */}
        <div>
          <label className="text-xs font-semibold text-warm-text-dim uppercase tracking-wide mb-1.5 block">Ingredients</label>
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
                placeholder="Group name"
              />
              {group.items.map((item, ii) => (
                <div key={ii} className="flex gap-1.5 mb-1.5">
                  <input value={item.name} onChange={(e) => updateIngredient(gi, ii, 'name', e.target.value)} className="flex-1 py-1.5 px-2 rounded-lg bg-warm-bg border border-warm-border text-xs outline-none" placeholder="Ingredient" />
                  <input value={item.qty} onChange={(e) => updateIngredient(gi, ii, 'qty', e.target.value)} className="w-16 py-1.5 px-2 rounded-lg bg-warm-bg border border-warm-border text-xs outline-none text-center" placeholder="200" />
                  <select value={item.unit} onChange={(e) => updateIngredient(gi, ii, 'unit', e.target.value)} className="w-14 py-1.5 px-1 rounded-lg bg-warm-bg border border-warm-border text-xs outline-none">
                    <option value="g">g</option><option value="ml">ml</option><option value="pcs">pcs</option><option value="tsp">tsp</option><option value="tbsp">tbsp</option>
                  </select>
                  <button onClick={() => removeIngredient(gi, ii)} className="text-red-400 text-xs min-h-0 min-w-6 bg-transparent">&#10005;</button>
                </div>
              ))}
              <button onClick={() => addIngredient(gi)} className="text-accent text-xs font-semibold mt-1 min-h-0 min-w-0 bg-transparent">+ Add ingredient</button>
            </div>
          ))}
          <button onClick={addIngredientGroup} className="text-accent text-xs font-semibold min-h-0 min-w-0 bg-transparent">+ Add ingredient group</button>
        </div>

        {/* Steps */}
        <div>
          <label className="text-xs font-semibold text-warm-text-dim uppercase tracking-wide mb-1.5 block">Steps</label>
          {form.steps.map((step, si) => (
            <div key={si} className="bg-warm-card rounded-xl p-3 mb-2">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 rounded-full bg-accent text-white text-[0.7em] font-bold flex items-center justify-center shrink-0">{si + 1}</span>
                <input value={step.action} onChange={(e) => updateStep(si, 'action', e.target.value)} className="flex-1 py-1.5 px-2 rounded-lg bg-warm-bg border border-warm-border text-xs outline-none font-semibold" placeholder="Action" />
                <button onClick={() => removeStep(si)} className="text-red-400 text-xs min-h-0 min-w-6 bg-transparent">&#10005;</button>
              </div>
              <textarea value={step.detail} onChange={(e) => updateStep(si, 'detail', e.target.value)} className="w-full py-1.5 px-2 rounded-lg bg-warm-bg border border-warm-border text-xs outline-none resize-none mb-2" rows={2} placeholder="Detail" />
              <div className="grid grid-cols-4 gap-1.5">
                <input value={step.time} onChange={(e) => updateStep(si, 'time', e.target.value)} className="py-1.5 px-2 rounded-lg bg-warm-bg border border-warm-border text-xs outline-none text-center" placeholder="Time" />
                <input value={step.temp} onChange={(e) => updateStep(si, 'temp', e.target.value)} className="py-1.5 px-2 rounded-lg bg-warm-bg border border-warm-border text-xs outline-none text-center" placeholder="Temp" />
                <input value={step.speed} onChange={(e) => updateStep(si, 'speed', e.target.value)} className="py-1.5 px-2 rounded-lg bg-warm-bg border border-warm-border text-xs outline-none text-center" placeholder="Speed" />
                <label className="flex items-center gap-1 text-xs text-warm-text-dim justify-center">
                  <input type="checkbox" checked={step.reverse} onChange={(e) => updateStep(si, 'reverse', e.target.checked)} />&#8635;
                </label>
              </div>
            </div>
          ))}
          <button onClick={addStep} className="text-accent text-xs font-semibold min-h-0 min-w-0 bg-transparent">+ Add step</button>
        </div>

        {/* Source URLs */}
        <div>
          <label className="text-xs font-semibold text-warm-text-dim uppercase tracking-wide mb-1 block">Source URLs</label>
          {form.source_urls.map((url, i) => (
            <input key={i} value={url} onChange={(e) => { const urls = [...form.source_urls]; urls[i] = e.target.value; updateField('source_urls', urls) }} className={`${inputClass} mb-1.5`} placeholder="https://..." />
          ))}
          <button onClick={() => updateField('source_urls', [...form.source_urls, ''])} className="text-accent text-xs font-semibold min-h-0 min-w-0 bg-transparent">+ Add source</button>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving || !form.title.trim()}
          className="w-full py-3.5 rounded-xl bg-accent text-white font-bold text-sm active:scale-[0.98] transition-transform disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}
