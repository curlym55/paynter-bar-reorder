import { kvGet, kvSet } from '../../lib/redis'

function generateId() {
  return `PO-${Date.now()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`
}

export default async function handler(req, res) {
  try {
    const orders = (await kvGet('purchaseOrders').catch(() => null)) || []

    if (req.method === 'GET') {
      // Return all or filter by status
      const { status, id } = req.query
      if (id) {
        const order = orders.find(o => o.id === id)
        if (!order) return res.status(404).json({ error: 'Not found' })
        return res.json({ order })
      }
      const filtered = status ? orders.filter(o => o.status === status) : orders
      // Most recent first
      return res.json({ orders: filtered.sort((a,b) => b.createdAt - a.createdAt) })
    }

    if (req.method === 'POST') {
      const { supplier, items, notes } = req.body
      if (!supplier || !items?.length) return res.status(400).json({ error: 'supplier and items required' })
      const po = {
        id:        generateId(),
        supplier,
        status:    'DRAFT',     // DRAFT → SENT → RECEIVED
        createdAt: Date.now(),
        updatedAt: Date.now(),
        notes:     notes || '',
        items:     items.map(i => ({
          name:        i.name,
          category:    i.category || '',
          orderQty:    i.orderQty,
          unit:        i.unit || 'units',
          buyPrice:    i.buyPrice || null,
          receivedQty: null,   // filled in on receipt
          notes:       '',
        }))
      }
      orders.push(po)
      await kvSet('purchaseOrders', orders)
      return res.json({ order: po })
    }

    if (req.method === 'PUT') {
      const { id } = req.query
      if (!id) return res.status(400).json({ error: 'id required' })
      const idx = orders.findIndex(o => o.id === id)
      if (idx === -1) return res.status(404).json({ error: 'Not found' })
      const updates = req.body
      orders[idx] = { ...orders[idx], ...updates, id, updatedAt: Date.now() }
      await kvSet('purchaseOrders', orders)
      return res.json({ order: orders[idx] })
    }

    if (req.method === 'DELETE') {
      const { id } = req.query
      if (!id) return res.status(400).json({ error: 'id required' })
      const filtered = orders.filter(o => o.id !== id)
      await kvSet('purchaseOrders', filtered)
      return res.json({ ok: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })

  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
