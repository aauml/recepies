import { sql } from './_lib/db.js'
import { getHouseholdMemberIds } from './_lib/household.js'
import { createHandler } from './_lib/handler.js'

export default createHandler({
  async GET(req, res, userId) {
    const memberIds = await getHouseholdMemberIds(userId)
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
        ${data.thumbnail_emoji || '\ud83c\udf7d'},
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
})
