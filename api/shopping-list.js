import { sql } from './_lib/db.js'
import { getHouseholdMemberIds } from './_lib/household.js'
import { createHandler } from './_lib/handler.js'

export default createHandler({
  async GET(req, res, userId) {
    const memberIds = await getHouseholdMemberIds(userId)
    const items = await sql`
      SELECT sl.*, r.title AS recipe_title, r.thumbnail_emoji AS recipe_emoji
      FROM shopping_list sl
      LEFT JOIN recipes r ON sl.recipe_id = r.id
      WHERE sl.user_id = ANY(${memberIds})
      ORDER BY sl.checked ASC, sl.created_at DESC`
    return res.json(items)
  },

  async POST(req, res, userId) {
    const data = req.body
    const items = Array.isArray(data) ? data : [data]
    const inserted = []
    for (const item of items) {
      const [row] = await sql`
        INSERT INTO shopping_list (
          name, quantity, unit, recipe_id, source_inventory_id, checked, user_id
        ) VALUES (
          ${item.name},
          ${item.quantity || null},
          ${item.unit || null},
          ${item.recipe_id || null},
          ${item.source_inventory_id || null},
          ${item.checked || false},
          ${userId}
        )
        RETURNING *`
      inserted.push(row)
    }
    return res.json(inserted.length === 1 ? inserted[0] : inserted)
  },

  async PUT(req, res, userId) {
    const { id, ...fields } = req.body
    if (!id) return res.status(400).json({ error: 'Missing id' })

    const memberIds = await getHouseholdMemberIds(userId)
    const [updated] = await sql`
      UPDATE shopping_list SET
        name = COALESCE(${fields.name ?? null}, name),
        quantity = COALESCE(${fields.quantity ?? null}, quantity),
        unit = COALESCE(${fields.unit ?? null}, unit),
        checked = COALESCE(${fields.checked ?? null}, checked),
        updated_at = NOW()
      WHERE id = ${id} AND user_id = ANY(${memberIds})
      RETURNING *`
    if (!updated)
      return res.status(404).json({ error: 'Item not found' })
    return res.json(updated)
  },

  async DELETE(req, res, userId) {
    const { id, ids } = req.body
    const memberIds = await getHouseholdMemberIds(userId)

    if (ids && Array.isArray(ids)) {
      const result = await sql`
        DELETE FROM shopping_list
        WHERE id = ANY(${ids}) AND user_id = ANY(${memberIds})
        RETURNING id`
      return res.json({ deleted: result.length, ids: result.map((r) => r.id) })
    }

    if (!id) return res.status(400).json({ error: 'Missing id or ids' })
    const result = await sql`
      DELETE FROM shopping_list
      WHERE id = ${id} AND user_id = ANY(${memberIds})
      RETURNING id`
    if (result.length === 0)
      return res.status(404).json({ error: 'Item not found' })
    return res.json({ deleted: true, id: result[0].id })
  },
})
