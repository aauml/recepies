import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useHousehold } from '../contexts/HouseholdContext'
import AppHeader from '../components/AppHeader'

export default function Inventory() {
  const { user } = useAuth()
  const { householdUserIds } = useHousehold()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [aiText, setAiText] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('fresh')
  const [aiExpanded, setAiExpanded] = useState(false)
  const [showFreshConfirm, setShowFreshConfirm] = useState(false)
  const [inShopping, setInShopping] = useState({}) // {inventoryId: shoppingListId}

  useEffect(() => {
    if (user) {
      fetchItems()
      fetchShoppingLinks()
    }
  }, [user])

  async function fetchItems() {
    const { data } = await supabase
      .from('inventory')
      .select('*')
      .in('user_id', householdUserIds)
      .order('item_name', { ascending: true })
    setItems(data || [])
    setLoading(false)
  }

  async function fetchShoppingLinks() {
    const { data } = await supabase
      .from('shopping_list')
      .select('id, source_inventory_id')
      .in('user_id', householdUserIds)
      .not('source_inventory_id', 'is', null)
    const map = {}
    ;(data || []).forEach((s) => { map[s.source_inventory_id] = s.id })
    setInShopping(map)
  }

  // Filter items by active tab and stock status
  const tabItems = items.filter((i) => i.section === activeTab)
  const inStock = tabItems.filter((i) => i.in_stock)
  const outOfStock = tabItems.filter((i) => !i.in_stock)
  const freshCount = items.filter((i) => i.section === 'fresh').length
  const spicesCount = items.filter((i) => i.section === 'spices').length
  const householdCount = items.filter((i) => i.section === 'household').length

  async function addItem(e) {
    e.preventDefault()
    if (!newName.trim()) return
    const { data } = await supabase
      .from('inventory')
      .insert({
        user_id: user.id,
        item_name: newName.trim(),
        quantity: null,
        category: 'other',
        section: activeTab,
        in_stock: true,
      })
      .select()
      .single()
    if (data) setItems((prev) => [...prev, data])
    setNewName('')
  }

  async function toggleOutOfStock(item) {
    // Mark as out of stock — clear quantity
    const { error } = await supabase
      .from('inventory')
      .update({ in_stock: false, quantity: null, updated_at: new Date().toISOString() })
      .eq('id', item.id)
    if (!error) {
      setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, in_stock: false, quantity: null } : i))
    }
  }

  async function toggleShopping(item) {
    if (inShopping[item.id]) {
      // Already in shopping — remove it
      await supabase.from('shopping_list').delete().eq('id', inShopping[item.id])
      setInShopping((prev) => { const n = { ...prev }; delete n[item.id]; return n })
    } else {
      // Add to shopping
      const { data } = await supabase.from('shopping_list').insert({
        user_id: user.id,
        item_name: item.item_name,
        quantity: null,
        category: item.category || 'other',
        source_inventory_id: item.id,
      }).select('id').single()
      if (data) {
        setInShopping((prev) => ({ ...prev, [item.id]: data.id }))
      }
    }
  }

  async function addToShoppingList(item) {
    // For in-stock spices: grey out and add to shopping
    const { data } = await supabase.from('shopping_list').insert({
      user_id: user.id,
      item_name: item.item_name,
      quantity: null,
      category: item.category || 'other',
      source_inventory_id: item.id,
    }).select('id').single()
    if (data) {
      setInShopping((prev) => ({ ...prev, [item.id]: data.id }))
      if (item.section === 'spices' && item.in_stock) {
        await supabase
          .from('inventory')
          .update({ in_stock: false, quantity: null, updated_at: new Date().toISOString() })
          .eq('id', item.id)
        setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, in_stock: false, quantity: null } : i))
      }
    }
  }

  async function deleteItem(item) {
    const { error } = await supabase.from('inventory').delete().eq('id', item.id)
    if (!error) {
      setItems((prev) => prev.filter((i) => i.id !== item.id))
    }
  }

  async function resetTab() {
    const tabIds = items.filter((i) => i.section === activeTab).map((i) => i.id)
    if (tabIds.length === 0) return
    const { error } = await supabase
      .from('inventory')
      .update({ in_stock: false, quantity: null, updated_at: new Date().toISOString() })
      .in('id', tabIds)
    if (!error) {
      setItems((prev) => prev.map((i) => i.section === activeTab ? { ...i, in_stock: false, quantity: null } : i))
      // Also remove any shopping list entries linked to these items
      const shoppingIdsToRemove = tabIds.map((id) => inShopping[id]).filter(Boolean)
      if (shoppingIdsToRemove.length > 0) {
        await supabase.from('shopping_list').delete().in('id', shoppingIdsToRemove)
        setInShopping((prev) => {
          const n = { ...prev }
          tabIds.forEach((id) => delete n[id])
          return n
        })
      }
    }
    setShowFreshConfirm(false)
  }

  async function parseWithAI() {
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
        const existingNames = items.map((i) => i.item_name.toLowerCase().trim().replace(/s$/, ''))
        const toUpdate = []
        const toInsert = []

        for (const p of parsed) {
          const normalizedName = p.name.toLowerCase().trim().replace(/s$/, '')
          const match = items.find((i) => i.item_name.toLowerCase().trim().replace(/s$/, '') === normalizedName)
          if (match) {
            toUpdate.push({ id: match.id })
          } else {
            toInsert.push({
              user_id: user.id,
              item_name: p.name,
              quantity: null,
              category: p.category || 'other',
              section: p.section || 'fresh',
              in_stock: true,
            })
          }
        }

        // Reactivate existing matches
        for (const u of toUpdate) {
          await supabase
            .from('inventory')
            .update({ in_stock: true, quantity: null, updated_at: new Date().toISOString() })
            .eq('id', u.id)
        }

        // Insert new items
        let newData = []
        if (toInsert.length > 0) {
          const { data } = await supabase.from('inventory').insert(toInsert).select()
          newData = data || []
        }

        // Refresh state
        setItems((prev) => {
          const updated = prev.map((i) => {
            const match = toUpdate.find((u) => u.id === i.id)
            return match ? { ...i, in_stock: true, quantity: null } : i
          })
          return [...updated, ...newData]
        })

        setAiText('')
        setAiExpanded(false)
      }
    } catch (err) {
      console.error('AI parse error:', err)
    }
    setAiLoading(false)
  }

  return (
    <div className="min-h-dvh pb-24 bg-warm-bg">
      <AppHeader title="Inventory" subtitle={`${inStock.length} in stock`} />

      {/* Tab bar */}
      <div className="mx-5 -mt-3 bg-accent-dark rounded-xl flex overflow-hidden mb-3">
        {[
          { key: 'fresh', label: '\uD83E\uDD6C', count: freshCount },
          { key: 'spices', label: '\uD83E\uDDC2', count: spicesCount },
          { key: 'household', label: '\uD83C\uDFE0', count: householdCount },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex-1 py-2.5 text-xs font-semibold min-h-0 transition-colors ${
              activeTab === t.key ? 'bg-white text-accent' : 'bg-transparent text-white/60'
            }`}
          >
            {t.label} {t.count}
          </button>
        ))}
      </div>

      {/* AI quick-add (collapsible) */}
      <div className="px-5 pb-2">
        <button
          onClick={() => setAiExpanded(!aiExpanded)}
          className="w-full text-left text-xs font-semibold text-warm-text-dim uppercase tracking-wide flex items-center gap-1.5 py-1 bg-transparent min-h-0"
        >
          <span>{aiExpanded ? '\u25BC' : '\u25B6'}</span>
          &#129302; Quick add with AI
        </button>
        {aiExpanded && (
          <div className="bg-warm-card rounded-xl border border-warm-border p-3 mt-1.5">
            <textarea
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
              placeholder="Type anything — items go to the right section automatically.&#10;&#10;e.g. &quot;2 onions, cumin, toilet paper, 500g rice, milk&quot;"
              rows={3}
              className="w-full py-2 px-3 rounded-lg bg-warm-bg border border-warm-border text-sm text-warm-text outline-none focus:border-accent resize-none"
            />
            <button
              onClick={parseWithAI}
              disabled={aiLoading || !aiText.trim()}
              className="mt-2 w-full py-2.5 rounded-xl bg-accent text-white text-sm font-semibold disabled:opacity-50"
            >
              {aiLoading ? 'Parsing...' : 'Add items'}
            </button>
          </div>
        )}
      </div>

      {/* Manual add — adds to active tab */}
      <form onSubmit={addItem} className="flex gap-2 px-5 pb-3">
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={`Add to ${activeTab === 'fresh' ? 'Fresh' : activeTab === 'spices' ? 'Spices' : 'Household'}...`} className="flex-1 py-2.5 px-3 rounded-xl bg-warm-card border border-warm-border text-sm outline-none focus:border-accent" />
        <button type="submit" disabled={!newName.trim()} className="px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold min-w-0 disabled:opacity-50">+</button>
      </form>

      {/* Item list */}
      <div className="px-5 flex flex-col gap-1.5">
        {loading ? (
          <p className="text-center text-warm-text-dim py-10 text-sm">Loading...</p>
        ) : tabItems.length === 0 ? (
          <p className="text-center text-warm-text-dim py-10 text-sm">No items in {activeTab === 'fresh' ? 'fresh' : activeTab === 'spices' ? 'spices & pantry' : 'household'}</p>
        ) : (
          <>
            {/* In Stock section */}
            {inStock.length > 0 && (
              <>
                <h3 className="text-xs uppercase tracking-wide text-warm-text-dim font-semibold mt-1 mb-0.5">In Stock ({inStock.length})</h3>
                {inStock.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 bg-warm-card rounded-xl px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold">{item.item_name}</span>
                    </div>
                    {/* Spices: show cart icon on active items */}
                    {activeTab === 'spices' && (
                      <button
                        onClick={() => addToShoppingList(item)}
                        className={`text-sm min-h-0 min-w-8 bg-transparent ${inShopping[item.id] ? 'text-accent' : 'text-warm-text-dim'}`}
                        disabled={!!inShopping[item.id]}
                      >
                        {inShopping[item.id] ? '\u2713' : '\uD83D\uDED2'}
                      </button>
                    )}
                    <button
                      onClick={() => toggleOutOfStock(item)}
                      className="text-red-400 text-xs min-h-0 min-w-6 bg-transparent"
                    >
                      &#10005;
                    </button>
                  </div>
                ))}
              </>
            )}

            {/* Not in Stock section */}
            {outOfStock.length > 0 && (
              <>
                <h3 className="text-xs uppercase tracking-wide text-warm-text-dim font-semibold mt-3 mb-0.5">Not in Stock ({outOfStock.length})</h3>
                {outOfStock.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center rounded-xl overflow-hidden"
                  >
                    {/* Main area: tap to toggle shopping */}
                    <button
                      onClick={() => toggleShopping(item)}
                      className={`flex items-center gap-2 flex-1 min-w-0 px-3 py-2.5 min-h-0 text-left transition-colors ${
                        inShopping[item.id]
                          ? 'bg-accent/10'
                          : 'bg-warm-card/50 active:bg-warm-card/70'
                      }`}
                    >
                      <span className={`text-sm ${inShopping[item.id] ? 'text-accent' : 'text-warm-text-dim'}`}>
                        {inShopping[item.id] ? '\u2713 \uD83D\uDED2' : '\uD83D\uDED2'}
                      </span>
                      <span className={`text-sm ${inShopping[item.id] ? 'text-accent font-semibold' : 'text-warm-text-dim'}`}>
                        {item.item_name}
                      </span>
                    </button>
                    {/* Delete button: separate, visually distinct */}
                    <button
                      onClick={() => deleteItem(item)}
                      className="px-3 py-2.5 min-h-0 bg-red-50 text-red-400 text-xs border-l border-warm-border"
                    >
                      &#10005;
                    </button>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>

      {/* Reset button — all tabs */}
      {inStock.length > 0 && (
        <div className="px-5 mt-4">
          {showFreshConfirm ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm text-amber-800 font-semibold mb-1">Mark all {activeTab === 'fresh' ? 'fresh' : activeTab === 'spices' ? 'spices' : 'household'} items as out of stock?</p>
              <p className="text-xs text-amber-600 mb-3">You can then re-add what you currently have.</p>
              <div className="flex gap-2">
                <button
                  onClick={resetTab}
                  className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-semibold min-h-0"
                >
                  Yes, reset
                </button>
                <button
                  onClick={() => setShowFreshConfirm(false)}
                  className="px-4 py-2 rounded-lg bg-warm-card border border-warm-border text-sm text-warm-text min-h-0"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowFreshConfirm(true)}
              className="w-full py-3 rounded-xl bg-warm-card border border-warm-border text-sm font-semibold text-warm-text active:scale-[0.98] transition-transform"
            >
              &#128260; Reset All
            </button>
          )}
        </div>
      )}
    </div>
  )
}
