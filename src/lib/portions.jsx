const ESTIMATES = [
  [/onion/, 150, 'medium onion'],
  [/garlic/, 5, 'clove'],
  [/potato/, 180, 'medium potato'],
  [/carrot/, 120, 'medium carrot'],
  [/tomato(?!.*paste|.*sauce)/, 150, 'medium tomato'],
  [/egg/, 55, 'egg'],
  [/pepper|bell/, 170, 'pepper'],
  [/zucchini|courgette/, 200, 'medium zucchini'],
  [/lemon/, 60, 'lemon'],
  [/lime/, 45, 'lime'],
  [/cilantro|coriander.*fresh/, 30, 'bunch'],
  [/parsley/, 30, 'bunch'],
  [/basil/, 20, 'bunch'],
  [/ginger/, 15, 'thumb piece'],
  [/avocado/, 170, 'avocado'],
  [/banana/, 120, 'banana'],
  [/apple/, 180, 'apple'],
  [/celery/, 60, 'stalk'],
  [/broccoli/, 300, 'head'],
  [/cauliflower/, 600, 'head'],
  [/cucumber/, 300, 'cucumber'],
  [/sweet potato/, 250, 'sweet potato'],
  [/butter/, 14, 'tbsp'],
  [/salt/, 6, 'tsp'],
  [/sugar/, 12, 'tbsp'],
  [/flour/, 125, 'cup'],
  [/rice/, 185, 'cup'],
  [/olive oil/, 14, 'tbsp'],
  [/oil/, 14, 'tbsp'],
  [/cream/, 240, 'cup'],
  [/milk/, 240, 'cup'],
  [/coconut milk/, 240, 'cup'],
  [/stock|broth/, 240, 'cup'],
  [/water/, 240, 'cup'],
  [/lentil/, 200, 'cup'],
  [/chickpea/, 160, 'cup'],
  [/cheese/, 28, 'slice'],
]

export function getMeasurements(name, qty, unit, estimate) {
  const g = parseFloat(qty)
  const result = { metric: '', imperial: '', visual: '' }
  if (!qty && !unit) return result

  result.metric = `${qty || ''}${unit || ''}`

  if (g && !isNaN(g)) {
    if (unit === 'g') {
      result.imperial = g >= 1000
        ? `${(g / 453.6).toFixed(1)} lb`
        : `${(g / 28.35).toFixed(1)} oz`
    } else if (unit === 'ml') {
      if (g >= 1000) result.imperial = `${(g / 946).toFixed(1)} qt`
      else if (g >= 240) result.imperial = `${(g / 240).toFixed(1)} cups`
      else if (g >= 15) result.imperial = `${(g / 29.57).toFixed(1)} fl oz`
      else result.imperial = `${Math.round(g / 5)} tsp`
    }
  }

  if (estimate) {
    result.visual = estimate
  } else if (g && !isNaN(g) && (unit === 'g' || unit === 'ml')) {
    const lower = (name || '').toLowerCase()
    for (const [regex, weight, label] of ESTIMATES) {
      if (regex.test(lower)) {
        const count = g / weight
        const rounded = Math.round(count * 2) / 2
        if (rounded > 0) {
          const plural = rounded !== 1 && !label.includes('bunch') && !label.includes('piece') && !label.includes('cup') && !label.includes('tbsp') && !label.includes('tsp') ? 's' : ''
          result.visual = `~${rounded} ${label}${plural}`
        }
        break
      }
    }
  }

  return result
}

// Visual-first: shows estimate first (green), then metric + imperial as secondary
export function MeasurementBadges({ name, qty, unit, estimate, compact = false }) {
  const m = getMeasurements(name, qty, unit, estimate)
  if (!m.metric && !m.imperial && !m.visual) return null

  const primary = m.visual || m.metric
  const secondary = m.visual ? m.metric : ''

  if (compact) {
    return (
      <span className="text-xs tabular-nums">
        <span className="font-semibold text-[#2e7d6f]">{primary}</span>
        {secondary && <span className="text-accent ml-1">({secondary})</span>}
        {m.imperial && <span className="text-[#2563eb] ml-1">{m.imperial}</span>}
      </span>
    )
  }

  return (
    <div className="flex flex-wrap gap-1.5 mt-0.5">
      <span className="text-xs font-semibold text-[#2e7d6f] tabular-nums">{primary}</span>
      {secondary && <span className="text-[0.65rem] text-accent font-mono tabular-nums">{secondary}</span>}
      {m.imperial && <span className="text-[0.65rem] text-[#2563eb] font-mono tabular-nums">{m.imperial}</span>}
    </div>
  )
}

export function MeasurementBadgesDark({ name, qty, unit, estimate }) {
  const m = getMeasurements(name, qty, unit, estimate)
  if (!m.metric && !m.imperial && !m.visual) return null

  const primary = m.visual || m.metric
  const secondary = m.visual ? m.metric : ''

  return (
    <div className="flex flex-wrap gap-1.5">
      <span className="text-xs font-semibold text-[#86efac] tabular-nums">{primary}</span>
      {secondary && <span className="text-[0.65rem] text-dark-warm-light font-mono tabular-nums">{secondary}</span>}
      {m.imperial && <span className="text-[0.65rem] text-[#93c5fd] font-mono tabular-nums">{m.imperial}</span>}
    </div>
  )
}
