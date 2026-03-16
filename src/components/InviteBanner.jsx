import { useHousehold } from '../contexts/HouseholdContext'

export default function InviteBanner() {
  const { pendingInvites, acceptInvite, declineInvite } = useHousehold()

  if (!pendingInvites || pendingInvites.length === 0) return null

  return (
    <div className="px-5 pt-3">
      {pendingInvites.map((invite) => (
        <div key={invite.id} className="bg-accent-light border border-accent/30 rounded-xl p-4 mb-2">
          <p className="text-sm font-semibold text-accent-dark">
            &#127968; You've been invited to join "{invite.households?.name || 'a household'}"
          </p>
          <p className="text-xs text-warm-text-dim mt-1 mb-3">
            Share recipes, shopping lists, and inventory with your household.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => acceptInvite(invite.id)}
              className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold"
            >
              Accept
            </button>
            <button
              onClick={() => declineInvite(invite.id)}
              className="px-4 py-2 rounded-lg bg-warm-card border border-warm-border text-sm text-warm-text"
            >
              Decline
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
