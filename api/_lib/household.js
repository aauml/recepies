import { sql } from './db.js'

export async function getHouseholdMemberIds(userId) {
  const rows = await sql`
    SELECT user_id FROM household_members
    WHERE household_id = (
      SELECT household_id FROM household_members WHERE user_id = ${userId} LIMIT 1
    )`
  return rows.length > 0 ? rows.map((r) => r.user_id) : [userId]
}
