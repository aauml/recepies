import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { useHousehold } from '../contexts/HouseholdContext'
import { MeasurementBadges } from '../lib/portions'
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


export default function ShoppingList() {
  const { user } = useAuth()
  const { householdUserIds } = useHousehold()
  const [items, setItems] = useState([])
  const [inventory, setInventory] = useState([])
  const [recipes, setRecipes] = useState({})
  const [newItem, setNewItem] = useState('')
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('ingredient')
  const [aiText, setAiText] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (user) {
      fetchItems()
      fetchInventory()
    }
  }, [user])

  async function fetchItems() {
    try {
      const result = await api.shoppingList.list()
      const data = result?.items || result || []
      setItems(data)
      // Recipes come joined from API
      const recMap = {}
      data.forEach(i => {
        if (i.recipe_id && i.recipe_title) {
          recMap[i.recipe_id] = { id: i.recipe_id, title: i.recipe_title, thumbnail_emoji: i.recipe_emoji }
        }
      })
      setRecipes(recMap)
    } catch (err) {
      console.error('Fetch items error:', err)
    }
    setLoading(false)
  }

  async function fetchInventory() {
    try {
      const result = await api.inventory.list()
      setInventory(result?.items || result || [])
    } catch (err) {
      console.error('Fetch inventory error:', err)
    }
  }

  async function addItem(e) {
    e.preventDefault()
    if (!newItem.trim()) return
    try {
      const data = await api.shoppingList.create({ item_name: newItem.trim(), category: 'other' })
      if (data) setItems([...items, data])
    } catch (err) {
      console.error('Add item error:', err)
    }
    setNewItem('')
  }

  async function toggleItem(item) {
    const updated = { ...item, checked: !item.checked }
    await api.shoppingList.update(item.id, { checked: updated.checked })
    setItems(items.map((i) => (i.id === item.id ? updated : i)))
  }

  async function addToInventory(item) {
    if (item.source_inventory_id) {
      await api.inventory.update(item.source_inventory_id, { in_stock: true, quantity: null, updated_at: new Date().toISOString() })
      setInventory((prev) => prev.map((i) => i.id === item.source_inventory_id ? { ...i, in_stock: true, quantity: null } : i))
    } else {
      const normalizedName = item.item_name.toLowerCase().trim().replace(/s$/, '')
      const match = inventory.find((i) => i.item_name.toLowerCase().trim().replace(/s$/, '') === normalizedName)
      if (match) {
        await api.inventory.update(match.id, { in_stock: true, quantity: null, updated_at: new Date().toISOString() })
        setInventory((prev) => prev.map((i) => i.id === match.id ? { ...i, in_stock: true, quantity: null } : i))
      } else {
        const data = await api.inventory.create({ item_name: item.item_name, quantity: null, category: item.category || 'other', section: 'fresh', in_stock: true })
        if (data) setInventory((prev) => [...prev, data])
      }
    }
    await api.shoppingList.delete(item.id)
    setItems((prev) => prev.filter((i) => i.id !== item.id))
  }

  async function clearChecked() {
    const checkedIds = items.filter((i) => i.checked).map((i) => i.id)
    if (checkedIds.length === 0) return
    await api.shoppingList.deleteBatch(checkedIds)
    setItems(items.filter((i) => !i.checked))
  }

  async function clearAll() {
    const allIds = items.map((i) => i.id)
    if (allIds.length === 0) return
    await api.shoppingList.deleteBatch(allIds)
    setItems([])
  }

  async function deleteRecipeItems(recipeId) {
    const ids = items.filter((i) => i.recipe_id === recipeId).map((i) => i.id)
    if (ids.length === 0) return
    await api.shoppingList.deleteBatch(ids)
    setItems(items.filter((i) => !ids.includes(i.id)))
  }

  // Copy list — WhatsApp-friendly format
  async function copyList() {
    const unchecked = items.filter((i) => !i.checked)
    const lines = []
    unchecked.forEach((item) => {
      // Strip prep instructions from name
      const cleanName = item.item_name.replace(/,\s*(quartered|cubed|grated|chopped|diced|sliced|minced|peeled|crushed|halved|julienned|shredded|torn|trimmed|deseeded|cored|finely\s+\w+|roughly\s+\w+|thinly\s+\w+).*$/i, '').trim()
      const { qty, unit } = parseQtyUnit(item.quantity)
      const display = qty ? `${qty}${unit} ${cleanName}` : cleanName
      lines.push(display)
    })
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      setToast('Copied to clipboard')
      setTimeout(() => setToast(''), 2000)
    } catch {}
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
          item_name: p.name,
          quantity: p.quantity || null,
          category: p.category || 'other',
        }))
        const data = await api.shoppingList.createBatch(rows)
        if (data) setItems([...items, ...(Array.isArray(data) ? data : [data])])
        setAiText('')
      }
    } catch (err) {
      console.error('AI parse error:', err)
    }
    setAiLoading(false)
  }

  const unchecked = items.filter((i) => !i.checked)
  const checked = items.filter((i) => i.checked)

  async function toggleHaveNeed(itemName) {
    const invMatch = matchInventory(itemName, inventory)
    if (invMatch) {
      const newStatus = !invMatch.in_stock
      await api.inventory.update(invMatch.id, { in_stock: newStatus, updated_at: new Date().toISOString() })
      setInventory((prev) => prev.map((i) => i.id === invMatch.id ? { ...i, in_stock: newStatus } : i))
    } else {
      const data = await api.inventory.create({ item_name: itemName, quantity: null, category: 'other', section: 'fresh', in_stock: true })
      if (data) setInventory((prev) => [...prev, data])
    }
  }

  // Render a single shopping row with have/need toggle
  function ShoppingRow({ item }) {
    const { qty, unit } = parseQtyUnit(item.quantity)
    const invMatch = matchInventory(item.item_name, inventory)
    const have = invMatch?.in_stock || false

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

        {/* Right: have/need toggle */}
        <button
          onClick={() => toggleHaveNeed(item.item_name)}
          className={`w-14 shrink-0 border-l border-warm-border flex items-center justify-center text-xs font-semibold min-h-0 transition-colors ${
            have ? 'bg-green-50 text-[#2e7d6f] active:bg-green-100' : 'bg-transparent text-warm-text-dim active:bg-warm-card'
          }`}
        >
          {have ? 'Have' : 'Need'}
        </button>
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
    <div className="min-h-dvh pb-24 bg-warm-bg overflow-x-hidden">
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
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-xs font-bold text-warm-text-dim uppercase tracking-wide">
                      Purchased ({checked.length})
                    </h3>
                    <button
                      onClick={async () => { for (const item of checked) await addToInventory(item) }}
                      className="text-xs px-2.5 py-1 rounded-lg bg-accent text-white font-semibold min-h-0 min-w-0"
                    >
                      &#10133; All to inventory
                    </button>
                  </div>
                  <div className="flex flex-col gap-1">
                    {checked.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-2 bg-warm-card/60 rounded-xl px-3 py-2"
                      >
                        <button
                          onClick={() => toggleItem(item)}
                          className="w-4 h-4 rounded border-2 border-accent bg-accent text-white shrink-0 flex items-center justify-center text-[0.6rem] min-h-0 min-w-0"
                        >
                          &#10003;
                        </button>
                        <span className="flex-1 text-sm text-warm-text-dim line-through min-w-0">{item.item_name}</span>
                        <button
                          onClick={() => addToInventory(item)}
                          className="text-xs px-2 py-1 rounded-lg bg-accent/10 text-accent font-semibold min-h-0 min-w-0 shrink-0"
                        >
                          &#10133; Inventory
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-[#333] text-white text-sm px-5 py-2.5 rounded-full shadow-lg animate-[slideUp_0.2s_ease-out] z-50">
          {toast}
        </div>
      )}
    </div>
  )
}
