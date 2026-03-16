import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

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

export default function ShoppingList() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [newItem, setNewItem] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) fetchItems()
  }, [user])

  async function fetchItems() {
    const { data } = await supabase
      .from('shopping_list')
      .select('*')
      .eq('user_id', user.id)
      .order('added_at', { ascending: true })
    setItems(data || [])
    setLoading(false)
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
    try {
      await navigator.clipboard.writeText(text)
    } catch {}
  }

  // Group by category
  const grouped = {}
  const unchecked = items.filter((i) => !i.checked)
  const checked = items.filter((i) => i.checked)

  unchecked.forEach((item) => {
    const cat = item.category || 'other'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(item)
  })

  const sortedCategories = CATEGORY_ORDER.filter((c) => grouped[c])

  return (
    <div className="min-h-dvh pb-24 bg-warm-bg">
      <header className="bg-accent text-white px-5 pt-4 pb-4 safe-top">
        <h1 className="text-lg font-bold">Shopping List</h1>
        <p className="text-white/60 text-xs mt-0.5">{unchecked.length} items</p>
      </header>

      {/* Add item */}
      <form onSubmit={addItem} className="flex gap-2 px-5 py-3">
        <input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="Add an item..."
          className="flex-1 py-2.5 px-3 rounded-xl bg-warm-card border border-warm-border text-sm text-warm-text outline-none focus:border-accent"
        />
        <button type="submit" className="px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold min-w-0">
          Add
        </button>
      </form>

      {/* Actions */}
      <div className="flex gap-2 px-5 mb-3">
        <button onClick={copyList} className="px-3 py-1.5 rounded-lg bg-warm-card border border-warm-border text-xs font-semibold text-warm-text-dim min-h-0 min-w-0">
          &#128203; Copy list
        </button>
        {checked.length > 0 && (
          <button onClick={clearChecked} className="px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-600 min-h-0 min-w-0">
            &#128465; Clear checked ({checked.length})
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-center text-warm-text-dim py-10 text-sm">Loading...</p>
      ) : items.length === 0 ? (
        <p className="text-center text-warm-text-dim py-10 text-sm">Your shopping list is empty</p>
      ) : (
        <div className="px-5 flex flex-col gap-4">
          {sortedCategories.map((cat) => (
            <div key={cat}>
              <h3 className="text-xs font-bold text-warm-text-dim uppercase tracking-wide mb-1.5">
                {CATEGORY_LABELS[cat] || cat}
              </h3>
              <div className="flex flex-col gap-1">
                {grouped[cat].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => toggleItem(item)}
                    className="flex items-center gap-3 bg-warm-card rounded-xl px-3 py-2.5 text-left min-h-0 w-full"
                  >
                    <span className="w-5 h-5 rounded-md border-2 border-warm-border shrink-0 flex items-center justify-center text-xs">
                      {item.checked ? '\u2713' : ''}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm">{item.item_name}</span>
                      {item.quantity && <span className="text-xs text-accent ml-2">{item.quantity}</span>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Checked items */}
          {checked.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-warm-text-dim uppercase tracking-wide mb-1.5 opacity-50">
                Purchased
              </h3>
              <div className="flex flex-col gap-1 opacity-40">
                {checked.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => toggleItem(item)}
                    className="flex items-center gap-3 bg-warm-card rounded-xl px-3 py-2.5 text-left min-h-0 w-full"
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
        </div>
      )}
    </div>
  )
}
