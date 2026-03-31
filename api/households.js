import { sql } from './_lib/db.js'
import { createHandler } from './_lib/handler.js'

// Race-safe: get existing household or create a new one for this user
async function getOrCreateHousehold(userId, name = 'My Household') {
  const [existing] = await sql`SELECT household_id FROM household_members WHERE user_id = ${userId}`
  if (existing) return existing.household_id

  const [household] = await sql`INSERT INTO households (name, created_by) VALUES (${name}, ${userId}) RETURNING id`
  const householdId = household.id
  await sql`
    INSERT INTO household_members (household_id, user_id, role)
    VALUES (${householdId}, ${userId}, 'owner')
    ON CONFLICT (household_id, user_id) DO NOTHING`
  return householdId
}

export default createHandler({
  async GET(req, res, userId) {
    const [membership] = await sql`
      SELECT hm.household_id, hm.role
      FROM household_members hm
      WHERE hm.user_id = ${userId}`

    if (!membership) {
      const email = req.query.email
      let pendingInvites = []
      if (email) {
        pendingInvites = await sql`
          SELECT hi.*, h.name as household_name
          FROM household_invites hi
          JOIN households h ON hi.household_id = h.id
          WHERE hi.status = 'pending' AND LOWER(hi.email) = LOWER(${email})`
      }
      return res.json({ household: null, members: [], pendingInvites })
    }

    const householdId = membership.household_id
    const [household] = await sql`SELECT * FROM households WHERE id = ${householdId}`
    const members = await sql`
      SELECT hm.user_id, hm.role, hm.joined_at, p.display_name, p.avatar_url
      FROM household_members hm
      LEFT JOIN profiles p ON hm.user_id = p.id
      WHERE hm.household_id = ${householdId}
      ORDER BY hm.joined_at ASC`
    const pendingInvites = await sql`
      SELECT * FROM household_invites
      WHERE household_id = ${householdId} AND status = 'pending'
      ORDER BY created_at DESC`
    return res.json({ household, members, pendingInvites })
  },

  async POST(req, res, userId) {
    const { action } = req.body

    // Create invite
    if (action === 'invite') {
      const { email } = req.body
      if (!email) return res.status(400).json({ error: 'Missing email' })

      let householdId = await getOrCreateHousehold(userId)

      // Upsert: if a previous invite exists (even declined), reset it to pending
      const [invite] = await sql`
        INSERT INTO household_invites (household_id, email, invited_by)
        VALUES (${householdId}, ${email}, ${userId})
        ON CONFLICT (household_id, email) DO UPDATE
          SET status = 'pending', invited_by = ${userId}, created_at = now()
          WHERE household_invites.status != 'pending'
        RETURNING *`
      if (!invite) return res.status(409).json({ error: 'Invite already pending for this email' })
      return res.json(invite)
    }

    // Create household
    const { name } = req.body
    if (!name) return res.status(400).json({ error: 'Missing household name' })
    const [existing] = await sql`SELECT household_id FROM household_members WHERE user_id = ${userId}`
    if (existing) return res.status(409).json({ error: 'User already in a household' })
    const householdId = await getOrCreateHousehold(userId, name)
    const [household] = await sql`SELECT * FROM households WHERE id = ${householdId}`
    return res.json(household)
  },

  async PUT(req, res, userId) {
    const { action, id, status: inviteStatus, userId: targetUserId } = req.body

    // Accept/decline invite
    if (action === 'respond-invite') {
      if (!id || !['accepted', 'declined'].includes(inviteStatus))
        return res.status(400).json({ error: 'Missing id or invalid status' })

      const [invite] = await sql`SELECT * FROM household_invites WHERE id = ${id} AND status = 'pending'`
      if (!invite) return res.status(404).json({ error: 'Invite not found' })

      await sql`UPDATE household_invites SET status = ${inviteStatus} WHERE id = ${id}`

      if (inviteStatus === 'accepted') {
        await sql`DELETE FROM household_members WHERE user_id = ${userId}`
        await sql`
          INSERT INTO household_members (household_id, user_id, role)
          VALUES (${invite.household_id}, ${userId}, 'member')
          ON CONFLICT (household_id, user_id) DO UPDATE SET role = 'member'`
      }
      return res.json({ updated: true })
    }

    // Remove member
    if (action === 'remove-member') {
      if (!targetUserId) return res.status(400).json({ error: 'Missing userId' })
      const [membership] = await sql`SELECT household_id, role FROM household_members WHERE user_id = ${userId}`
      if (!membership) return res.status(404).json({ error: 'No household found' })

      if (targetUserId === userId) {
        await sql`DELETE FROM household_members WHERE user_id = ${userId} AND household_id = ${membership.household_id}`
        return res.json({ removed: true })
      }
      if (membership.role !== 'owner') return res.status(403).json({ error: 'Only owner can remove members' })
      await sql`DELETE FROM household_members WHERE user_id = ${targetUserId} AND household_id = ${membership.household_id}`
      return res.json({ removed: true })
    }

    return res.status(400).json({ error: 'Unknown action' })
  },

  async DELETE(req, res, userId) {
    const { action, id } = req.body || {}

    // Delete invite
    if (action === 'delete-invite') {
      if (!id) return res.status(400).json({ error: 'Missing id' })
      await sql`DELETE FROM household_invites WHERE id = ${id} AND invited_by = ${userId}`
      return res.json({ deleted: true })
    }

    // Delete household
    const [membership] = await sql`SELECT household_id, role FROM household_members WHERE user_id = ${userId}`
    if (!membership) return res.status(404).json({ error: 'No household found' })
    if (membership.role !== 'owner') return res.status(403).json({ error: 'Only the owner can delete' })
    const householdId = membership.household_id
    await sql`DELETE FROM household_invites WHERE household_id = ${householdId}`
    await sql`DELETE FROM household_members WHERE household_id = ${householdId}`
    await sql`DELETE FROM households WHERE id = ${householdId}`
    return res.json({ deleted: true })
  },
})
