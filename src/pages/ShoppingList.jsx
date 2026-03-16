import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { getMeasurements, MeasurementBadges } from '../lib/portions'
import AppHeader from '../components/AppHeader'

const CATEGORY_ORDER = ['produce', 'dairy', 'protein', 'pantry', 'spices', 'frozen', 'other']
const CATEGORY_LABELS = {
  produce: '\uD83E\uDD66 Produce',
  dairy: '\uD83E\uDDC8 Dairy',
  protein: '\uD83E\uDD69 Protein',
  pantry: '\uD83E\uDED8 Pantry',
  spices: '\uD83E\uDDC2 Spices',
  frozen: '\u2744\uFE0F Frozen',
  other: '\uD83D\uDCE6 Other',
}

function matchInventory(itemName, inventory) {
  const lower = itemName.toLowerCase().replace(/[,.].*$/, '').trim()
  return inventory.find((inv) => {
    const invLower = inv.item_name.toLowerCase().trim()
    return lower.includes(invLower) || invLower.includes(lower)
  })
}

function parseQtyUnit(quantityStr) {
  if (!quantityStr) return { qty: '', unit: '' }
  const match = quantityStr.match(/^([\d.]+)\s*(g|ml|kg|l)?$/i)
  if (match) return { qty: match[1], unit: match[2] || '' }
  return { qty: quantityStr, unit: '' }
}

// Get the visual/friendly label for display
function getVisualLabel(name, qty, unit, estimate) {
  const m = getMeasurements(name, qty, unit, estimate)
  return m.visual || m.metric || ''
}

// Compute need after subtracting inventory
function computeNeed(itemName, itemQty, itemUnit, itemEstimate, inventory) {
  const inv = matchInventory(itemName, inventory)
  if (!inv || !inv.quantity) return { have: null, need: null, invItem: inv }

  const m = getMeasurements(itemName, itemQty, itemUnit, itemEstimate)
  const visual = m.visual // e.g. "~3 medium potatoes"
  const invQty = inv.quantity // e.g. "1" or "2 medium potatoes"

  // Try numeric comparison from visual estimates
  const needNum = visual ? parseFloat(visual.replace(/^~/, '')) : parseFloat(itemQty)
  const haveNum = parseFloat(invQty)

  if (!isNaN(needNum) && !isNaN(haveNum) && needNum > 0) {
    const remaining = Math.max(0, needNum - haveNum)
    // Extract the unit label from visual
    const unitLabel = visual ? visual.replace(/^~[\d.]+\s*/, '') : (itemUnit || '')
    return {
      have: haveNum,
      need: remaining,
      needLabel: remaining > 0 ? `${remaining} ${unitLabel}`.trim() : null,
      covered: remaining === 0,
      invItem: inv,
    }
  }

  return { have: invQty, need: null, invItem: inv }
}

