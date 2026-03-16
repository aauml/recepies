import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import AppHeader from '../components/AppHeader'
import ProfileMenu from '../components/ProfileMenu'
import InviteBanner from '../components/InviteBanner'

const TAG_FILTERS = [
  { label: 'All', value: null },
  { label: 'Soups', value: 'soup', icon: '\uD83E\uDD63' },
  { label: 'Mains', value: 'main', icon: '\uD83C\uDF5D' },
  { label: 'Sides', value: 'side', icon: '\uD83E\uDD57' },
  { label: 'Desserts', value: 'dessert', icon: '\uD83C\uDF70' },
  { label: 'Breads', value: 'bread', icon: '\uD83C\uDF5E' },
  { label: 'Sauces', value: 'sauce', icon: '\uD83E\uDED9' },
  { label: 'Vegan', value: 'vegan', icon: '\uD83C\uDF31' },
  { label: 'Meal Prep', value: 'meal-prep', icon: '\uD83D\uDCE6' },
]

export default function Recipes() {
  const { user } = useAuth()
  const [recipes, setRecipes] = useState([])
  const [profiles, setProfiles] = useState({})
  const [search, setSearch] = useState('')
  const [activeTag, setActiveTag] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileOpen, setProfileOpen] = useState(false)

  useEffect(() => {
    fetchRecipes()
  }, [])

  async function fetchRecipes() {
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error) {
      setRecipes(data || [])
      // Fetch creator profiles
      const creatorIds = [...new Set((data || []).filter(r => r.created_by).map(r => r.created_by))]
      if (creatorIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', creatorIds)
        const map = {}
        ;(profs || []).forEach(p => { map[p.id] = p })
        setProfiles(map)
      }
    }
    setLoading(false)
  }

  async function addToShoppingList(recipe) {
    const ingredients = recipe.ingredients_1bowl || []
    const items = ingredients.flatMap((group) =>
      (group.items || []).map((item) => ({
        user_id: user.id,
        item_name: item.name,
        quantity: `${item.qty || ''}${item.unit || ''}`.trim(),
        category: item.category || 'other',
        recipe_id: recipe.id,
        checked: false,
      }))
    )
    if (items.length > 0) {
      await supabase.from('shopping_list').insert(items)
    }
  }

  const filtered = recipes.filter((r) => {
    if (search && !r.title?.toLowerCase().includes(search.toLowerCase())) return false
    if (activeTag && !(r.tags || []).includes(activeTag)) return false
    return true
  })

  const avatar = user?.user_metadata?.avatar_url
  const initials = (user?.user_metadata?.full_name || user?.email || 'U')[0].toUpperCase()

  return (
    <div className="flex flex-col min-h-dvh pb-20">
      {/* Header */}
      <AppHeader title="My Thermomix">
        <button
          onClick={() => setProfileOpen(true)}
          className="w-8 h-8 min-w-8 rounded-full bg-white/25 flex items-center justify-center text-[0.85em] overflow-hidden shrink-0"
        >
          {avatar ? (
            <img src={avatar} alt="" className="w-full h-full object-cover" />
          ) : (
            initials
          )}
        </button>
      </AppHeader>

      {/* Profile menu */}
      <ProfileMenu isOpen={profileOpen} onClose={() => setProfileOpen(false)} />

      {/* Invite banner */}
      <InviteBanner />

      {/* Search bar */}
      <div className="bg-accent-dark px-5 py-3.5">
        <div className="flex gap-2.5">
          <input
            type="text"
            placeholder="Search recipes, ingredients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 py-3 px-4 rounded-xl bg-white/15 text-white text-[0.9em] border-none outline-none placeholder:text-white/50"
          />
          <Link
            to="/recipes/new"
            className="w-11 h-11 rounded-xl bg-white text-accent text-2xl font-bold flex items-center justify-center active:scale-95 transition-transform no-underline"
          >
            +
          </Link>
        </div>
      </div>

      {/* Tag filters */}
      <div className="relative">
        <div className="flex gap-2 px-5 py-3 overflow-x-auto hide-scrollbar">
          {TAG_FILTERS.map((tag) => (
            <button
              key={tag.label}
              onClick={() => setActiveTag(tag.value)}
              className={`px-4 py-2 rounded-full whitespace-nowrap text-[0.85em] font-semibold border-[1.5px] transition-all ${
                activeTag === tag.value
                  ? 'bg-accent text-white border-accent'
                  : 'bg-warm-card text-warm-text-dim border-warm-border'
              }`}
            >
              {tag.icon ? `${tag.icon} ` : ''}{tag.label}
            </button>
          ))}
        </div>
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-warm-bg to-transparent pointer-events-none" />
      </div>

      {/* Recipe list */}
      <div className="px-5 flex flex-col gap-3.5">
        {loading ? (
          <p className="text-center text-warm-text-dim py-10 text-sm">Loading recipes...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-warm-text-dim text-sm">No recipes yet.</p>
            <Link to="/recipes/new" className="text-accent font-semibold text-sm mt-2 inline-block">
              Add your first recipe
            </Link>
          </div>
        ) : (
          filtered.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              creator={profiles[recipe.created_by]}
              onShop={() => addToShoppingList(recipe)}
            />
          ))
        )}
      </div>
    </div>
  )
}

