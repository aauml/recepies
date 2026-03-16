import { useParams, useNavigate } from 'react-router-dom'

export default function EditRecipe() {
  const { id } = useParams()
  const navigate = useNavigate()

  return (
    <div className="min-h-dvh pb-24 bg-warm-bg">
      <div className="bg-accent text-white px-5 pt-4 pb-4 safe-top flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-white/80 min-h-0 min-w-0 bg-transparent text-sm">
          &#8592; Back
        </button>
        <h1 className="text-lg font-bold">Edit Recipe</h1>
      </div>
      <div className="px-5 py-10 text-center">
        <p className="text-warm-text-dim text-sm">Recipe editing will reuse the Add Recipe form with pre-filled data.</p>
        <p className="text-warm-text-dim text-sm mt-2 opacity-60">&#10024; AI-powered editing &mdash; Coming soon</p>
      </div>
    </div>
  )
}
