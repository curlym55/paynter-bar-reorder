import { kvGet, kvSet } from '../../lib/redis'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const settings     = (await kvGet('itemSettings')) || {}
      const targetWeeks  = (await kvGet('targetWeeks'))  || 6
      const suppliers    = (await kvGet('suppliers'))    || ['Dan Murphys', 'Coles Woolies', 'ACW']
      res.status(200).json({ settings, targetWeeks, suppliers })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  } else if (req.method === 'POST') {
    try {
      const { itemName, field, value } = req.body
      if (!itemName || !field) return res.status(400).json({ error: 'itemName and field required' })

      if (field === 'targetWeeks') {
        await kvSet('targetWeeks', Number(value))
        return res.status(200).json({ ok: true })
      }

      if (field === 'suppliers') {
        await kvSet('suppliers', value)
        return res.status(200).json({ ok: true })
      }

      const allSettings = (await kvGet('itemSettings')) || {}
      if (!allSettings[itemName]) allSettings[itemName] = {}

      const numFields = ['pack', 'bottleML', 'nipML', 'stockOverride']
      if (value === null || value === '') {
        delete allSettings[itemName][field]
      } else {
        allSettings[itemName][field] = numFields.includes(field) ? Number(value) : value
      }

      await kvSet('itemSettings', allSettings)
      res.status(200).json({ ok: true })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' })
  }
}
