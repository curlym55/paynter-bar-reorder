import { kvGet, kvSet } from '../../lib/redis'

function generateId(orders, supplier) {
  const d = new Date()
  const date = `${String(d.getDate()).padStart(2,'0')}${String(d.getMonth()+1).padStart(2,'0')}${d.getFullYear()}`
  // Custom abbreviations for known suppliers
  const ABBR = {
    'dan murphys':    'Dans',
    'coles woolies':  'Cole',
    'coles/woolies':  'Cole',
    'acw':            'ACW',
  }
  const key = (supplier || '').toLowerCase().trim()
  const abbr = ABBR[key] || (supplier || 'GEN').replace(/[^a-zA-Z]/g, '').slice(0, 4)
  const nums = orders.map(o => parseInt((o.id || '').replace(/[^0-9]/, ''))).filter(n => !isNaN(n))
  const next = nums.length ? Math.max(...nums) + 1 : 100
  return `PO${next}-${abbr}-${date}`
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
        id:        generateId(orders, supplier),
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
