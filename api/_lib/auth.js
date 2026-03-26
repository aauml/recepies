import { verifyToken } from '@clerk/backend'

export async function getAuthUserId(req) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) throw new Error('No authorization token')
  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    })
    return payload.sub
  } catch (err) {
    throw new Error('Invalid token')
  }
}