function RecipeCard({ recipe, creator, onShop }) {
  const [shopMsg, setShopMsg] = useState(false)

  const handleShop = async () => {
    await onShop()
    setShopMsg(true)
  }

  return (
    <div className="bg-warm-card rounded-2xl overflow-hidden shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
      <Link to={`/recipes/${recipe.id}`} className="no-underline text-inherit">
        <div className="flex gap-3.5 p-4">
          <div className="w-[72px] h-[72px] rounded-xl bg-accent-light flex items-center justify-center text-[2em] shrink-0 relative">
            {recipe.thumbnail_emoji || '\uD83C\uDF7D'}
            {creator?.avatar_url && (
              <img
                src={creator.avatar_url}
                alt=""
                className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-warm-card object-cover"
              />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[1em] font-bold leading-tight mb-1">{recipe.title}</h3>
            <p className="text-[0.82em] text-warm-text-dim leading-snug line-clamp-2">
              {recipe.description}
            </p>
          </div>
        </div>
      </Link>

      <div className="flex gap-3 px-4 pb-2.5 text-[0.75em] text-warm-text-dim">
        {recipe.time_1bowl && <span>&#9201; {recipe.time_1bowl}</span>}
        {recipe.servings_1bowl && <span>&#127860; {recipe.servings_1bowl}</span>}
        {creator && <span>by {creator.display_name}</span>}
      </div>

      {(recipe.tags || []).length > 0 && (
        <div className="flex gap-1.5 px-4 pb-3">
          {recipe.tags.map((tag) => (
            <span
              key={tag}
              className="text-[0.68em] px-2 py-0.5 bg-accent-light text-accent-dark rounded-lg uppercase tracking-wide font-semibold"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex border-t border-[#f0ebe4]">
        <Link
          to={`/recipes/${recipe.id}/cook`}
          className="flex-1 py-2.5 text-center text-accent font-bold text-[0.8em] no-underline active:bg-warm-bg flex items-center justify-center gap-1"
        >
          &#128293; Cook
        </Link>
        <button
          onClick={handleShop}
          disabled={shopMsg}
          className={`flex-1 py-2.5 font-semibold text-[0.8em] border-l border-r border-[#f0ebe4] bg-transparent flex items-center justify-center gap-1 ${
            shopMsg ? 'text-warm-text-dim opacity-50' : 'text-green active:bg-warm-bg'
          }`}
        >
          {shopMsg ? '\u2713 Added' : '\uD83D\uDED2 Shop'}
        </button>
        <Link
          to={`/recipes/${recipe.id}/edit`}
          className="flex-1 py-2.5 text-center text-warm-text-dim font-semibold text-[0.8em] no-underline active:bg-warm-bg flex items-center justify-center gap-1"
        >
          &#9998; Edit
        </Link>
      </div>
    </div>
  )
}
