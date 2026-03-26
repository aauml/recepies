import { sql } from '../_lib/db.js'
import { Webhook } from 'svix'

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,svix-id,svix-timestamp,svix-signature')
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.method !== 'POST') return res.status(405).end()

  // Verify webhook signature (optional in dev, required in prod)
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET
  if (webhookSecret) {
    const wh = new Webhook(webhookSecret)
    try {
      wh.verify(JSON.stringify(req.body), {
        'svix-id': req.headers['svix-id'],
        'svix-timestamp': req.headers['svix-timestamp'],
        'svix-signature': req.headers['svix-signature'],
      })
    } catch {
      return res.status(400).json({ error: 'Invalid webhook signature' })
    }
  }

  const { type, data } = req.body

  if (type === 'user.created') {
    const userId = data.id
    const displayName =
      [data.first_name, data.last_name].filter(Boolean).join(' ') ||
      data.email_addresses?.[0]?.email_address ||
      'User'
    const avatarUrl = data.image_url || null

    await sql`
      INSERT INTO profiles (id, display_name, avatar_url)
      VALUES (${userId}, ${displayName}, ${avatarUrl})
      ON CONFLICT (id) DO NOTHING`
  }

  return res.json({ received: true })
}
