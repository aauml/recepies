import { sql } from './_lib/db.js'
import { createHandler } from './_lib/handler.js'

export default createHandler({
  async GET(req, res, userId) {
    // Support ?ids=id1,id2,id3 for batch profile lookup
    const { ids } = req.query
    if (ids) {
      const idList = ids.split(',').map((s) => s.trim()).filter(Boolean)
      const profiles = await sql`
        SELECT id, display_name, avatar_url FROM profiles
        WHERE id = ANY(${idList})`
      return res.json(profiles)
    }

    // Default: return current user's profile
    const [profile] = await sql`
      SELECT * FROM profiles WHERE id = ${userId}`
    return res.json(profile || null)
  },

  async PUT(req, res, userId) {
    const { display_name, diet_preferences } = req.body
    const [updated] = await sql`
      UPDATE profiles SET
        display_name = COALESCE(${display_name ?? null}, display_name),
        diet_preferences = COALESCE(${diet_preferences !== undefined ? JSON.stringify(diet_preferences) : null}::jsonb, diet_preferences),
        updated_at = NOW()
      WHERE id = ${userId}
      RETURNING *`
    if (!updated)
      return res.status(404).json({ error: 'Profile not found' })
    return res.json(updated)
  },
})
