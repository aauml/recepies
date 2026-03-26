import { sql } from './_lib/db.js'
import { getHouseholdMemberIds } from './_lib/household.js'
import { createHandler } from './_lib/handler.js'

export default createHandler({
  async GET(req, res, userId) {
    const memberIds = await getHouseholdMemberIds(userId)
    const items = await sql`
      SELECT i.*,
        (SELECT json_agg(json_build_object('id', sl.id, 'item_name', sl.item_name, 'checked', sl.checked))
         FROM shopping_list sl WHERE sl.source_inventory_id = i.id
        ) AS shopping_links
      FROM inventory i
      WHERE i.user_id = ANY(${memberIds})
      ORDER BY i.section ASC, i.item_name ASC`
    return res.json(items)
  },

  async POST(req, res, userId) {
    const data = req.body
    const [item] = await sql`
      INSERT INTO inventory (
        item_name, quantity, category, section, in_stock, user_id
      ) VALUES (
        ${data.item_name || data.name},
        ${data.quantity || null},
        ${data.category || null},
        ${data.section || 'fresh'},
        ${data.in_stock !== undefined ? data.in_stock : true},
        ${userId}
      )
      RETURNING *`
    return res.json(item)
  },

  async PUT(req, res, userId) {
    const { id, ids, ...fields } = req.body
    const memberIds = await getHouseholdMemberIds(userId)

    // Bulk update: { ids: [...], in_stock: true }
    if (ids && Array.isArray(ids)) {
      const result = await sql`
        UPDATE inventory SET
          in_stock = COALESCE(${fields.in_stock ?? null}, in_stock),
          quantity = COALESCE(${fields.quantity ?? null}, quantity),
          category = COALESCE(${fields.category ?? null}, category),
          section = COALESCE(${fields.section ?? null}, section),
          item_name = COALESCE(${fields.item_name ?? fields.name ?? null}, item_name),
          updated_at = NOW()
        WHERE id = ANY(${ids}) AND user_id = ANY(${memberIds})
        RETURNING *`
      return res.json(result)
    }

    // Single update
    if (!id) return res.status(400).json({ error: 'Missing id or ids' })
    const [updated] = await sql`
      UPDATE inventory SET
        in_stock = COALESCE(${fields.in_stock ?? null}, in_stock),
        quantity = COALESCE(${fields.quantity ?? null}, quantity),
        category = COALESCE(${fields.category ?? null}, category),
        section = COALESCE(${fields.section ?? null}, section),
        item_name = COALESCE(${fields.item_name ?? fields.name ?? null}, item_name),
        updated_at = NOW()
      WHERE id = ${id} AND user_id = ANY(${memberIds})
      RETURNING *`
    if (!updated)
      return res.status(404).json({ error: 'Item not found' })
    return res.json(updated)
  },

  async DELETE(req, res, userId) {
    const { id } = req.body
    if (!id) return res.status(400).json({ error: 'Missing id' })
    const memberIds = await getHouseholdMemberIds(userId)

    const result = await sql`
      DELETE FROM inventory
      WHERE id = ${id} AND user_id = ANY(${memberIds})
      RETURNING id`
    if (result.length === 0)
      return res.status(404).json({ error: 'Item not found' })
    return res.json({ deleted: true, id: result[0].id })
  },
})
