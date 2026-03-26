import { getAuthUserId } from './auth.js'

// Wraps route handlers with CORS + auth
export function createHandler(handlers) {
  return async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type,Authorization'
    )
    if (req.method === 'OPTIONS') return res.status(200).end()

    try {
      const userId = await getAuthUserId(req)
      const fn = handlers[req.method]
      if (!fn) return res.status(405).json({ error: 'Method not allowed' })
      await fn(req, res, userId)
    } catch (err) {
      if (
        err.message === 'No authorization token' ||
        err.message === 'Invalid token'
      ) {
        return res.status(401).json({ error: err.message })
      }
      console.error('API error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }
}
