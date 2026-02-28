const BASE_URL = 'https://connect.squareup.com/v2'

async function getLocationId(token) {
  const r = await fetch(`${BASE_URL}/locations`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Square-Version': '2025-03-19' }
  })
  const data = await r.json()
  const active = (data.locations || []).filter(l => l.status === 'ACTIVE')
  if (!active.length) throw new Error('No active Square locations found')
  return active[0].id
}

export default async function handler(req, res) {
  const token = process.env.SQUARE_ACCESS_TOKEN
  if (!token) return res.status(500).json({ error: 'SQUARE_ACCESS_TOKEN not configured' })

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Square-Version': '2025-03-19',
  }

  try {
    const locationId = await getLocationId(token)

    if (req.method === 'GET') {
      // Try without location filter first to see what fields are accepted
      const body = { limit: 20 }

      const r = await fetch(`${BASE_URL}/purchase-orders/search`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })
      const data = await r.json()

      if (!r.ok) {
        return res.status(r.status).json({
          error: data.errors?.[0]?.detail || 'Square API error',
          code:  data.errors?.[0]?.code,
          raw:   data
        })
      }

      // Filter to this location client-side
      const orders = (data.purchase_orders || []).filter(o => o.location_id === locationId)
      return res.json({ orders, locationId, total: data.purchase_orders?.length, cursor: data.cursor || null })
    }

    return res.status(405).json({ error: 'Method not allowed' })

  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
