import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function Inventory() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newQty, setNewQty] = useState('')
  const [aiText, setAiText] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  useEffect(() => {
    if (user) fetchItems()
  }, [user])

  async function fetchItems() {
    const { data } = await supabase
      .from('inventory')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }

  async function addItem(e) {
    e.preventDefault()
    if (!newName.trim()) return
    const { data } = await supabase
      .from('inventory')
      .insert({ user_id: user.id, item_name: newName.trim(), quantity: newQty.trim() || null, category: 'other' })
      .select()
      .single()
    if (data) setItems([data, ...items])
    setNewName('')
    setNewQty('')
  }

  async function removeItem(id) {
    await supabase.from('inventory').delete().eq('id', id)
    setItems(items.filter((i) => i.id !== id))
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
        const rows = parsed.map((p) => ({
          user_id: user.id,
          item_name: p.name,
          quantity: p.quantity || null,
          category: p.category || 'other',
        }))
        const { data } = await supabase.from('inventory').insert(rows).select()
        if (data) setItems([...data, ...items])
        setAiText('')
      }
    } catch (err) {
      console.error('AI parse error:', err)
    }
    setAiLoading(false)
  }

  return (
    <div className="min-h-dvh pb-24 bg-warm-bg">
      <header className="bg-accent text-white px-5 pt-4 pb-4 safe-top">
        <h1 className="text-lg font-bold">Inventory</h1>
        <p className="text-white/60 text-xs mt-0.5">{items.length} items at home</p>
      </header>

      {/* AI text input */}
      <div className="px-5 py-3">
        <div className="bg-warm-card rounded-xl border border-warm-border p-3">
          <label className="text-xs font-semibold text-warm-text-dim uppercase tracking-wide block mb-1.5">
            &#129302; Quick add with AI
          </label>
          <textarea
            value={aiText}
            onChange={(e) => setAiText(e.target.value)}
            placeholder="Type or narrate what you have, e.g.: &quot;I have 2 onions, half a bag of rice about 500g, some milk, 3 eggs and a bunch of cilantro&quot;"
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
      </div>

      {/* Manual add */}
      <form onSubmit={addItem} className="flex gap-2 px-5 pb-3">
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Item name" className="flex-1 py-2.5 px-3 rounded-xl bg-warm-card border border-warm-border text-sm outline-none focus:border-accent" />
        <input value={newQty} onChange={(e) => setNewQty(e.target.value)} placeholder="Qty" className="w-20 py-2.5 px-3 rounded-xl bg-warm-card border border-warm-border text-sm outline-none focus:border-accent text-center" />
        <button type="submit" className="px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold min-w-0">Add</button>
      </form>

      <div className="px-5 flex flex-col gap-1.5">
        {loading ? (
          <p className="text-center text-warm-text-dim py-10 text-sm">Loading...</p>
        ) : items.length === 0 ? (
          <p className="text-center text-warm-text-dim py-10 text-sm">No items in inventory</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 bg-warm-card rounded-xl px-3 py-2.5">
              <div className="flex-1 min-w-0">
                <span className="text-sm">{item.item_name}</span>
                {item.quantity && <span className="text-xs text-accent font-semibold ml-2">{item.quantity}</span>}
              </div>
              <button onClick={() => removeItem(item.id)} className="text-red-400 text-xs min-h-0 min-w-6 bg-transparent">&#10005;</button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
