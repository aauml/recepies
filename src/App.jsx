import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import TabBar from './components/TabBar'
import Login from './pages/Login'
import Recipes from './pages/Recipes'
import RecipeDetail from './pages/RecipeDetail'
import CookingMode from './pages/CookingMode'
import AddRecipe from './pages/AddRecipe'
import EditRecipe from './pages/EditRecipe'
import ShoppingList from './pages/ShoppingList'
import Inventory from './pages/Inventory'
import History from './pages/History'

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-warm-bg">
        <div className="text-accent text-lg font-semibold animate-pulse">Loading...</div>
      </div>
    )
  }

  if (!user) return <Login />

  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to="/recipes" replace />} />
        <Route path="/recipes" element={<Recipes />} />
        <Route path="/recipes/new" element={<AddRecipe />} />
        <Route path="/recipes/:id" element={<RecipeDetail />} />
        <Route path="/recipes/:id/cook" element={<CookingMode />} />
        <Route path="/recipes/:id/edit" element={<EditRecipe />} />
        <Route path="/shopping" element={<ShoppingList />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/history" element={<History />} />
        <Route path="*" element={<Navigate to="/recipes" replace />} />
      </Routes>
      <Routes>
        <Route path="/recipes/:id/cook" element={null} />
        <Route path="*" element={<TabBar />} />
      </Routes>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
