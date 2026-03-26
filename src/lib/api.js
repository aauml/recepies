// API client for Neon backend — replaces supabase.js
// All requests go through Vercel API routes with Clerk JWT auth

let getTokenFn = null

export function setGetToken(fn) {
  getTokenFn = fn
}

async function fetchWithAuth(url, options = {}) {
  const token = getTokenFn ? await getTokenFn() : null
  const headers = { ...options.headers }
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (options.body && typeof options.body === 'string') {
    headers['Content-Type'] = 'application/json'
  }
  const resp = await fetch(url, { ...options, headers })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }))
    throw new Error(err.error || `Request failed: ${resp.status}`)
  }
  return resp.json()
}

export const api = {
  recipes: {
    list: () => fetchWithAuth('/api/recipes'),
    get: (id) => fetchWithAuth(`/api/recipes/${id}`),
    create: (data) => fetchWithAuth('/api/recipes', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => fetchWithAuth(`/api/recipes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => fetchWithAuth(`/api/recipes/${id}`, { method: 'DELETE' }),
  },

  shoppingList: {
    list: () => fetchWithAuth('/api/shopping-list'),
    create: (data) => fetchWithAuth('/api/shopping-list', { method: 'POST', body: JSON.stringify(data) }),
    createBatch: (items) => fetchWithAuth('/api/shopping-list', { method: 'POST', body: JSON.stringify(items) }),
    update: (id, data) => fetchWithAuth('/api/shopping-list', { method: 'PUT', body: JSON.stringify({ id, ...data }) }),
    delete: (id) => fetchWithAuth('/api/shopping-list', { method: 'DELETE', body: JSON.stringify({ id }) }),
    deleteBatch: (ids) => fetchWithAuth('/api/shopping-list', { method: 'DELETE', body: JSON.stringify({ ids }) }),
  },

  inventory: {
    list: () => fetchWithAuth('/api/inventory'),
    create: (data) => fetchWithAuth('/api/inventory', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => fetchWithAuth('/api/inventory', { method: 'PUT', body: JSON.stringify({ id, ...data }) }),
    updateBatch: (ids, data) => fetchWithAuth('/api/inventory', { method: 'PUT', body: JSON.stringify({ ids, ...data }) }),
    delete: (id) => fetchWithAuth('/api/inventory', { method: 'DELETE', body: JSON.stringify({ id }) }),
  },

  cookLog: {
    list: () => fetchWithAuth('/api/cook-log'),
    create: (data) => fetchWithAuth('/api/cook-log', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id) => fetchWithAuth('/api/cook-log', { method: 'DELETE', body: JSON.stringify({ id }) }),
    deleteBatch: (ids) => fetchWithAuth('/api/cook-log', { method: 'DELETE', body: JSON.stringify({ ids }) }),
  },

  profiles: {
    get: () => fetchWithAuth('/api/profiles'),
    getMany: (ids) => fetchWithAuth(`/api/profiles?ids=${ids.join(',')}`),
    update: (data) => fetchWithAuth('/api/profiles', { method: 'PUT', body: JSON.stringify(data) }),
  },

  households: {
    get: (email) => fetchWithAuth(`/api/households${email ? `?email=${encodeURIComponent(email)}` : ''}`),
    create: (name) => fetchWithAuth('/api/households', { method: 'POST', body: JSON.stringify({ name }) }),
    delete: () => fetchWithAuth('/api/households', { method: 'DELETE' }),
  },

  householdInvites: {
    create: (email) => fetchWithAuth('/api/households', { method: 'POST', body: JSON.stringify({ action: 'invite', email }) }),
    accept: (id) => fetchWithAuth('/api/households', { method: 'PUT', body: JSON.stringify({ action: 'respond-invite', id, status: 'accepted' }) }),
    decline: (id) => fetchWithAuth('/api/households', { method: 'PUT', body: JSON.stringify({ action: 'respond-invite', id, status: 'declined' }) }),
    delete: (id) => fetchWithAuth('/api/households', { method: 'DELETE', body: JSON.stringify({ action: 'delete-invite', id }) }),
  },

  householdMembers: {
    delete: (userId) => fetchWithAuth('/api/households', { method: 'PUT', body: JSON.stringify({ action: 'remove-member', userId }) }),
  },
}
