import { sql } from './_lib/db.js'
import { createHandler } from './_lib/handler.js'

export default createHandler({
  async POST(req, res, userId) {
    const { email } = req.body
    if (!email) return res.status(400).json({ error: 'Missing email' })

    // Find or create household for the inviter
    let [membership] = await sql`
      SELECT household_id FROM household_members WHERE user_id = ${userId}`

    let householdId
    if (membership) {
      householdId = membership.household_id
    } else {
      // Auto-create household
      const [household] = await sql`
        INSERT INTO households (name, created_by)
        VALUES ('My Household', ${userId})
        RETURNING id`
      householdId = household.id
      await sql`
        INSERT INTO household_members (household_id, user_id, role)
        VALUES (${householdId}, ${userId}, 'owner')`
    }

    // Check for existing pending invite
    const [existingInvite] = await sql`
      SELECT id FROM household_invites
      WHERE household_id = ${householdId} AND email = ${email} AND status = 'pending'`
    if (existingInvite)
      return res.status(409).json({ error: 'Invite already pending for this email' })

    const [invite] = await sql`
      INSERT INTO household_invites (household_id, email, invited_by)
      VALUES (${householdId}, ${email}, ${userId})
      RETURNING *`

    return res.json(invite)
  },

  async PUT(req, res, userId) {
    const { id, status } = req.body
    if (!id || !['accepted', 'declined'].includes(status))
      return res.status(400).json({ error: 'Missing id or invalid status' })

    // Verify the invite belongs to this user (match by email from profile)
    const [profile] = await sql`SELECT * FROM profiles WHERE id = ${userId}`
    const [invite] = await sql`
      SELECT * FROM household_invites WHERE id = ${id} AND status = 'pending'`

    if (!invite)
      return res.status(404).json({ error: 'Invite not found or already responded' })

    // Update invite status
    const [updated] = await sql`
      UPDATE household_invites SET status = ${status}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING *`

    // If accepting, add user to household (and leave old household if any)
    if (status === 'accepted') {
      // Remove from old household
      await sql`DELETE FROM household_members WHERE user_id = ${userId}`

      // Add to new household
      await sql`
        INSERT INTO household_members (household_id, user_id, role)
        VALUES (${invite.household_id}, ${userId}, 'member')`
    }

    return res.json(updated)
  },

  async DELETE(req, res, userId) {
    const { id } = req.body
    if (!id) return res.status(400).json({ error: 'Missing id' })

    const result = await sql`
      DELETE FROM household_invites
      WHERE id = ${id} AND (invited_by = ${userId} OR email = (
        SELECT display_name FROM profiles WHERE id = ${userId}
      ))
      RETURNING id`

    if (result.length === 0)
      return res.status(404).json({ error: 'Invite not found' })
    return res.json({ deleted: true, id: result[0].id })
  },
})
