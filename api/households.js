import { sql } from './_lib/db.js'
import { createHandler } from './_lib/handler.js'

export default createHandler({
  async GET(req, res, userId) {
    // Get user's household
    const [membership] = await sql`
      SELECT hm.household_id, hm.role
      FROM household_members hm
      WHERE hm.user_id = ${userId}`

    if (!membership) {
      // Check for pending invites via email query param
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

    // Get household info
    const [household] = await sql`
      SELECT * FROM households WHERE id = ${householdId}`

    // Get members with profile info
    const members = await sql`
      SELECT hm.user_id, hm.role, hm.joined_at,
        p.display_name, p.avatar_url
      FROM household_members hm
      LEFT JOIN profiles p ON hm.user_id = p.id
      WHERE hm.household_id = ${householdId}
      ORDER BY hm.joined_at ASC`

    // Get pending invites for this household
    const pendingInvites = await sql`
      SELECT * FROM household_invites
      WHERE household_id = ${householdId} AND status = 'pending'
      ORDER BY created_at DESC`

    return res.json({ household, members, pendingInvites })
  },

  async POST(req, res, userId) {
    const { name } = req.body
    if (!name) return res.status(400).json({ error: 'Missing household name' })

    // Check if user already has a household
    const [existing] = await sql`
      SELECT household_id FROM household_members WHERE user_id = ${userId}`
    if (existing)
      return res.status(409).json({ error: 'User already in a household' })

    // Create household + add user as owner
    const [household] = await sql`
      INSERT INTO households (name, created_by)
      VALUES (${name}, ${userId})
      RETURNING *`

    await sql`
      INSERT INTO household_members (household_id, user_id, role)
      VALUES (${household.id}, ${userId}, 'owner')`

    return res.json(household)
  },

  async DELETE(req, res, userId) {
    // Only owner can delete
    const [membership] = await sql`
      SELECT household_id, role FROM household_members
      WHERE user_id = ${userId}`
    if (!membership)
      return res.status(404).json({ error: 'No household found' })
    if (membership.role !== 'owner')
      return res.status(403).json({ error: 'Only the owner can delete a household' })

    const householdId = membership.household_id

    // Delete invites, members, then household
    await sql`DELETE FROM household_invites WHERE household_id = ${householdId}`
    await sql`DELETE FROM household_members WHERE household_id = ${householdId}`
    await sql`DELETE FROM households WHERE id = ${householdId}`

    return res.json({ deleted: true })
  },
})
