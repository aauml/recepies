import { sql } from './_lib/db.js'
import { getHouseholdMemberIds } from './_lib/household.js'
import { createHandler } from './_lib/handler.js'

export default createHandler({
  async GET(req, res, userId) {
    const { id } = req.query
    const memberIds = await getHouseholdMemberIds(userId)

    // Single recipe by id
    if (id) {
      const [recipe] = await sql`
        SELECT r.*, p.display_name AS creator_name, p.avatar_url AS creator_avatar
        FROM recipes r
        LEFT JOIN profiles p ON r.created_by = p.id
        WHERE r.id = ${id}
          AND r.created_by = ANY(${memberIds})`
      if (!recipe) return res.status(404).json({ error: 'Recipe not found' })
      return res.json(recipe)
    }

    // List all recipes
    const recipes = await sql`
      SELECT r.*, p.display_name AS creator_name, p.avatar_url AS creator_avatar
      FROM recipes r
      LEFT JOIN profiles p ON r.created_by = p.id
      WHERE r.created_by = ANY(${memberIds})
      ORDER BY r.created_at DESC`
    return res.json(recipes)
  },

  async POST(req, res, userId) {
    const data = req.body
    const [recipe] = await sql`
      INSERT INTO recipes (
        title, description, servings_1bowl, servings_2bowl,
        time_1bowl, time_2bowl, tags, source_urls, thumbnail_emoji,
        ingredients_1bowl, ingredients_2bowl, steps_1bowl, steps_2bowl,
        nutrition, insulin_load, created_by
      ) VALUES (
        ${data.title},
        ${data.description || null},
        ${data.servings_1bowl || null},
        ${data.servings_2bowl || null},
        ${data.time_1bowl || null},
        ${data.time_2bowl || null},
        ${data.tags || []},
        ${data.source_urls || []},
        ${data.thumbnail_emoji || '🍽'},
        ${JSON.stringify(data.ingredients_1bowl || null)},
        ${JSON.stringify(data.ingredients_2bowl || null)},
        ${JSON.stringify(data.steps_1bowl || null)},
        ${JSON.stringify(data.steps_2bowl || null)},
        ${JSON.stringify(data.nutrition || null)},
        ${data.insulin_load || null},
        ${userId}
      )
      RETURNING *`
    return res.json(recipe)
  },

  async PUT(req, res, userId) {
    const { id } = req.query
    if (!id) return res.status(400).json({ error: 'Missing recipe id' })
    const memberIds = await getHouseholdMemberIds(userId)
    const data = req.body

    const [existing] = await sql`
      SELECT id FROM recipes
      WHERE id = ${id} AND created_by = ANY(${memberIds})`
    if (!existing)
      return res.status(404).json({ error: 'Recipe not found' })

    const [updated] = await sql`
      UPDATE recipes SET
        title = COALESCE(${data.title ?? null}, title),
        description = COALESCE(${data.description ?? null}, description),
        servings_1bowl = COALESCE(${data.servings_1bowl ?? null}, servings_1bowl),
        servings_2bowl = COALESCE(${data.servings_2bowl ?? null}, servings_2bowl),
        time_1bowl = COALESCE(${data.time_1bowl ?? null}, time_1bowl),
        time_2bowl = COALESCE(${data.time_2bowl ?? null}, time_2bowl),
        tags = COALESCE(${data.tags ?? null}, tags),
        source_urls = COALESCE(${data.source_urls ?? null}, source_urls),
        thumbnail_emoji = COALESCE(${data.thumbnail_emoji ?? null}, thumbnail_emoji),
        ingredients_1bowl = COALESCE(${data.ingredients_1bowl !== undefined ? JSON.stringify(data.ingredients_1bowl) : null}::jsonb, ingredients_1bowl),
        ingredients_2bowl = COALESCE(${data.ingredients_2bowl !== undefined ? JSON.stringify(data.ingredients_2bowl) : null}::jsonb, ingredients_2bowl),
        steps_1bowl = COALESCE(${data.steps_1bowl !== undefined ? JSON.stringify(data.steps_1bowl) : null}::jsonb, steps_1bowl),
        steps_2bowl = COALESCE(${data.steps_2bowl !== undefined ? JSON.stringify(data.steps_2bowl) : null}::jsonb, steps_2bowl),
        nutrition = COALESCE(${data.nutrition !== undefined ? JSON.stringify(data.nutrition) : null}::jsonb, nutrition),
        insulin_load = COALESCE(${data.insulin_load ?? null}, insulin_load),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *`
    return res.json(updated)
  },

  async DELETE(req, res, userId) {
    const { id } = req.query
    if (!id) return res.status(400).json({ error: 'Missing recipe id' })
    const memberIds = await getHouseholdMemberIds(userId)

    const result = await sql`
      DELETE FROM recipes
      WHERE id = ${id} AND created_by = ANY(${memberIds})
      RETURNING id`
    if (result.length === 0)
      return res.status(404).json({ error: 'Recipe not found' })
    return res.json({ deleted: true, id: result[0].id })
  },
})
