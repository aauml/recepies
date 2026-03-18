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
  const [addedToShopping, setAddedToShopping] = useState({}) // {itemId: true}

  useEffect(() => {
    if (user) fetchItems()
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

  async function addToShoppingList(item) {
    const { error } = await supabase.from('shopping_list').insert({
      user_id: user.id,
      item_name: item.item_name,
      quantity: item.quantity || null,
      category: item.category || 'other',
      source_inventory_id: item.id,
    })
    if (!error) {
      // For spices: also grey out the item
      if (item.section === 'spices' && item.in_stock) {
        await supabase
          .from('inventory')
          .update({ in_stock: false, quantity: null, updated_at: new Date().toISOString() })
          .eq('id', item.id)
        setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, in_stock: false, quantity: null } : i))
      }
      setAddedToShopping((prev) => ({ ...prev, [item.id]: true }))
      setTimeout(() => setAddedToShopping((prev) => ({ ...prev, [item.id]: false })), 2000)
    }
  }

  async function startFreshCount() {
    const freshIds = items.filter((i) => i.section === 'fresh').map((i) => i.id)
    if (freshIds.length === 0) return
    const { error } = await supabase
      .from('inventory')
      .update({ in_stock: false, quantity: null, updated_at: new Date().toISOString() })
      .in('id', freshIds)
    if (!error) {
      setItems((prev) => prev.map((i) => i.section === 'fresh' ? { ...i, in_stock: false, quantity: null } : i))
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
            toUpdate.push({ id: match.id, quantity: p.quantity || null })
          } else {
            toInsert.push({
              user_id: user.id,
              item_name: p.name,
              quantity: p.quantity || null,
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
            .update({ in_stock: true, quantity: u.quantity, updated_at: new Date().toISOString() })
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
            return match ? { ...i, in_stock: true, quantity: match.quantity } : i
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
                      {item.quantity && <span className="text-xs text-accent font-semibold ml-2">{item.quantity}</span>}
                    </div>
                    {/* Spices: show cart icon on active items */}
                    {activeTab === 'spices' && (
                      <button
                        onClick={() => addToShoppingList(item)}
                        className={`text-sm min-h-0 min-w-8 bg-transparent ${addedToShopping[item.id] ? 'text-green-500' : 'text-warm-text-dim'}`}
                        disabled={addedToShopping[item.id]}
                      >
                        {addedToShopping[item.id] ? '\u2713' : '\uD83D\uDED2'}
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
                    onClick={() => !addedToShopping[item.id] && addToShoppingList(item)}
                    className="flex items-center gap-3 bg-warm-card/50 rounded-xl px-3 py-2.5 opacity-50 cursor-pointer active:opacity-70"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-warm-text-dim">{item.item_name}</span>
                    </div>
                    <span className={`text-sm min-w-8 text-center ${addedToShopping[item.id] ? 'text-green-500' : 'text-warm-text-dim'}`}>
                      {addedToShopping[item.id] ? '\u2713' : '\uD83D\uDED2'}
                    </span>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>

      {/* Start Fresh Count button — only on Fresh tab */}
      {activeTab === 'fresh' && inStock.length > 0 && (
        <div className="px-5 mt-4">
          {showFreshConfirm ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm text-amber-800 font-semibold mb-1">Mark all fresh items as out of stock?</p>
              <p className="text-xs text-amber-600 mb-3">You can then re-add what you currently have.</p>
              <div className="flex gap-2">
                <button
                  onClick={startFreshCount}
                  className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-semibold min-h-0"
                >
                  Yes, start fresh
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
              &#128260; Start Fresh Count
            </button>
          )}
        </div>
      )}
    </div>
  )
}
