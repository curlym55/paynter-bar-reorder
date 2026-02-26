import { fetchSalesReport } from '../../lib/square'
import { kvGet } from '../../lib/redis'
import { defaultCategory } from '../../lib/calculations'

export default async function handler(req, res) {
  const token = process.env.SQUARE_ACCESS_TOKEN
  if (!token) return res.status(500).json({ error: 'SQUARE_ACCESS_TOKEN not configured' })

  try {
    const { start, end, compareStart, compareEnd } = req.query
    if (!start || !end) return res.status(400).json({ error: 'start and end required' })

    const allSettings = (await kvGet('itemSettings').catch(() => null)) || {}

    // Fetch main period and comparison period in parallel
    const [mainSold, compareSold] = await Promise.all([
      fetchSalesReport(token, start, end),
      compareStart && compareEnd ? fetchSalesReport(token, compareStart, compareEnd) : Promise.resolve({}),
    ])

    // Build item list with all metadata
    const itemMap = {}
    const allNames = new Set([...Object.keys(mainSold), ...Object.keys(compareSold)])

    for (const name of allNames) {
      const settings  = allSettings[name] || {}
      const category  = settings.category  || defaultCategory(name)
      const sellPrice = settings.sellPrice  || null
      const unitsSold = Math.round(mainSold[name]    || 0)
      const prevSold  = Math.round(compareSold[name] || 0)
      const revenue   = sellPrice && unitsSold ? +(unitsSold * Number(sellPrice)).toFixed(2) : null
      const prevRev   = sellPrice && prevSold  ? +(prevSold  * Number(sellPrice)).toFixed(2) : null
      const change    = prevSold > 0 ? +(((unitsSold - prevSold) / prevSold) * 100).toFixed(1) : null

      if (unitsSold > 0 || prevSold > 0) {
        itemMap[name] = { name, category, unitsSold, prevSold, change, revenue, prevRev, sellPrice: sellPrice ? Number(sellPrice) : null }
      }
    }

    const items = Object.values(itemMap).sort((a, b) => b.unitsSold - a.unitsSold)

    // Category breakdown
    const categories = {}
    for (const item of items) {
      if (!categories[item.category]) categories[item.category] = { unitsSold: 0, prevSold: 0, revenue: 0, prevRev: 0 }
      categories[item.category].unitsSold += item.unitsSold
      categories[item.category].prevSold  += item.prevSold
      categories[item.category].revenue   += item.revenue || 0
      categories[item.category].prevRev   += item.prevRev || 0
    }

    const totals = {
      unitsSold: items.reduce((s, i) => s + i.unitsSold, 0),
      prevSold:  items.reduce((s, i) => s + i.prevSold, 0),
      revenue:   +items.reduce((s, i) => s + (i.revenue || 0), 0).toFixed(2),
      prevRev:   +items.reduce((s, i) => s + (i.prevRev || 0), 0).toFixed(2),
    }

    res.status(200).json({ items, categories, totals, hasCompare: !!(compareStart && compareEnd) })
  } catch (err) {
    console.error('Sales API error:', err)
    res.status(500).json({ error: err.message })
  }
}
