export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { text } = req.body
  if (!text?.trim()) return res.status(400).json({ error: 'Text is required' })

  const systemPrompt = `You parse natural language descriptions of food inventory into structured JSON.

Return ONLY a valid JSON object with this format:
{
  "items": [
    { "name": "Onion", "quantity": "2", "category": "produce" },
    { "name": "Rice", "quantity": "500g", "category": "pantry" }
  ]
}

Categories: produce, dairy, protein, pantry, spices, frozen, other

Rules:
- Extract each distinct item
- Normalize names to standard English (e.g. "cilantro" not "fresh coriander leaves")
- Include quantity if mentioned (keep units: "2", "500g", "1L", "half bag")
- If quantity is vague, include the description (e.g. "some", "a little", "half bag")
- Assign the most appropriate category
- No markdown, no explanation, just the JSON`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: text }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Anthropic API error:', err)
      return res.status(502).json({ error: 'AI service error' })
    }

    const data = await response.json()
    const rawText = data.content?.[0]?.text || ''
    const braceMatch = rawText.match(/\{[\s\S]*\}/)
    if (!braceMatch) {
      return res.status(500).json({ error: 'Could not parse AI response' })
    }

    const parsed = JSON.parse(braceMatch[0])
    return res.status(200).json(parsed)
  } catch (err) {
    console.error('parse-inventory error:', err)
    return res.status(500).json({ error: err.message })
  }
}
