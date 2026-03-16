import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
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
  const [items, setItems] = useState([])
  const [inventory, setInventory] = useState([])
  const [recipes, setRecipes] = useState({})
  const [newItem, setNewItem] = useState('')
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('ingredient')
  const [editingInv, setEditingInv] = useState(null)
  const [editInvName, setEditInvName] = useState('')
  const [editInvQty, setEditInvQty] = useState('')
  const [newInvName, setNewInvName] = useState('')
  const [newInvQty, setNewInvQty] = useState('')

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

  async function copyList() {
    const unchecked = items.filter((i) => !i.checked)
    const text = unchecked.map((i) => `${i.item_name}${i.quantity ? ` - ${i.quantity}` : ''}`).join('\n')
    try { await navigator.clipboard.writeText(text) } catch {}
  }

  // Inventory CRUD
  async function addInventoryItem(e) {
    e.preventDefault()
    if (!newInvName.trim()) return
    const { data } = await supabase
      .from('inventory')
      .insert({ user_id: user.id, item_name: newInvName.trim(), quantity: newInvQty.trim() || null, category: 'other' })
      .select()
      .single()
    if (data) setInventory([data, ...inventory])
    setNewInvName('')
    setNewInvQty('')
  }

  async function saveInventoryEdit(inv) {
    await supabase.from('inventory').update({
      item_name: editInvName.trim() || inv.item_name,
      quantity: editInvQty.trim() || null,
    }).eq('id', inv.id)
    setInventory(inventory.map(i => i.id === inv.id ? { ...i, item_name: editInvName.trim() || i.item_name, quantity: editInvQty.trim() || null } : i))
    setEditingInv(null)
  }

  async function removeInventoryItem(id) {
    await supabase.from('inventory').delete().eq('id', id)
    setInventory(inventory.filter(i => i.id !== id))
  }

  const unchecked = items.filter((i) => !i.checked)
  const checked = items.filter((i) => i.checked)

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
        {sortedCats.map((cat) => (
          <div key={cat}>
            <h3 className="text-xs font-bold text-warm-text-dim uppercase tracking-wide mb-1">
              {CATEGORY_LABELS[cat] || cat}
            </h3>
            <div className="flex flex-col gap-1">
              {grouped[cat].map((item) => {
                const inStock = matchInventory(item.item_name, inventory)
                const { qty, unit } = parseQtyUnit(item.quantity)
                return (
                  <button
                    key={item.id}
                    onClick={() => toggleItem(item)}
                    className="flex items-center gap-2 bg-warm-card rounded-xl px-3 py-2 text-left min-h-0 w-full"
                  >
                    <span className="w-5 h-5 rounded-md border-2 border-warm-border shrink-0 flex items-center justify-center text-xs">
                      {item.checked ? '\u2713' : ''}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm">{item.item_name}</span>
                      {item.count > 1 && <span className="text-[0.65rem] text-warm-text-dim ml-1">(x{item.count})</span>}
                      <MeasurementBadges name={item.item_name} qty={qty} unit={unit} estimate={item.estimate} />
                    </div>
                    {inStock && (
                      <span className="text-[0.6rem] text-[#2e7d6f] font-semibold shrink-0">
                        Have{inStock.quantity ? `: ${inStock.quantity}` : ''}
                      </span>
                    )}
                  </button>
                )
              })}
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
              <h3 className="text-xs font-bold text-warm-text-dim uppercase tracking-wide mb-1">
                {rec?.thumbnail_emoji || '\uD83C\uDF7D'} {rec?.title || 'Unknown recipe'}
              </h3>
              <div className="flex flex-col gap-1">
                {rItems.map((item) => {
                  const { qty, unit } = parseQtyUnit(item.quantity)
                  return (
                    <button
                      key={item.id}
                      onClick={() => toggleItem(item)}
                      className="flex items-center gap-2 bg-warm-card rounded-xl px-3 py-2 text-left min-h-0 w-full"
                    >
                      <span className="w-5 h-5 rounded-md border-2 border-warm-border shrink-0 flex items-center justify-center text-xs">
                        {item.checked ? '\u2713' : ''}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm">{item.item_name}</span>
                        <MeasurementBadges name={item.item_name} qty={qty} unit={unit} estimate={item.estimate} />
                      </div>
                    </button>
                  )
                })}
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
              {noRecipe.map((item) => {
                const { qty, unit } = parseQtyUnit(item.quantity)
                return (
                  <button
                    key={item.id}
                    onClick={() => toggleItem(item)}
                    className="flex items-center gap-2 bg-warm-card rounded-xl px-3 py-2 text-left min-h-0 w-full"
                  >
                    <span className="w-5 h-5 rounded-md border-2 border-warm-border shrink-0 flex items-center justify-center text-xs" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm">{item.item_name}</span>
                      <MeasurementBadges name={item.item_name} qty={qty} unit={unit} />
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-dvh pb-24 bg-warm-bg">
      <AppHeader title="Shopping List" subtitle={`${unchecked.length} items needed`} />

      {/* Add item */}
      <form onSubmit={addItem} className="flex gap-2 px-4 py-3">
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
        <div className="flex gap-2">
          <button onClick={copyList} className="px-3 py-1.5 rounded-lg bg-warm-card border border-warm-border text-xs font-semibold text-warm-text-dim min-h-0 min-w-0">
            &#128203; Copy
          </button>
          {checked.length > 0 && (
            <button onClick={clearChecked} className="px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-600 min-h-0 min-w-0">
              &#128465; Clear checked ({checked.length})
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-center text-warm-text-dim py-10 text-sm">Loading...</p>
      ) : (
        <div className="flex gap-2 px-4">
          {/* Left column: Shopping list */}
          <div className="flex-1 min-w-0">
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
                          <span className="w-5 h-5 rounded-md border-2 border-accent bg-accent text-white shrink-0 flex items-center justify-center text-xs">
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

          {/* Right column: Inventory */}
          <div className="w-[160px] shrink-0">
            <h3 className="text-xs font-bold text-warm-text-dim uppercase tracking-wide mb-2">
              &#128230; Inventory
            </h3>

            {/* Add new inventory item */}
            <form onSubmit={addInventoryItem} className="mb-2">
              <input
                value={newInvName}
                onChange={(e) => setNewInvName(e.target.value)}
                placeholder="Item"
                className="w-full py-1 px-2 rounded-lg bg-warm-card border border-warm-border text-[0.7rem] outline-none focus:border-accent mb-1"
              />
              <div className="flex gap-1">
                <input
                  value={newInvQty}
                  onChange={(e) => setNewInvQty(e.target.value)}
                  placeholder="Qty"
                  className="flex-1 py-1 px-2 rounded-lg bg-warm-card border border-warm-border text-[0.7rem] outline-none focus:border-accent text-center"
                />
                <button type="submit" className="px-2 py-1 rounded-lg bg-accent text-white text-[0.65rem] font-semibold min-h-0 min-w-0">+</button>
              </div>
            </form>

            {/* Inventory items */}
            <div className="flex flex-col gap-1">
              {inventory.map((inv) => (
                <div key={inv.id} className="bg-warm-card rounded-lg px-2 py-1.5 text-[0.7rem]">
                  {editingInv === inv.id ? (
                    <div className="flex flex-col gap-1">
                      <input
                        value={editInvName}
                        onChange={(e) => setEditInvName(e.target.value)}
                        className="w-full py-0.5 px-1.5 rounded bg-warm-bg border border-warm-border text-[0.65rem] outline-none"
                        autoFocus
                      />
                      <div className="flex gap-1">
                        <input
                          value={editInvQty}
                          onChange={(e) => setEditInvQty(e.target.value)}
                          placeholder="Qty"
                          className="flex-1 py-0.5 px-1.5 rounded bg-warm-bg border border-warm-border text-[0.65rem] outline-none text-center"
                        />
                        <button
                          onClick={() => saveInventoryEdit(inv)}
                          className="text-accent text-[0.6rem] font-bold min-h-0 min-w-0 bg-transparent"
                        >
                          &#10003;
                        </button>
                        <button
                          onClick={() => setEditingInv(null)}
                          className="text-warm-text-dim text-[0.6rem] min-h-0 min-w-0 bg-transparent"
                        >
                          &#10005;
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-start gap-1">
                      <button
                        onClick={() => { setEditingInv(inv.id); setEditInvName(inv.item_name); setEditInvQty(inv.quantity || '') }}
                        className="text-left flex-1 min-w-0 min-h-0 bg-transparent p-0"
                      >
                        <div className="text-warm-text truncate">{inv.item_name}</div>
                        <div className="text-accent text-[0.6rem]">{inv.quantity || 'no qty'}</div>
                      </button>
                      <button
                        onClick={() => removeInventoryItem(inv.id)}
                        className="text-red-300 text-[0.6rem] min-h-0 min-w-0 bg-transparent shrink-0 mt-0.5"
                      >
                        &#10005;
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {inventory.length === 0 && (
                <p className="text-[0.6rem] text-warm-text-dim text-center py-2">No items yet</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
