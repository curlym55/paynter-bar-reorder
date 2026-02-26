import { fetchSquareData } from '../../lib/square'
import { calculateItem, CATEGORY_ORDER } from '../../lib/calculations'
import { kvGet } from '../../lib/redis'

export default async function handler(req, res) {
  const token = process.env.SQUARE_ACCESS_TOKEN
  if (!token) return res.status(500).json({ error: 'SQUARE_ACCESS_TOKEN not configured' })

  try {
    const daysBack    = parseInt(req.query.days) || 90
    const squareItems = await fetchSquareData(token, daysBack)
    const allSettings = (await kvGet('itemSettings').catch(() => null)) || {}
    const targetWeeks = (await kvGet('targetWeeks').catch(() => null))  || 6
    const suppliers   = (await kvGet('suppliers').catch(() => null))    || ['Dan Murphys', 'Coles Woolies', 'ACW']

    const items = squareItems.map(item => {
      const settings = allSettings[item.name] || {}
      const effectiveItem = settings.stockOverride !== undefined && settings.stockOverride !== null
        ? { ...item, onHand: settings.stockOverride }
        : item
      const calculated = calculateItem(effectiveItem, settings, targetWeeks)
      // Prices: Redis override wins, fall back to Square catalog price
      const buyPrice  = settings.buyPrice  !== undefined && settings.buyPrice  !== ''
        ? settings.buyPrice
        : (item.squareBuyPrice  ?? '')
      const sellPrice = settings.sellPrice !== undefined && settings.sellPrice !== ''
        ? settings.sellPrice
        : (item.squareSellPrice ?? '')

      return {
        ...calculated,
        stockOverride: settings.stockOverride ?? null,
        notes:      settings.notes || '',
        buyPrice,
        sellPrice,
        squareBuyPrice:  item.squareBuyPrice  ?? null,
        squareSellPrice: item.squareSellPrice ?? null,
      }
    })

    items.sort((a, b) => {
      const catDiff = (CATEGORY_ORDER[a.category] ?? 99) - (CATEGORY_ORDER[b.category] ?? 99)
      return catDiff !== 0 ? catDiff : a.name.localeCompare(b.name)
    })

    res.status(200).json({ items, targetWeeks, suppliers, daysBack, lastUpdated: new Date().toISOString() })
  } catch (err) {
    console.error('Items API error:', err)
    res.status(500).json({ error: err.message })
  }
}
