import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const HouseholdContext = createContext({})

export function HouseholdProvider({ children }) {
  const { user } = useAuth()
  const [household, setHousehold] = useState(null)
  const [members, setMembers] = useState([])
  const [pendingInvites, setPendingInvites] = useState([])
  const [loading, setLoading] = useState(true)

  // Derive household user IDs — solo if no household
  const householdUserIds = household
    ? members.map((m) => m.user_id)
    : user ? [user.id] : []

  const refresh = useCallback(async () => {
    if (!user) {
      setHousehold(null)
      setMembers([])
      setPendingInvites([])
      setLoading(false)
      return
    }

    // Fetch membership
    const { data: membership } = await supabase
      .from('household_members')
      .select('household_id, role')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    if (membership?.household_id) {
      // Fetch household
      const { data: hh } = await supabase
        .from('households')
        .select('*')
        .eq('id', membership.household_id)
        .single()
      setHousehold(hh)

      // Fetch all members with profiles
      const { data: mems } = await supabase
        .from('household_members')
        .select('user_id, role, joined_at, profiles(display_name, avatar_url)')
        .eq('household_id', membership.household_id)
      setMembers(
        (mems || []).map((m) => ({
          user_id: m.user_id,
          role: m.role,
          joined_at: m.joined_at,
          display_name: m.profiles?.display_name || 'Unknown',
          avatar_url: m.profiles?.avatar_url || null,
        }))
      )
    } else {
      setHousehold(null)
      setMembers([])
    }

    // Fetch pending invites: invites for this user's email + outgoing invites from household
    const email = user.email
    const inviteQueries = []
    if (email) {
      inviteQueries.push(
        supabase
          .from('household_invites')
          .select('*, households(name)')
          .eq('status', 'pending')
          .ilike('email', email)
      )
    }
    if (membership?.household_id) {
      inviteQueries.push(
        supabase
          .from('household_invites')
          .select('*, households(name)')
          .eq('status', 'pending')
          .eq('household_id', membership.household_id)
      )
    }
    const inviteResults = await Promise.all(inviteQueries)
    const allInvites = inviteResults.flatMap(r => r.data || [])
    // Deduplicate by invite id
    const uniqueInvites = [...new Map(allInvites.map(i => [i.id, i])).values()]
    setPendingInvites(uniqueInvites)

    setLoading(false)
  }, [user])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Create household + add self as owner
  async function createHousehold(name = 'My Household') {
    // Generate UUID client-side to avoid RLS SELECT issues
    const hhId = crypto.randomUUID()
    const { error: insertErr } = await supabase
      .from('households')
      .insert({ id: hhId, name, created_by: user.id })
    if (insertErr) {
      console.error('Create household error:', insertErr)
      return { error: insertErr }
    }

    const { error: memberErr } = await supabase.from('household_members').insert({
      household_id: hhId,
      user_id: user.id,
      role: 'owner',
    })
    if (memberErr) {
      console.error('Add owner member error:', memberErr)
      return { error: memberErr }
    }

    await refresh()
    return { data: { id: hhId, name } }
  }

  // Invite by email — auto-creates household if none exists
  async function inviteByEmail(email) {
    let hh = household
    // Auto-create household if user doesn't have one
    if (!hh) {
      const result = await createHousehold('My Household')
      if (result.error) return { error: result.error }
      hh = result.data
    }
    if (!hh) return { error: { message: 'Could not create household' } }

    const { error } = await supabase.from('household_invites').insert({
      household_id: hh.id,
      email: email.toLowerCase().trim(),
      invited_by: user.id,
    })
    if (error) {
      console.error('Invite error:', error)
      return { error }
    }
    await refresh()
    return {}
  }

  async function acceptInvite(inviteId) {
    const invite = pendingInvites.find((i) => i.id === inviteId)
    if (!invite) return

    await supabase
      .from('household_invites')
      .update({ status: 'accepted' })
      .eq('id', inviteId)

    await supabase.from('household_members').insert({
      household_id: invite.household_id,
      user_id: user.id,
      role: 'member',
    })

    await refresh()
  }

  async function declineInvite(inviteId) {
    await supabase
      .from('household_invites')
      .update({ status: 'declined' })
      .eq('id', inviteId)
    await refresh()
  }

  async function leaveHousehold() {
    if (!household) return
    await supabase
      .from('household_members')
      .delete()
      .eq('user_id', user.id)
      .eq('household_id', household.id)
    await refresh()
  }

  async function removeMember(userId) {
    if (!household) return
    await supabase
      .from('household_members')
      .delete()
      .eq('user_id', userId)
      .eq('household_id', household.id)
    await refresh()
  }

  async function cancelInvite(inviteId) {
    if (!household) return
    await supabase
      .from('household_invites')
      .delete()
      .eq('id', inviteId)
    await refresh()
  }

  async function deleteHousehold() {
    if (!household) return
    await supabase.from('household_invites').delete().eq('household_id', household.id)
    await supabase.from('household_members').delete().eq('household_id', household.id)
    await supabase.from('households').delete().eq('id', household.id)
    await refresh()
  }

  return (
    <HouseholdContext.Provider
      value={{
        household,
        members,
        pendingInvites,
        householdUserIds,
        loading,
        createHousehold,
        inviteByEmail,
        acceptInvite,
        declineInvite,
        leaveHousehold,
        removeMember,
        cancelInvite,
        deleteHousehold,
        refresh,
      }}
    >
      {children}
    </HouseholdContext.Provider>
  )
}

export const useHousehold = () => useContext(HouseholdContext)
