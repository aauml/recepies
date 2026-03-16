import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function Inventory() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newQty, setNewQty] = useState('')

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

  return (
    <div className="min-h-dvh pb-24 bg-warm-bg">
      <header className="bg-accent text-white px-5 pt-4 pb-4 safe-top">
        <h1 className="text-lg font-bold">Inventory</h1>
        <p className="text-white/60 text-xs mt-0.5">What you have at home</p>
      </header>

      <form onSubmit={addItem} className="flex gap-2 px-5 py-3">
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
                {item.quantity && <span className="text-xs text-accent ml-2">{item.quantity}</span>}
              </div>
              <button onClick={() => removeItem(item.id)} className="text-red-400 text-xs min-h-0 min-w-6 bg-transparent">&#10005;</button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
