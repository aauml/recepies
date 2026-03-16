import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useHousehold } from '../contexts/HouseholdContext'
import AppHeader from '../components/AppHeader'

export default function Household() {
  const { user } = useAuth()
  const {
    household, members, pendingInvites,
    createHousehold, inviteMember, acceptInvite, declineInvite,
    leaveHousehold, removeMember, deleteHousehold,
  } = useHousehold()

  const [hhName, setHhName] = useState('My Household')
  const [inviteEmail, setInviteEmail] = useState('')
  const [creating, setCreating] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const myRole = members.find((m) => m.user_id === user?.id)?.role
  const isOwner = myRole === 'owner'

  async function handleCreate() {
    setCreating(true)
    await createHousehold(hhName.trim() || 'My Household')
    setCreating(false)
  }

  async function handleInvite(e) {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviting(true)
    setInviteMsg('')
    const { error } = await inviteMember(inviteEmail)
    if (error) {
      setInviteMsg(error.message || 'Could not send invite')
    } else {
      setInviteMsg('Invite sent!')
      setInviteEmail('')
    }
    setInviting(false)
  }

  // No household — create or accept invites
  if (!household) {
    return (
      <div className="min-h-dvh pb-24 bg-warm-bg">
        <AppHeader title="Household" subtitle="Share with your family" />

        {/* Pending invites */}
        {pendingInvites.length > 0 && (
          <div className="px-5 py-3">
            <h2 className="text-sm font-bold mb-2">Pending Invites</h2>
            {pendingInvites.map((inv) => (
              <div key={inv.id} className="bg-accent-light border border-accent/30 rounded-xl p-4 mb-2">
                <p className="text-sm font-semibold text-accent-dark">
                  &#127968; Join "{inv.households?.name || 'Household'}"
                </p>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => acceptInvite(inv.id)} className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold">
                    Accept
                  </button>
                  <button onClick={() => declineInvite(inv.id)} className="px-4 py-2 rounded-lg bg-warm-card border border-warm-border text-sm">
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create household */}
        <div className="px-5 py-3">
          <div className="bg-warm-card rounded-xl border border-warm-border p-5 text-center">
            <span className="text-4xl">&#127968;</span>
            <h2 className="text-base font-bold mt-2">Create a Household</h2>
            <p className="text-xs text-warm-text-dim mt-1 mb-4">
              Share recipes, shopping lists, and inventory with your family.
            </p>
            <input
              value={hhName}
              onChange={(e) => setHhName(e.target.value)}
              placeholder="Household name"
              className="w-full py-2.5 px-3 rounded-xl bg-warm-bg border border-warm-border text-sm text-center outline-none focus:border-accent mb-3"
            />
            <button
              onClick={handleCreate}
              disabled={creating}
              className="w-full py-3 rounded-xl bg-accent text-white text-sm font-bold disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Household'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Has household
  return (
    <div className="min-h-dvh pb-24 bg-warm-bg">
      <AppHeader title={household.name} subtitle={`${members.length} members`} />

      {/* Members */}
      <div className="px-5 py-3">
        <h2 className="text-sm font-bold mb-2">Members</h2>
        <div className="flex flex-col gap-1.5">
          {members.map((m) => (
            <div key={m.user_id} className="flex items-center gap-3 bg-warm-card rounded-xl px-4 py-3">
              <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center text-sm overflow-hidden shrink-0">
                {m.avatar_url ? (
                  <img src={m.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  (m.display_name || '?')[0].toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">
                  {m.display_name}
                  {m.user_id === user.id && <span className="text-warm-text-dim font-normal"> (you)</span>}
                </p>
                <p className="text-xs text-warm-text-dim capitalize">{m.role}</p>
              </div>
              {isOwner && m.user_id !== user.id && (
                <button
                  onClick={() => removeMember(m.user_id)}
                  className="text-red-400 text-xs bg-transparent p-1"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Invite */}
      {isOwner && (
        <div className="px-5 py-3">
          <h2 className="text-sm font-bold mb-2">Invite Member</h2>
          <form onSubmit={handleInvite} className="flex gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Email address"
              className="flex-1 py-2.5 px-3 rounded-xl bg-warm-card border border-warm-border text-sm outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={inviting || !inviteEmail.trim()}
              className="px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold disabled:opacity-50"
            >
              {inviting ? '...' : 'Invite'}
            </button>
          </form>
          {inviteMsg && (
            <p className={`text-xs mt-2 ${inviteMsg.includes('sent') ? 'text-green' : 'text-red-500'}`}>
              {inviteMsg}
            </p>
          )}
        </div>
      )}

      {/* Pending invites sent */}
      {isOwner && pendingInvites.filter(i => i.household_id === household.id && i.status === 'pending').length > 0 && (
        <div className="px-5 py-3">
          <h2 className="text-sm font-bold mb-2">Pending Invites</h2>
          {pendingInvites
            .filter(i => i.household_id === household.id && i.status === 'pending')
            .map((inv) => (
              <div key={inv.id} className="flex items-center justify-between bg-warm-card rounded-xl px-4 py-3 mb-1.5">
                <p className="text-sm text-warm-text-dim">{inv.email}</p>
                <span className="text-xs text-accent">Pending</span>
              </div>
            ))}
        </div>
      )}

      {/* Leave / Delete */}
      <div className="px-5 py-3 mt-4">
        {isOwner ? (
          <>
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-full py-3 rounded-xl text-red-500 text-sm font-semibold bg-red-50 border border-red-200"
              >
                Delete Household
              </button>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-sm text-red-800 font-semibold mb-2">Delete this household?</p>
                <p className="text-xs text-red-600 mb-3">All members will be removed. Data stays with each user.</p>
                <div className="flex gap-2">
                  <button onClick={deleteHousehold} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold">Delete</button>
                  <button onClick={() => setConfirmDelete(false)} className="px-4 py-2 rounded-lg bg-warm-card border border-warm-border text-sm">Cancel</button>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {!confirmLeave ? (
              <button
                onClick={() => setConfirmLeave(true)}
                className="w-full py-3 rounded-xl text-red-500 text-sm font-semibold bg-red-50 border border-red-200"
              >
                Leave Household
              </button>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-sm text-red-800 font-semibold mb-2">Leave this household?</p>
                <p className="text-xs text-red-600 mb-3">You'll switch back to solo mode.</p>
                <div className="flex gap-2">
                  <button onClick={leaveHousehold} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold">Leave</button>
                  <button onClick={() => setConfirmLeave(false)} className="px-4 py-2 rounded-lg bg-warm-card border border-warm-border text-sm">Cancel</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
