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

    // Fetch pending invites for this user's email
    const email = user.email
    if (email) {
      const { data: invites } = await supabase
        .from('household_invites')
        .select('*, households(name)')
        .eq('status', 'pending')
        .ilike('email', email)
      setPendingInvites(invites || [])
    }

    setLoading(false)
  }, [user])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function createHousehold(name = 'My Household') {
    const { data: hh, error } = await supabase
      .from('households')
      .insert({ name, created_by: user.id })
      .select()
      .single()
    if (error || !hh) return { error }

    await supabase.from('household_members').insert({
      household_id: hh.id,
      user_id: user.id,
      role: 'owner',
    })

    await refresh()
    return { data: hh }
  }

  async function inviteMember(email) {
    if (!household) return { error: 'No household' }
    const { error } = await supabase.from('household_invites').insert({
      household_id: household.id,
      email: email.toLowerCase().trim(),
      invited_by: user.id,
    })
    if (!error) await refresh()
    return { error }
  }

  async function acceptInvite(inviteId) {
    const invite = pendingInvites.find((i) => i.id === inviteId)
    if (!invite) return

    // Update invite status
    await supabase
      .from('household_invites')
      .update({ status: 'accepted' })
      .eq('id', inviteId)

    // Add as member
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

  async function deleteHousehold() {
    if (!household) return
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
        inviteMember,
        acceptInvite,
        declineInvite,
        leaveHousehold,
        removeMember,
        deleteHousehold,
        refresh,
      }}
    >
      {children}
    </HouseholdContext.Provider>
  )
}

export const useHousehold = () => useContext(HouseholdContext)
