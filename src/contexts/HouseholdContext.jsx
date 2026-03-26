import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { api } from '../lib/api'
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

    try {
      const data = await api.households.get(user.email)
      setHousehold(data.household || null)
      setMembers(data.members || [])
      setPendingInvites(data.pendingInvites || [])
    } catch {
      setHousehold(null)
      setMembers([])
      setPendingInvites([])
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function createHousehold(name = 'My Household') {
    try {
      const data = await api.households.create(name)
      await refresh()
      return { data }
    } catch (err) {
      return { error: { message: err.message } }
    }
  }

  async function inviteByEmail(email) {
    try {
      await api.householdInvites.create(email)
      await refresh()
      return {}
    } catch (err) {
      return { error: { message: err.message } }
    }
  }

  async function acceptInvite(inviteId) {
    try {
      await api.householdInvites.accept(inviteId)
      await refresh()
      return {}
    } catch (err) {
      return { error: { message: err.message } }
    }
  }

  async function declineInvite(inviteId) {
    try {
      await api.householdInvites.decline(inviteId)
      await refresh()
      return {}
    } catch (err) {
      return { error: { message: err.message } }
    }
  }

  async function leaveHousehold() {
    if (!household) return
    try {
      await api.householdMembers.delete(user.id)
      await refresh()
    } catch (err) {
      console.error('Leave household error:', err)
    }
  }

  async function removeMember(userId) {
    if (!household) return
    try {
      await api.householdMembers.delete(userId)
      await refresh()
    } catch (err) {
      console.error('Remove member error:', err)
    }
  }

  async function cancelInvite(inviteId) {
    if (!household) return
    try {
      await api.householdInvites.delete(inviteId)
      await refresh()
    } catch (err) {
      console.error('Cancel invite error:', err)
    }
  }

  async function deleteHousehold() {
    if (!household) return
    try {
      await api.households.delete()
      await refresh()
    } catch (err) {
      console.error('Delete household error:', err)
    }
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
