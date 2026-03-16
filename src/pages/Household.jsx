import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useHousehold } from '../contexts/HouseholdContext'
import AppHeader from '../components/AppHeader'

export default function Household() {
  const { user } = useAuth()
  const {
    household, members, pendingInvites,
    inviteByEmail, acceptInvite, declineInvite,
    leaveHousehold, removeMember, cancelInvite, deleteHousehold,
  } = useHousehold()

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [inviteAction, setInviteAction] = useState(null) // {id, action}
  const [inviteError, setInviteError] = useState('')

  const myRole = members.find((m) => m.user_id === user?.id)?.role
  const isOwner = myRole === 'owner'

  async function handleAccept(inviteId) {
    setInviteAction({ id: inviteId, action: 'accepting' })
    setInviteError('')
    const result = await acceptInvite(inviteId)
    if (result?.error) {
      setInviteError(result.error.message || 'Could not accept invite')
    }
    setInviteAction(null)
  }

  async function handleDecline(inviteId) {
    setInviteAction({ id: inviteId, action: 'declining' })
    setInviteError('')
    const result = await declineInvite(inviteId)
    if (result?.error) {
      setInviteError(result.error.message || 'Could not decline invite')
    }
    setInviteAction(null)
  }

  async function handleInvite(e) {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviting(true)
    setInviteMsg('')
    const { error } = await inviteByEmail(inviteEmail)
    if (error) {
      setInviteMsg(error.message || 'Could not send invite')
    } else {
      setInviteMsg('Invite sent!')
      setInviteEmail('')
    }
    setInviting(false)
  }

  return (
    <div className="min-h-dvh pb-24 bg-warm-bg">
      <AppHeader
        title={household ? household.name : 'Household'}
        subtitle={household ? `${members.length} member${members.length !== 1 ? 's' : ''}` : 'Share with your family'}
      />

      {/* Pending invites for this user (only invites addressed to their email, not outgoing) */}
      {pendingInvites.filter(inv => inv.email?.toLowerCase() === user?.email?.toLowerCase() && (!household || inv.household_id !== household.id)).length > 0 && (
        <div className="px-5 py-3">
          <h2 className="text-sm font-bold mb-2">You're Invited</h2>
          {pendingInvites.filter(inv => inv.email?.toLowerCase() === user?.email?.toLowerCase() && (!household || inv.household_id !== household.id)).map((inv) => (
            <div key={inv.id} className="bg-accent-light border border-accent/30 rounded-xl p-4 mb-2">
              <p className="text-sm font-semibold text-accent-dark">
                &#127968; Join &ldquo;{inv.households?.name || 'Household'}&rdquo;
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => handleAccept(inv.id)}
                  disabled={inviteAction?.id === inv.id}
                  className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold disabled:opacity-50"
                >
                  {inviteAction?.id === inv.id && inviteAction?.action === 'accepting' ? '...' : 'Accept'}
                </button>
                <button
                  onClick={() => handleDecline(inv.id)}
                  disabled={inviteAction?.id === inv.id}
                  className="px-4 py-2 rounded-lg bg-warm-card border border-warm-border text-sm disabled:opacity-50"
                >
                  {inviteAction?.id === inv.id && inviteAction?.action === 'declining' ? '...' : 'Decline'}
                </button>
              </div>
              {inviteError && inviteAction === null && (
                <p className="text-red-500 text-xs mt-2">{inviteError}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Share by email — always visible */}
      <div className="px-5 py-3">
        <div className="bg-warm-card rounded-xl border border-warm-border p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">&#128231;</span>
            <h2 className="text-sm font-bold">Share with someone</h2>
          </div>
          <p className="text-xs text-warm-text-dim mb-3">
            Enter their email to share recipes, shopping lists, inventory, and cooking history.
            {!household && ' A household will be created automatically.'}
          </p>
          <form onSubmit={handleInvite} className="flex gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Email address"
              className="flex-1 py-2.5 px-3 rounded-xl bg-warm-bg border border-warm-border text-sm outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={inviting || !inviteEmail.trim()}
              className="px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold disabled:opacity-50"
            >
              {inviting ? '...' : 'Share'}
            </button>
          </form>
          {inviteMsg && (
            <p className={`text-xs mt-2 ${inviteMsg.includes('sent') ? 'text-green' : 'text-red-500'}`}>
              {inviteMsg}
            </p>
          )}
        </div>
      </div>

      {/* Members */}
      {household && members.length > 0 && (
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
      )}

      {/* Pending invites sent by owner */}
      {household && isOwner && pendingInvites.filter(i => i.household_id === household.id && i.status === 'pending').length > 0 && (
        <div className="px-5 py-3">
          <h2 className="text-sm font-bold mb-2">Pending Invites</h2>
          {pendingInvites
            .filter(i => i.household_id === household.id && i.status === 'pending')
            .map((inv) => (
              <div key={inv.id} className="flex items-center justify-between bg-warm-card rounded-xl px-4 py-3 mb-1.5">
                <p className="text-sm text-warm-text-dim">{inv.email}</p>
                <button
                  onClick={() => cancelInvite(inv.id)}
                  className="text-red-400 text-xs bg-transparent p-1"
                >
                  Cancel
                </button>
              </div>
            ))}
        </div>
      )}

      {/* What's shared info */}
      {!household && (
        <div className="px-5 py-3">
          <div className="bg-warm-bg rounded-xl p-4">
            <h3 className="text-xs font-bold text-warm-text-dim uppercase tracking-wide mb-2">What gets shared</h3>
            <div className="flex flex-col gap-2">
              {[
                { icon: '\uD83C\uDF7D', label: 'Recipes', desc: 'See who created each recipe' },
                { icon: '\uD83D\uDED2', label: 'Shopping Lists', desc: 'Add and check off items together' },
                { icon: '\uD83C\uDFE0', label: 'Inventory', desc: 'Track what\'s in the kitchen' },
                { icon: '\uD83D\uDCCA', label: 'Cook History', desc: 'See what everyone cooked' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <span className="text-lg">{item.icon}</span>
                  <div>
                    <p className="text-sm font-semibold">{item.label}</p>
                    <p className="text-xs text-warm-text-dim">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Leave / Delete */}
      {household && (
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
                  <p className="text-xs text-red-600 mb-3">You&apos;ll switch back to solo mode.</p>
                  <div className="flex gap-2">
                    <button onClick={leaveHousehold} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold">Leave</button>
                    <button onClick={() => setConfirmLeave(false)} className="px-4 py-2 rounded-lg bg-warm-card border border-warm-border text-sm">Cancel</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
