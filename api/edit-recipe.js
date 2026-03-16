export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { recipe, instruction } = req.body
  if (!recipe || !instruction?.trim()) return res.status(400).json({ error: 'Recipe and instruction required' })

  const systemPrompt = `You are a Thermomix TM6 recipe editor. You receive an existing recipe as JSON and an instruction from the user. Apply the requested changes and return the FULL updated recipe JSON.

## Rules
- Return ONLY valid JSON — no markdown, no explanation
- Preserve ALL existing fields unless the instruction specifically changes them
- If asked to verify/fix source URLs: do NOT generate, guess, or invent new URLs. Only keep URLs that the user originally provided. Remove any suspicious or unverified URLs. If no user-provided URLs remain, set source_urls to an empty array [].
- If asked to check proportions: verify 2-bowl ingredients are exactly doubled from 1-bowl
- If asked to modify ingredients: update both 1-bowl and 2-bowl versions
- Keep all Thermomix settings valid (speed <=4 with butterfly whisk, speed <=6 at Varoma)
- Vegetarian by default (no meat/fish/gelatin, eggs+dairy OK)
- All ingredients must have gram/ml weights and estimate field
- Return the complete recipe object with all fields`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 12000,
        thinking: { type: 'enabled', budget_tokens: 2000 },
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `Current recipe:\n${JSON.stringify(recipe, null, 2)}\n\nInstruction: ${instruction}`,
        }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Anthropic API error:', err)
      return res.status(502).json({ error: 'AI service error' })
    }

    const data = await response.json()
    const thinkingBlock = data.content?.find(b => b.type === 'thinking')
    if (thinkingBlock) console.log('AI edit thinking:', thinkingBlock.thinking?.slice(0, 1000))
    const textBlock = data.content?.find(b => b.type === 'text')
    const text = textBlock?.text || ''
    let jsonStr = text
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (fenceMatch) jsonStr = fenceMatch[1]
    const braceMatch = jsonStr.match(/\{[\s\S]*\}/)
    if (!braceMatch) {
      return res.status(500).json({ error: 'Could not parse AI response' })
    }

    const updated = JSON.parse(braceMatch[0])
    // Only return recipe data fields, not DB metadata
    const allowed = [
      'title', 'description', 'servings_1bowl', 'servings_2bowl',
      'time_1bowl', 'time_2bowl', 'tags', 'thumbnail_emoji', 'source_urls',
      'ingredients_1bowl', 'ingredients_2bowl', 'steps_1bowl', 'steps_2bowl',
      'nutrition', 'insulin_load',
    ]
    const filtered = {}
    for (const key of allowed) {
      if (updated[key] !== undefined) filtered[key] = updated[key]
    }
    return res.status(200).json(filtered)
  } catch (err) {
    console.error('edit-recipe error:', err)
    return res.status(500).json({ error: err.message })
  }
}
