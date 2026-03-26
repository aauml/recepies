import { sql } from './_lib/db.js'
import { getHouseholdMemberIds } from './_lib/household.js'
import { createHandler } from './_lib/handler.js'

export default createHandler({
  async GET(req, res, userId) {
    const memberIds = await getHouseholdMemberIds(userId)
    const logs = await sql`
      SELECT cl.*, r.title AS recipe_title, r.thumbnail_emoji AS recipe_emoji
      FROM cook_log cl
      LEFT JOIN recipes r ON cl.recipe_id = r.id
      WHERE cl.user_id = ANY(${memberIds})
      ORDER BY cl.cooked_at DESC`
    return res.json(logs)
  },

  async POST(req, res, userId) {
    const data = req.body
    const [entry] = await sql`
      INSERT INTO cook_log (
        recipe_id, rating, feedback, servings_used, user_id
      ) VALUES (
        ${data.recipe_id},
        ${data.rating || null},
        ${data.feedback || null},
        ${data.servings_used || null},
        ${userId}
      )
      RETURNING *`
    return res.json(entry)
  },

  async DELETE(req, res, userId) {
    const { id, ids } = req.body
    const memberIds = await getHouseholdMemberIds(userId)

    if (ids && Array.isArray(ids)) {
      const result = await sql`
        DELETE FROM cook_log
        WHERE id = ANY(${ids}) AND user_id = ANY(${memberIds})
        RETURNING id`
      return res.json({ deleted: result.length, ids: result.map((r) => r.id) })
    }

    if (!id) return res.status(400).json({ error: 'Missing id or ids' })
    const result = await sql`
      DELETE FROM cook_log
      WHERE id = ${id} AND user_id = ANY(${memberIds})
      RETURNING id`
    if (result.length === 0)
      return res.status(404).json({ error: 'Entry not found' })
    return res.json({ deleted: true, id: result[0].id })
  },
})
