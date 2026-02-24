import { fetchSquareData } from '../../lib/square'
import { calculateItem, defaultCategory, defaultSupplier, defaultPack } from '../../lib/calculations'
import { kv } from '@vercel/kv'

export default async function handler(req, res) {
  const token = process.env.SQUARE_ACCESS_TOKEN
  if (!token) {
    return res.status(500).json({ error: 'SQUARE_ACCESS_TOKEN not configured' })
  }

  try {
    // Fetch live Square data
    const squareItems = await fetchSquareData(token)

    // Load saved settings
    let allSettings = {}
    try {
      allSettings = (await kv.get('itemSettings')) || {}
    } catch (e) {
      // KV not available - use defaults
      allSettings = {}
    }

    const targetWeeks = (await kv.get('targetWeeks').catch(() => null)) || 6

    // Merge Square data with settings and calculate
    const items = squareItems.map(item => {
      const settings = allSettings[item.name] || {}
      return calculateItem(item, settings, targetWeeks)
    })

    // Sort by category order then name
    const { CATEGORY_ORDER } = require('../../lib/calculations')
    items.sort((a, b) => {
      const catDiff = (CATEGORY_ORDER[a.category] ?? 99) - (CATEGORY_ORDER[b.category] ?? 99)
      return catDiff !== 0 ? catDiff : a.name.localeCompare(b.name)
    })

    res.status(200).json({ items, targetWeeks, lastUpdated: new Date().toISOString() })
  } catch (err) {
    console.error('Items API error:', err)
    res.status(500).json({ error: err.message })
  }
}