export default function ShoppingList() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [inventory, setInventory] = useState([])
  const [recipes, setRecipes] = useState({})
  const [newItem, setNewItem] = useState('')
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('ingredient')
  const [editingInvFor, setEditingInvFor] = useState(null) // item id being inventory-edited
  const [editInvQty, setEditInvQty] = useState('')
  const [aiText, setAiText] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  useEffect(() => {
    if (user) {
      fetchItems()
      fetchInventory()
    }
  }, [user])

  async function fetchItems() {
    const { data } = await supabase
      .from('shopping_list')
      .select('*')
      .eq('user_id', user.id)
      .order('added_at', { ascending: true })
    setItems(data || [])
    setLoading(false)

    const recipeIds = [...new Set((data || []).filter(i => i.recipe_id).map(i => i.recipe_id))]
    if (recipeIds.length > 0) {
      const { data: recs } = await supabase
        .from('recipes')
        .select('id, title, thumbnail_emoji')
        .in('id', recipeIds)
      const map = {}
      ;(recs || []).forEach(r => { map[r.id] = r })
      setRecipes(map)
    }
  }

  async function fetchInventory() {
    const { data } = await supabase
      .from('inventory')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
    setInventory(data || [])
  }

  async function addItem(e) {
    e.preventDefault()
    if (!newItem.trim()) return
    const { data } = await supabase
      .from('shopping_list')
      .insert({ user_id: user.id, item_name: newItem.trim(), category: 'other' })
      .select()
      .single()
    if (data) setItems([...items, data])
    setNewItem('')
  }

  async function toggleItem(item) {
    const updated = { ...item, checked: !item.checked }
    await supabase.from('shopping_list').update({ checked: updated.checked }).eq('id', item.id)
    setItems(items.map((i) => (i.id === item.id ? updated : i)))
  }

  async function clearChecked() {
    const checkedIds = items.filter((i) => i.checked).map((i) => i.id)
    if (checkedIds.length === 0) return
    await supabase.from('shopping_list').delete().in('id', checkedIds)
    setItems(items.filter((i) => !i.checked))
  }

  async function clearAll() {
    const allIds = items.map((i) => i.id)
    if (allIds.length === 0) return
    await supabase.from('shopping_list').delete().in('id', allIds)
    setItems([])
  }

  async function deleteRecipeItems(recipeId) {
    const ids = items.filter((i) => i.recipe_id === recipeId).map((i) => i.id)
    if (ids.length === 0) return
    await supabase.from('shopping_list').delete().in('id', ids)
    setItems(items.filter((i) => !ids.includes(i.id)))
  }

  // Copy only what's needed (after inventory subtraction)
  async function copyList() {
    const unchecked = items.filter((i) => !i.checked)
    const lines = []
    unchecked.forEach((item) => {
      const { qty, unit } = parseQtyUnit(item.quantity)
      const info = computeNeed(item.item_name, qty, unit, item.estimate, inventory)
      if (info.covered) return // fully covered by inventory
      const visual = getVisualLabel(item.item_name, qty, unit, item.estimate)
      const display = info.needLabel || visual || item.quantity || ''
      lines.push(`${item.item_name}${display ? ` - ${display}` : ''}`)
    })
    try { await navigator.clipboard.writeText(lines.join('\n')) } catch {}
  }

  // AI add to shopping
  async function aiAddItems() {
    if (!aiText.trim()) return
    setAiLoading(true)
    try {
      const resp = await fetch('/api/parse-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: aiText.trim() }),
      })
      if (!resp.ok) throw new Error('Parse failed')
      const { items: parsed } = await resp.json()
      if (parsed?.length > 0) {
        const rows = parsed.map((p) => ({
          user_id: user.id,
          item_name: p.name,
          quantity: p.quantity || null,
          category: p.category || 'other',
        }))
        const { data } = await supabase.from('shopping_list').insert(rows).select()
        if (data) setItems([...items, ...data])
        setAiText('')
      }
    } catch (err) {
      console.error('AI parse error:', err)
    }
    setAiLoading(false)
  }

  // Inventory editing per shopping row
  async function saveInvQtyForItem(itemName) {
    const inv = matchInventory(itemName, inventory)
    if (inv) {
      await supabase.from('inventory').update({ quantity: editInvQty.trim() || null }).eq('id', inv.id)
      setInventory(inventory.map(i => i.id === inv.id ? { ...i, quantity: editInvQty.trim() || null } : i))
    } else if (editInvQty.trim()) {
      // Create new inventory entry
      const { data } = await supabase.from('inventory')
        .insert({ user_id: user.id, item_name: itemName, quantity: editInvQty.trim(), category: 'other' })
        .select().single()
      if (data) setInventory([data, ...inventory])
    }
    setEditingInvFor(null)
    setEditInvQty('')
  }

  const unchecked = items.filter((i) => !i.checked)
  const checked = items.filter((i) => i.checked)

  // Render a single shopping row with inventory column
  function ShoppingRow({ item }) {
    const { qty, unit } = parseQtyUnit(item.quantity)
    const info = computeNeed(item.item_name, qty, unit, item.estimate, inventory)
    const isEditing = editingInvFor === item.id

    return (
      <div className="flex items-stretch bg-warm-card rounded-xl overflow-hidden">
        {/* Left: shopping item */}
        <button
          onClick={() => toggleItem(item)}
          className="flex items-center gap-2 flex-1 min-w-0 px-3 py-2 text-left min-h-0 bg-transparent"
        >
          <span className="w-4 h-4 rounded border-2 border-warm-border shrink-0 flex items-center justify-center text-[0.6rem]">
            {item.checked ? '\u2713' : ''}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-sm leading-tight">{item.item_name}</div>
            <MeasurementBadges name={item.item_name} qty={qty} unit={unit} estimate={item.estimate} compact />
          </div>
        </button>

        {/* Right: inventory cell */}
        <div className="w-[100px] shrink-0 border-l border-warm-border flex items-center px-2">
          {isEditing ? (
            <form
              onSubmit={(e) => { e.preventDefault(); saveInvQtyForItem(item.item_name) }}
              className="flex-1"
            >
              <input
                value={editInvQty}
                onChange={(e) => setEditInvQty(e.target.value)}
                placeholder="have..."
                autoFocus
                onBlur={() => saveInvQtyForItem(item.item_name)}
                className="w-full py-0.5 px-1 rounded bg-warm-bg border border-accent text-[0.65rem] outline-none text-center"
              />
            </form>
          ) : (
            <button
              onClick={() => {
                setEditingInvFor(item.id)
                setEditInvQty(info.invItem?.quantity || '')
              }}
              className="flex-1 min-h-0 bg-transparent p-0 text-center"
            >
              {info.have !== null ? (
                <div>
                  <div className="text-[0.6rem] text-[#2e7d6f]">have {info.have}</div>
                  {info.covered ? (
                    <div className="text-[0.55rem] text-[#2e7d6f] font-bold">&#10003; covered</div>
                  ) : info.needLabel ? (
                    <div className="text-[0.55rem] text-accent font-semibold">buy {info.needLabel}</div>
                  ) : null}
                </div>
              ) : info.invItem ? (
                <div className="text-[0.6rem] text-[#2e7d6f]">&#10003; have</div>
              ) : (
                <div className="text-[0.55rem] text-warm-text-dim">tap to set</div>
              )}
            </button>
          )}
        </div>
      </div>
    )
  }

  function renderByIngredient() {
    const merged = {}
    unchecked.forEach((item) => {
      const key = item.item_name.toLowerCase().replace(/[,.].*$/, '').trim()
      if (!merged[key]) {
        merged[key] = { ...item, count: 1 }
      } else {
        if (item.quantity && merged[key].quantity) {
          const a = parseQtyUnit(merged[key].quantity)
          const b = parseQtyUnit(item.quantity)
          if (a.unit === b.unit && !isNaN(parseFloat(a.qty)) && !isNaN(parseFloat(b.qty))) {
            merged[key].quantity = `${parseFloat(a.qty) + parseFloat(b.qty)}${a.unit}`
          }
        }
        merged[key].count++
      }
    })

    const grouped = {}
    Object.values(merged).forEach((item) => {
      const cat = item.category || 'other'
      if (!grouped[cat]) grouped[cat] = []
      grouped[cat].push(item)
    })

    const sortedCats = CATEGORY_ORDER.filter((c) => grouped[c])

    return (
      <div className="flex flex-col gap-3">
        {/* Column headers */}
        <div className="flex text-[0.6rem] uppercase tracking-wide text-warm-text-dim font-bold px-1">
          <span className="flex-1">Item</span>
          <span className="w-[100px] text-center shrink-0">Inventory</span>
        </div>
        {sortedCats.map((cat) => (
          <div key={cat}>
            <h3 className="text-xs font-bold text-warm-text-dim uppercase tracking-wide mb-1">
              {CATEGORY_LABELS[cat] || cat}
            </h3>
            <div className="flex flex-col gap-1">
              {grouped[cat].map((item) => (
                <ShoppingRow key={item.id} item={item} />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  function renderByRecipe() {
    const byRecipe = {}
    const noRecipe = []
    unchecked.forEach((item) => {
      if (item.recipe_id && recipes[item.recipe_id]) {
        if (!byRecipe[item.recipe_id]) byRecipe[item.recipe_id] = []
        byRecipe[item.recipe_id].push(item)
      } else {
        noRecipe.push(item)
      }
    })

    return (
      <div className="flex flex-col gap-3">
        <div className="flex text-[0.6rem] uppercase tracking-wide text-warm-text-dim font-bold px-1">
          <span className="flex-1">Item</span>
          <span className="w-[100px] text-center shrink-0">Inventory</span>
        </div>
        {Object.entries(byRecipe).map(([rid, rItems]) => {
          const rec = recipes[rid]
          return (
            <div key={rid}>
              <div className="flex items-center justify-between mb-1">
                <Link to={`/recipes/${rid}`} className="text-xs font-bold text-accent uppercase tracking-wide no-underline">
                  {rec?.thumbnail_emoji || '\uD83C\uDF7D'} {rec?.title || 'Recipe'}
                </Link>
                <button
                  onClick={() => deleteRecipeItems(rid)}
                  className="text-[0.6rem] text-red-400 font-semibold min-h-0 min-w-0 bg-transparent"
                >
                  &#128465; Remove
                </button>
              </div>
              <div className="flex flex-col gap-1">
                {rItems.map((item) => (
                  <ShoppingRow key={item.id} item={item} />
                ))}
              </div>
            </div>
          )
        })}
        {noRecipe.length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-warm-text-dim uppercase tracking-wide mb-1">
              &#128221; Manual items
            </h3>
            <div className="flex flex-col gap-1">
              {noRecipe.map((item) => (
                <ShoppingRow key={item.id} item={item} />
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-dvh pb-24 bg-warm-bg">
      <AppHeader title="Shopping List" subtitle={`${unchecked.length} items needed`} />

      {/* AI quick add */}
      <div className="px-4 pt-3">
        <div className="bg-warm-card rounded-xl border border-warm-border p-3">
          <label className="text-[0.65rem] font-semibold text-warm-text-dim uppercase tracking-wide block mb-1">
            &#129302; Quick add (AI)
          </label>
          <div className="flex gap-2">
            <textarea
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
              placeholder="Dictate items, e.g.: &quot;3 potatoes, 1 bunch cilantro, 500g rice, milk&quot;"
              rows={2}
              className="flex-1 py-1.5 px-2 rounded-lg bg-warm-bg border border-warm-border text-[0.75rem] text-warm-text outline-none focus:border-accent resize-none"
            />
            <button
              onClick={aiAddItems}
              disabled={aiLoading || !aiText.trim()}
              className="px-3 rounded-xl bg-accent text-white text-xs font-semibold disabled:opacity-50 self-end min-h-0 py-2"
            >
              {aiLoading ? '...' : 'Add'}
            </button>
          </div>
        </div>
      </div>

      {/* Manual add */}
      <form onSubmit={addItem} className="flex gap-2 px-4 py-2">
        <input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="Add an item..."
          className="flex-1 py-2 px-3 rounded-xl bg-warm-card border border-warm-border text-sm text-warm-text outline-none focus:border-accent"
        />
        <button type="submit" className="px-4 py-2 rounded-xl bg-accent text-white text-sm font-semibold min-w-0">
          Add
        </button>
      </form>

      {/* Tabs + Actions */}
      <div className="px-4 mb-3 flex flex-col gap-2">
        <div className="flex bg-warm-card rounded-xl overflow-hidden border border-warm-border">
          <button
            onClick={() => setTab('ingredient')}
            className={`flex-1 py-2 text-xs font-semibold min-h-0 transition-colors ${
              tab === 'ingredient' ? 'bg-accent text-white' : 'bg-transparent text-warm-text-dim'
            }`}
          >
            By Ingredient
          </button>
          <button
            onClick={() => setTab('recipe')}
            className={`flex-1 py-2 text-xs font-semibold min-h-0 transition-colors ${
              tab === 'recipe' ? 'bg-accent text-white' : 'bg-transparent text-warm-text-dim'
            }`}
          >
            By Recipe
          </button>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={copyList} className="px-3 py-1.5 rounded-lg bg-warm-card border border-warm-border text-xs font-semibold text-warm-text-dim min-h-0 min-w-0">
            &#128203; Copy needed
          </button>
          {checked.length > 0 && (
            <button onClick={clearChecked} className="px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-600 min-h-0 min-w-0">
              &#128465; Clear checked ({checked.length})
            </button>
          )}
          {items.length > 0 && (
            <button onClick={clearAll} className="px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-600 min-h-0 min-w-0">
              &#128465; Clear all
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-center text-warm-text-dim py-10 text-sm">Loading...</p>
      ) : (
        <div className="px-4">
          {items.length === 0 ? (
            <p className="text-center text-warm-text-dim py-10 text-sm">Your shopping list is empty</p>
          ) : (
            <>
              {tab === 'ingredient' ? renderByIngredient() : renderByRecipe()}

              {checked.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-xs font-bold text-warm-text-dim uppercase tracking-wide mb-1 opacity-50">
                    Purchased
                  </h3>
                  <div className="flex flex-col gap-1 opacity-40">
                    {checked.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => toggleItem(item)}
                        className="flex items-center gap-2 bg-warm-card rounded-xl px-3 py-2 text-left min-h-0 w-full"
                      >
                        <span className="w-4 h-4 rounded border-2 border-accent bg-accent text-white shrink-0 flex items-center justify-center text-[0.6rem]">
                          &#10003;
                        </span>
                        <span className="text-sm line-through">{item.item_name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
