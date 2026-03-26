import { sql } from './_lib/db.js'
import { createHandler } from './_lib/handler.js'

export default createHandler({
  async DELETE(req, res, userId) {
    const { userId: targetUserId } = req.body
    if (!targetUserId) return res.status(400).json({ error: 'Missing userId' })

    // Get user's household
    const [membership] = await sql`
      SELECT household_id, role FROM household_members
      WHERE user_id = ${userId}`
    if (!membership) return res.status(404).json({ error: 'No household found' })

    // User can remove themselves, or owner can remove anyone
    if (targetUserId === userId) {
      // Self-remove (leave)
      await sql`DELETE FROM household_members WHERE user_id = ${userId} AND household_id = ${membership.household_id}`
      return res.json({ removed: true })
    }

    // Owner removing another member
    if (membership.role !== 'owner') {
      return res.status(403).json({ error: 'Only owner can remove members' })
    }

    await sql`DELETE FROM household_members WHERE user_id = ${targetUserId} AND household_id = ${membership.household_id}`
    return res.json({ removed: true })
  },
})
