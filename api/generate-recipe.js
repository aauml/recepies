export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { input, appliance = 'Thermomix TM6' } = req.body
  if (!input?.trim()) return res.status(400).json({ error: 'Input is required' })

  // If input looks like a URL, try to fetch its content
  let context = input.trim()
  let sourceUrl = null
  const urlMatch = context.match(/^https?:\/\/\S+/)
  if (urlMatch) {
    sourceUrl = urlMatch[0]
    const isYouTube = /youtube\.com\/watch|youtu\.be\//.test(sourceUrl)

    if (isYouTube) {
      // Extract YouTube video ID and try to get transcript
      let videoId = ''
      const ytMatch = sourceUrl.match(/(?:v=|youtu\.be\/)([\w-]{11})/)
      if (ytMatch) videoId = ytMatch[1]

      let transcript = ''
      if (videoId) {
        try {
          // Try fetching YouTube transcript via timedtext API
          const langResp = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RecipeBot/1.0)' },
            signal: AbortSignal.timeout(8000),
          })
          const pageHtml = await langResp.text()

          // Extract captions track URL from page
          const captionMatch = pageHtml.match(/"captionTracks":\[.*?"baseUrl":"(.*?)"/s)
          if (captionMatch) {
            const captionUrl = captionMatch[1].replace(/\\u0026/g, '&')
            const captResp = await fetch(captionUrl, { signal: AbortSignal.timeout(8000) })
            const captXml = await captResp.text()
            transcript = captXml
              .replace(/<[^>]*>/g, ' ')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&#39;/g, "'")
              .replace(/&quot;/g, '"')
              .replace(/\s+/g, ' ')
              .trim()
              .slice(0, 15000)
          }
        } catch {}
      }

      // Also fetch the page text for title/description
      let pageText = ''
      try {
        const resp = await fetch(sourceUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RecipeBot/1.0)' },
          signal: AbortSignal.timeout(8000),
        })
        const html = await resp.text()
        const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i)
        pageText = titleMatch ? titleMatch[1] : ''
      } catch {}

      if (transcript) {
        context = `Convert this YouTube recipe video into a Thermomix recipe.\nVideo: ${sourceUrl}\nTitle: ${pageText}\n\nTranscript:\n${transcript}`
      } else {
        context = `Convert this YouTube recipe video: ${sourceUrl}\nTitle: ${pageText}\n(Could not extract transcript — generate from your knowledge of this recipe and the video title)`
      }
    } else {
      // Regular website
      try {
        const resp = await fetch(sourceUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RecipeBot/1.0)' },
          signal: AbortSignal.timeout(8000),
        })
        const html = await resp.text()
        const text = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 12000)
        context = `Convert this recipe from: ${sourceUrl}\n\nExtracted content:\n${text}`
      } catch {
        context = `Convert this recipe from URL: ${sourceUrl} (could not fetch — generate from your knowledge of this recipe)`
      }
    }
  }

  const systemPrompt = `You are a Thermomix® TM6 recipe assistant. You generate accurate, efficient, vegetarian recipes as structured JSON.

## IMPORTANT: Output Format
You MUST respond with ONLY a valid JSON object — no markdown, no code fences, no explanation. Just the raw JSON.

The JSON must match this exact schema:
{
  "title": "Recipe Title",
  "description": "Short 1-2 sentence description",
  "servings_1bowl": "4-6",
  "servings_2bowl": "8-12",
  "time_1bowl": "45 min",
  "time_2bowl": "75 min",
  "tags": ["soup", "vegan"],
  "thumbnail_emoji": "🍲",
  "source_urls": ["https://..."],
  "ingredients_1bowl": [
    {
      "group": "Base",
      "items": [
        { "name": "Onion, quartered", "qty": "150", "unit": "g", "category": "produce", "estimate": "1 medium onion" }
      ]
    }
  ],
  "ingredients_2bowl": [ ...same structure but doubled quantities... ],
  "steps_1bowl": [
    {
      "action": "Chop onions",
      "detail": "Add quartered onions to the bowl",
      "time": "5 sec",
      "temp": "",
      "speed": 5,
      "reverse": false,
      "accessories": [],
      "ingredients": [{ "name": "Onion", "qty": "150g" }]
    }
  ],
  "steps_2bowl": [ ...optimized 2-bowl workflow with bowl labels... ],
  "nutrition": {
    "calories": 280,
    "protein": "12g",
    "carbs": "35g",
    "fat": "10g",
    "fiber": "8g"
  },
  "insulin_load": 2
}

## Appliance
Primary appliance: ${appliance}
${appliance === 'Thermomix TM6' ? `
When using Thermomix TM6, every step MUST include the correct Thermomix settings:
- time: cooking/processing time (e.g. "5 sec", "3 min", "20 min")
- temp: temperature if cooking (e.g. "100°C", "120°C", "Varoma", or "" if no heat)
- speed: 1-10 or null for Turbo
- reverse: true for counterclockwise (delicate ingredients, stews, risotto)
- accessories: array of accessories used (e.g. ["butterfly whisk"], ["simmering basket"], ["Varoma dish"])
` : `For ${appliance}, include time and temperature in each step. Speed/reverse are not applicable.`}

## How Requests Work

### If user provides a dish name:
Search your knowledge for well-regarded variations. Synthesize the best elements into one optimized recipe.

### If user provides a URL or recipe text:
Extract the original recipe. Convert every step to ${appliance}-equivalent operations. Reorder for efficiency.
${sourceUrl ? `\nIMPORTANT: The user provided this source URL: ${sourceUrl}\nThis URL MUST be included as the FIRST entry in source_urls. Then add 1-2 complementary source URLs from other reliable sites for comparison/verification.` : ''}

### If user provides a YouTube video:
Extract the recipe from the video transcript. Convert to ${appliance} format. Include the YouTube URL as the first source.

### If user provides ingredients:
Propose a recipe maximizing those ingredients. Minimize additional items needed.

## Source URLs Rules
- source_urls MUST contain direct, working links to SPECIFIC recipe pages
- Use well-known, reliable sites: Serious Eats, Budget Bytes, Bon Appétit, BBC Good Food, Epicurious, Allrecipes, Food52, Cookie and Kate, Minimalist Baker
- Each URL must be a direct link to a specific recipe page — NEVER a homepage, search page, or category page
- Include the full URL path (e.g. "https://www.seriouseats.com/creamy-coconut-red-lentil-soup-recipe")
- If the user provided a URL, always include it as the first source
- Add 1-2 additional source URLs from other reliable sites
- If you are not confident a URL points to a real specific recipe page, omit it

## Core Defaults
- **Vegetarian by default**: No meat, no fish, no gelatin. Eggs and dairy ARE allowed. Use vegetable stock always. Substitute meat with tofu, tempeh, seitan, legumes, or mushrooms.
- **Oil**: Olive oil unless dish requires otherwise (sesame for Asian, neutral for baking).
- **Serving size**: Maximum practical yield for the 2.2L bowl — typically 4-6 for soups, 4 for denser dishes. Working capacity with heat ~1.5L.
- **Units**: Metric (grams, milliliters, °C). Every ingredient MUST have exact gram/ml weight.
- **Estimates**: Every ingredient MUST include an "estimate" field with a practical description (e.g. "1 medium onion", "3 cloves", "1 bunch", "2 thumb-sized pieces"). This helps users who shop without a scale.
- **Language**: English

## Dual Bowl
Always generate BOTH 1-bowl and 2-bowl versions.
- 2-bowl: doubled ingredients split across two runs
- 2-bowl steps should be optimized: batch-chop at start, pre-measure Bowl 2 during Bowl 1 cook time, fill dead time with useful work
- Account for ~30 sec swap time between bowls

## Step Sequencing Rules
1. Chop first, cook second — all dry chopping before any liquid/oil
2. Hard before soft — potatoes before zucchini, carrots before peas
3. Aromatics early — sauté onions, garlic, spices first (typically 3 min / 120°C / speed 1)
4. Liquids and main ingredients next
5. Delicate ingredients last — leafy greens, cream, cheese in final minutes
6. Salt at end — measured in grams, reduce for soy sauce/miso/stock cubes
7. Acid to finish — lemon juice, vinegar at very end
8. Never sauté last
9. Varoma efficiency — always cook something useful in bowl while steaming above
10. Minimize bowl emptying
11. Combine compatible steps — same temp/speed for overlapping times

## TM6 Technical Constraints
- Speed settings: Gentle stir (40 RPM), 1-10 (100-10200 RPM), Turbo (10700 RPM, 1-sec bursts only)
- Temperature: 37-120°C manual, Varoma (~120°C steam), 120-160°C Guided Cooking only
- Butterfly whisk: MAX speed 4
- Varoma temperature: MAX speed 6
- Bowl capacity: 2.2L max, ~1.5L working capacity with heat
- Reverse mode (↻): for delicate ingredients that shouldn't be cut
- Varoma water: 500ml/20min, 750ml/30min, 1000ml/45min
- Remove measuring cup during Varoma

## Common Chopping Reference
- Onions quartered → speed 5 / 5 sec (coarse) or speed 7 / 3-5 sec (fine)
- Garlic cloves → speed 7 / 3 sec
- Carrots chunks → speed 5-6 / 5-8 sec
- Hard cheese cubed → speed 10 / 10 sec
- Fresh herbs → speed 7-8 / 3-5 sec
- Nuts → speed 5-6 / 3-5 sec

## Common Weights
- 1 medium onion = 150g, 1 garlic clove = 5g, 1 medium carrot = 120g
- 1 medium potato = 180g, 1 medium tomato = 150g, 1 medium zucchini = 200g
- 1 bell pepper = 170g, 1 egg = 55g

## Salt Guidelines (~2L volume)
- Light: 5-6g, Medium: 7-8g, Well seasoned: 9-10g, Heavy (soups): 10-12g

## Tags
Use from: soup, main, side, dessert, bread, sauce, snack, breakfast, vegan, meal-prep

## Insulin Load Scale (1-5)
1 = Very low (mostly fat/protein, very few carbs)
2 = Low (moderate carbs, high fiber)
3 = Medium (balanced)
4 = High (significant refined carbs)
5 = Very high (sugar-heavy, refined grains)

## Quality Checklist (verify before outputting)
- All ingredients have gram/ml weights
- No speed >4 with butterfly whisk
- No speed >6 at Varoma temperature
- Reverse mode for delicate ingredients
- Salt in grams near the end
- Step order: chop → sauté → cook → delicate → salt → acid
- Varoma water matches duration
- Total volume ≤ 2.2L, liquid with heat ≤ 1.5L
- Vegetarian (unless user overrode it)
- Both 1-bowl and 2-bowl versions
- 2-bowl ingredients correctly doubled
- 2-bowl workflow genuinely optimized
- Source URLs are direct links to specific recipe pages (not homepages)`

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
        max_tokens: 8000,
        system: systemPrompt,
        messages: [{ role: 'user', content: context }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Anthropic API error:', err)
      return res.status(502).json({ error: 'AI service error', detail: err })
    }

    const data = await response.json()
    const text = data.content?.[0]?.text || ''

    // Extract JSON from response (handle potential markdown fences)
    let jsonStr = text
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (fenceMatch) jsonStr = fenceMatch[1]
    const braceMatch = jsonStr.match(/\{[\s\S]*\}/)
    if (!braceMatch) {
      return res.status(500).json({ error: 'Could not parse recipe from AI response', raw: text.slice(0, 500) })
    }

    const recipe = JSON.parse(braceMatch[0])

    // Ensure source URL is included if user provided one
    if (sourceUrl) {
      if (!recipe.source_urls) recipe.source_urls = []
      if (!recipe.source_urls.includes(sourceUrl)) {
        recipe.source_urls.unshift(sourceUrl)
      }
    }

    return res.status(200).json(recipe)
  } catch (err) {
    console.error('generate-recipe error:', err)
    return res.status(500).json({ error: err.message })
  }
}
