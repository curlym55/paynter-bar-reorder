import { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'
import { CATEGORIES } from '../lib/calculations'

const DEFAULT_SUPPLIERS = ['Dan Murphys', 'Coles Woolies', 'ACW']

const PRIORITY_COLORS = {
  CRITICAL: { bg: '#fee2e2', text: '#991b1b', badge: '#dc2626' },
  LOW:      { bg: '#fef9c3', text: '#854d0e', badge: '#ca8a04' },
  OK:       { bg: '#f0fdf4', text: '#166534', badge: '#16a34a' },
}

const SUPPLIER_COLORS = {
  'Dan Murphys':   '#1f4e79',
  'Coles Woolies': '#c2410c',
  'ACW':           '#166534',
}

const CATEGORY_ORDER_LIST = [
  'Beer','Cider','PreMix','White Wine','Red Wine','Rose',
  'Sparkling','Fortified & Liqueurs','Spirits','Soft Drinks','Snacks'
]

export default function Home() {
  const [authed, setAuthed]             = useState(false)
  const [readOnly, setReadOnly]         = useState(false)
  const [pin, setPin]                   = useState('')
  const [pinError, setPinError]         = useState(false)
  const [items, setItems]               = useState([])
  const [loading, setLoading]           = useState(true)
  const [refreshing, setRefreshing]     = useState(false)
  const [error, setError]               = useState(null)
  const [lastUpdated, setLastUpdated]   = useState(null)
  const [targetWeeks, setTargetWeeks]   = useState(6)
  const [view, setView]                 = useState('all')
  const [filterOrder, setFilterOrder]   = useState(false)
  const [saving, setSaving]             = useState({})
  const [editingTarget, setEditingTarget] = useState(false)
  const [suppliers, setSuppliers]       = useState(DEFAULT_SUPPLIERS)
  const [addingSupplier, setAddingSupplier] = useState(false)
  const [newSupplierName, setNewSupplierName] = useState('')
  const [printing, setPrinting]         = useState(null)
  const [daysBack, setDaysBack]         = useState(90)
  const [viewMode, setViewMode]         = useState('reorder')
  const [mainTab, setMainTab]           = useState('home')
  const [salesPeriod, setSalesPeriod]   = useState('month')
  const [salesCustom, setSalesCustom]   = useState({ start: '', end: '' })
  const [salesReport, setSalesReport]   = useState(null)
  const [salesLoading, setSalesLoading] = useState(false)
  const [salesError, setSalesError]     = useState(null)
  const [salesCategory, setSalesCategory] = useState('All')
  const [salesSort, setSalesSort]       = useState('units')
  const [trendData, setTrendData]       = useState(null)
  const [trendLoading, setTrendLoading] = useState(false)
  const [trendError, setTrendError]     = useState(null)
  const [sellersData, setSellersData]   = useState(null)
  const [sellersLoading, setSellersLoading] = useState(false)
  const [sellersError, setSellersError] = useState(null)
  const [priceListSettings, setPriceListSettings] = useState({}) // { itemName: { hidden: bool, priceOverride: num, label: str } }
  const [plSaving, setPlSaving]         = useState({})

  useEffect(() => {
    if (sessionStorage.getItem('bar_authed') === 'yes') {
      setAuthed(true)
      if (sessionStorage.getItem('bar_readonly') === 'yes') setReadOnly(true)
    }
  }, [])

  function checkPin() {
    if (pin === '5554') {
      sessionStorage.setItem('bar_authed', 'yes')
      sessionStorage.setItem('bar_readonly', 'yes')
      setReadOnly(true)
      setAuthed(true)
      setPin('')
      return
    }
    if (pin === '3838') {
      sessionStorage.setItem('bar_authed', 'yes')
      sessionStorage.removeItem('bar_readonly')
      setAuthed(true)
      setPinError(false)
    } else {
      setPinError(true)
      setPin('')
    }
  }

  const loadItems = useCallback(async (showRefresh = false, days = null) => {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const effectiveDays = days || daysBack
      const r = await fetch(`/api/items?days=${effectiveDays}`)
      if (!r.ok) throw new Error((await r.json()).error || 'Failed to load')
      const data = await r.json()
      setItems(data.items)
      setTargetWeeks(data.targetWeeks)
      setLastUpdated(data.lastUpdated)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { loadItems() }, [loadItems])

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(data => {
      if (data.suppliers) setSuppliers(data.suppliers)
    }).catch(() => {})
  }, [])

  async function loadSalesReport(period, custom) {
    setSalesLoading(true)
    setSalesError(null)
    setSalesReport(null)
    try {
      const now = new Date()
      let start, end, compareStart, compareEnd

      if (period === 'month') {
        end   = new Date(now)
        start = new Date(now.getFullYear(), now.getMonth(), 1)
        compareEnd   = new Date(start.getTime() - 1)
        compareStart = new Date(compareEnd.getFullYear(), compareEnd.getMonth(), 1)
      } else if (period === '3months') {
        end   = new Date(now)
        start = new Date(now); start.setMonth(start.getMonth() - 3); start.setHours(0,0,0,0)
        compareEnd   = new Date(start.getTime() - 1)
        compareStart = new Date(compareEnd); compareStart.setMonth(compareStart.getMonth() - 3); compareStart.setHours(0,0,0,0)
      } else if (period === 'custom' && custom.start && custom.end) {
        start = new Date(custom.start); start.setHours(0,0,0,0)
        end   = new Date(custom.end);   end.setHours(23,59,59,999)
        const days = Math.round((end - start) / 86400000) + 1
        compareEnd   = new Date(start.getTime() - 1)
        compareStart = new Date(compareEnd.getTime() - days * 86400000)
      } else return

      end.setHours(23,59,59,999)

      const params = new URLSearchParams({
        start:        start.toISOString(),
        end:          end.toISOString(),
        compareStart: compareStart.toISOString(),
        compareEnd:   compareEnd.toISOString(),
      })
      const r = await fetch(`/api/sales?${params}`)
      if (!r.ok) throw new Error((await r.json()).error || 'Failed')
      const data = await r.json()
      setSalesReport(data)
    } catch(e) {
      setSalesError(e.message)
    } finally {
      setSalesLoading(false)
    }
  }

  async function loadSellersData() {
    if (sellersData) return   // already loaded
    setSellersLoading(true)
    setSellersError(null)
    try {
      const end   = new Date(); end.setHours(23,59,59,999)
      const start = new Date(); start.setDate(start.getDate() - 90); start.setHours(0,0,0,0)
      // dummy compare range (required by API but not used here)
      const compareEnd   = new Date(start.getTime() - 1)
      const compareStart = new Date(compareEnd); compareStart.setDate(compareStart.getDate() - 90)
      const params = new URLSearchParams({
        start: start.toISOString(), end: end.toISOString(),
        compareStart: compareStart.toISOString(), compareEnd: compareEnd.toISOString(),
      })
      const r = await fetch(`/api/sales?${params}`)
      if (!r.ok) throw new Error((await r.json()).error || 'Failed')
      const data = await r.json()
      setSellersData(data)
    } catch(e) {
      setSellersError(e.message)
    } finally {
      setSellersLoading(false)
    }
  }

  async function saveSetting(itemName, field, value) {
    const key = `${itemName}_${field}`
    setSaving(s => ({ ...s, [key]: true }))
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemName, field, value })
      })
      setItems(prev => prev.map(item => {
        if (item.name !== itemName) return item
        return { ...item, [field]: ['pack','bottleML','nipML','stockOverride'].includes(field) ? Number(value) : value }
      }))
    } finally {
      setSaving(s => { const n = { ...s }; delete n[key]; return n })
    }
  }

  async function saveTargetWeeks(val) {
    const weeks = Number(val)
    if (!weeks || weeks < 1 || weeks > 26) return
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemName: '_global', field: 'targetWeeks', value: weeks })
    })
    setTargetWeeks(weeks)
    setEditingTarget(false)
    loadItems(true)
  }

  async function addSupplier() {
    const name = newSupplierName.trim()
    if (!name) return
    const updated = [...suppliers, name]
    setSuppliers(updated)
    setNewSupplierName('')
    setAddingSupplier(false)
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemName: '_global', field: 'suppliers', value: updated })
    })
  }


  // ── LOAD QUARTERLY TREND DATA ─────────────────────────────────────────────
  async function loadTrendData() {
    setTrendLoading(true)
    setTrendError(null)
    try {
      const now = new Date()
      const yr  = now.getFullYear()
      const mo  = now.getMonth() // 0-indexed

      // Build last 4 calendar quarters (Jan-Mar, Apr-Jun, Jul-Sep, Oct-Dec)
      // Work out which quarter we're currently in, then go back 4 from the last completed one
      // Quarter index: 0=Jan-Mar, 1=Apr-Jun, 2=Jul-Sep, 3=Oct-Dec
      const currentQ = Math.floor(mo / 3)
      // Last completed quarter
      let q = currentQ - 1
      let y = yr
      if (q < 0) { q = 3; y = yr - 1 }

      const quarters = []
      for (let i = 0; i < 4; i++) {
        const startMonth = q * 3           // 0, 3, 6, or 9
        const endMonth   = startMonth + 2  // 2, 5, 8, or 11
        const lastDay    = new Date(y, endMonth + 1, 0).getDate()
        const start      = new Date(y, startMonth, 1, 0, 0, 0)
        const end        = new Date(y, endMonth, lastDay, 23, 59, 59)
        const qNames     = ['Jan–Mar','Apr–Jun','Jul–Sep','Oct–Dec']
        quarters.unshift({ start, end, label: `${qNames[q]} ${y}` })
        q--
        if (q < 0) { q = 3; y-- }
      }

      const results = await Promise.all(quarters.map(async q => {
        const params = new URLSearchParams({ start: q.start.toISOString(), end: q.end.toISOString() })
        const r = await fetch(`/api/sales?${params}`)
        if (!r.ok) throw new Error('Failed to fetch quarter data')
        const d = await r.json()
        return { label: q.label, categories: d.categories, totals: d.totals }
      }))
      setTrendData(results)
    } catch(e) {
      setTrendError(e.message)
    } finally {
      setTrendLoading(false)
    }
  }

  // ── GENERATE AGM ANNUAL REPORT PDF ────────────────────────────────────────
  async function savePriceListSetting(itemName, field, value) {
    const key = `${itemName}_${field}`
    setPlSaving(s => ({ ...s, [key]: true }))
    try {
      const current = priceListSettings[itemName] || {}
      const updated = { ...priceListSettings, [itemName]: { ...current, [field]: value } }
      setPriceListSettings(updated)
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setItem', name: `__pl_${itemName}`, field, value })
      })
    } finally {
      setPlSaving(s => ({ ...s, [key]: false }))
    }
  }

  // Load price list settings on mount alongside items
  useEffect(() => {
    async function loadPriceListSettings() {
      try {
        const r = await fetch('/api/settings?action=getPriceList')
        if (r.ok) {
          const d = await r.json()
          setPriceListSettings(d.priceList || {})
        }
      } catch(e) { /* silent */ }
    }
    if (authed) loadPriceListSettings()
  }, [authed])

  // ── GENERATE PRICE LIST PDF ───────────────────────────────────────────────
  function generatePriceListPDF(items, settings) {
    const CATEGORY_ORDER = ['Beer','Cider','PreMix','White Wine','Red Wine','Rose','Sparkling','Fortified & Liqueurs','Spirits','Soft Drinks','Snacks']
    const generated = new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'long', year: 'numeric' })

    // Group visible items by category
    const grouped = {}
    for (const item of items) {
      const pl  = settings[item.name] || {}
      if (pl.hidden) continue
      if ((item.onHand || 0) <= 0) continue   // skip zero stock
      const cat = item.category || 'Other'
      const price = item.sellPrice != null ? item.sellPrice : item.squareSellPrice
      const label = pl.label || item.name
      const rawVars = (item.variations || []).filter(v => v.price != null)
      let variations = null
      if (rawVars.length > 1) {
        variations = rawVars
          .map(v => {
            const n = v.name.toLowerCase()
            const name = n.includes('glass') || n.includes('wine glass') ? 'Glass'
                       : n.includes('bottle') || n === 'regular' ? 'Bottle'
                       : v.name
            return { ...v, name }
          })
          .sort((a, b) => a.name === 'Glass' ? -1 : b.name === 'Glass' ? 1 : 0)
      }
      if (!grouped[cat]) grouped[cat] = []
      grouped[cat].push({ label, price, variations })
    }

    const cats = CATEGORY_ORDER.filter(c => grouped[c])

    // Split categories into two balanced halves by item row count
    const itemCount = cat => grouped[cat].reduce((s, i) => s + (i.variations ? i.variations.length : 1), 0)
    const totalRows = cats.reduce((s, c) => s + itemCount(c), 0)
    let running = 0, splitAt = Math.ceil(cats.length / 2)
    for (let i = 0; i < cats.length; i++) {
      running += itemCount(cats[i])
      if (running >= totalRows / 2) { splitAt = i + 1; break }
    }
    const page1cats = cats.slice(0, splitAt)
    const page2cats = cats.slice(splitAt)

    function renderCards(pageCats) {
      return pageCats.map(cat => `
        <div class="card">
          <div class="cat-hdr">${cat}</div>
          <table>
            ${grouped[cat].map(({ label, price, variations }) => `
              <tr>
                <td class="nm">${label}</td>
                <td class="pr">${variations
                  ? `<table style="border-collapse:collapse;width:100%;line-height:1.3">${variations.map(v => `<tr><td style="font-size:12px;color:#64748b;padding:3px 8px 3px 0;white-space:nowrap">${v.name}</td><td style="font-size:14px;font-weight:700;font-family:Courier New,monospace;text-align:right;padding:3px 0;white-space:nowrap">$${Number(v.price).toFixed(2)}</td></tr>`).join('')}</table>`
                  : (price != null ? '$' + Number(price).toFixed(2) : '&mdash;')
                }</td>
              </tr>`).join('')}
          </table>
        </div>`).join('')
    }

    const hdr = `
      <div class="hdr">
        <div><div class="title">🍺 Paynter Bar</div><div class="sub">GemLife Palmwoods &nbsp;·&nbsp; Current Prices</div></div>
        <div class="badge">Price List</div>
      </div>`

    const html = `<!DOCTYPE html><html><head>
<meta charset="UTF-8">
<title>Paynter Bar Price List</title>
<style>
  @page { size: A4 portrait; margin: 10mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #1f2937; background: #fff; }

  .hdr {
    display: flex; justify-content: space-between; align-items: center;
    background: #1e40af; color: #fff;
    padding: 10px 16px; border-radius: 6px; margin-bottom: 10px;
  }
  .title { font-size: 20px; font-weight: 800; }
  .sub   { font-size: 10px; color: #bfdbfe; margin-top: 2px; }
  .badge { background: #f59e0b; color: #0f172a; font-size: 10px; font-weight: 700; padding: 3px 10px; border-radius: 99px; }

  .cols { columns: 2; column-gap: 10px; }

  .card {
    break-inside: avoid;
    border: 1px solid #e2e8f0; border-radius: 5px;
    overflow: hidden; margin-bottom: 8px;
    display: inline-block; width: 100%;
  }
  .cat-hdr {
    background: #1e3a5f; color: #fff;
    font-size: 13px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.07em;
    padding: 8px 14px;
  }
  table { width: 100%; border-collapse: collapse; }
  tr:nth-child(even) td { background: #f8fafc; }
  .nm { padding: 7px 14px; font-size: 15px; }
  .pr {
    padding: 7px 14px; text-align: right;
    font-size: 16px; font-weight: 700;
    font-family: 'Courier New', monospace;
    white-space: nowrap; width: 82px; vertical-align: top;
  }
  .vr { display: flex; justify-content: space-between; gap: 4px; line-height: 1.6; }
  .vn { font-size: 12px; color: #64748b; font-weight: 400; font-family: Arial; }

  .page-break { page-break-before: always; }

  .ftr {
    text-align: center; font-size: 8.5px; color: #94a3b8;
    margin-top: 8px; padding-top: 4px;
    border-top: 1px solid #f1f5f9;
  }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .hdr, .cat-hdr { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head><body>

  ${hdr}
  <div class="cols">${renderCards(page1cats)}</div>
  <div class="ftr">Page 1 of 2 &nbsp;·&nbsp; Prices current as of ${generated} &nbsp;·&nbsp; Paynter Bar, GemLife Palmwoods</div>

  <div class="page-break">
    ${hdr}
    <div class="cols">${renderCards(page2cats)}</div>
    <div class="ftr">Page 2 of 2 &nbsp;·&nbsp; Prices current as of ${generated} &nbsp;·&nbsp; Paynter Bar, GemLife Palmwoods</div>
  </div>

</body></html>`

    const w = window.open('', '_blank')
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 600)
  }

  function generateStockReport() {
    const date = new Date()
    const monthName = date.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
    const generated = date.toLocaleString('en-AU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

    // Group by category
    const byCategory = {}
    for (const item of items) {
      const cat = item.category || 'Uncategorised'
      if (!byCategory[cat]) byCategory[cat] = []
      byCategory[cat].push(item)
    }

    const CATEGORY_ORDER = ['Beer','Cider','PreMix','White Wine','Red Wine','Rose','Sparkling','Fortified & Liqueurs','Spirits','Soft Drinks','Snacks']
    const sortedCats = [...CATEGORY_ORDER.filter(c => byCategory[c]), ...Object.keys(byCategory).filter(c => !CATEGORY_ORDER.includes(c))]

    const critItems  = items.filter(i => i.priority === 'CRITICAL')
    const lowItems   = items.filter(i => i.priority === 'LOW')
    const orderItems = items.filter(i => i.orderQty > 0)

    let categorySections = ''
    for (const cat of sortedCats) {
      const catItems = byCategory[cat].sort((a, b) => a.name.localeCompare(b.name))
      const rows = catItems.map(item => {
        const priorityColor = item.priority === 'CRITICAL' ? '#dc2626' : item.priority === 'LOW' ? '#ca8a04' : '#16a34a'
        const rowBg = item.priority === 'CRITICAL' ? '#fff5f5' : item.priority === 'LOW' ? '#fffbeb' : '#fff'
        const orderQty = item.isSpirit
          ? (item.nipsToOrder > 0 ? `${item.nipsToOrder} nips (${item.bottlesToOrder} btl)` : '—')
          : (item.orderQty > 0 ? item.orderQty : '—')
        return `<tr style="background:${rowBg}">
          <td>${item.name}</td>
          <td style="text-align:right;font-family:monospace">${item.onHand}</td>
          <td style="text-align:right;font-family:monospace">${item.weeklyAvg}</td>
          <td style="text-align:right;font-family:monospace">${item.targetStock}</td>
          <td style="text-align:center;color:${priorityColor};font-weight:700;font-size:11px">${item.priority}</td>
          <td style="text-align:right;font-weight:${item.orderQty > 0 ? '700' : '400'}">${orderQty}</td>
          <td style="color:#64748b;font-size:11px">${item.supplier || ''}</td>
        </tr>`
      }).join('')
      categorySections += `
        <tr class="cat-header"><td colspan="7">${cat} <span style="font-weight:400;font-size:11px">(${catItems.length} items)</span></td></tr>
        ${rows}
        <tr class="spacer"><td colspan="7"></td></tr>`
    }

    const html = `<!DOCTYPE html><html><head><title>Stock on Hand — ${monthName}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #1f2937; background: #fff; }
  .page { padding: 28px 32px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0f172a; padding-bottom: 14px; margin-bottom: 20px; }
  .header-left h1 { font-size: 20px; font-weight: 700; color: #0f172a; }
  .header-left p { font-size: 11px; color: #64748b; margin-top: 3px; }
  .header-right { text-align: right; font-size: 11px; color: #64748b; line-height: 1.6; }
  .header-right strong { color: #0f172a; font-size: 13px; display: block; }
  .summary { display: flex; gap: 0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 22px; }
  .summary-card { flex: 1; padding: 12px 16px; border-right: 1px solid #e2e8f0; }
  .summary-card:last-child { border-right: none; }
  .summary-card .num { font-size: 22px; font-weight: 700; font-family: monospace; color: #0f172a; }
  .summary-card .lbl { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; margin-top: 2px; }
  .summary-card.crit .num { color: #dc2626; }
  .summary-card.low .num  { color: #ca8a04; }
  .summary-card.ord .num  { color: #2563eb; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #0f172a; color: #fff; padding: 7px 10px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; }
  th:nth-child(2), th:nth-child(3), th:nth-child(4), th:nth-child(6) { text-align: right; }
  td { padding: 6px 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px; }
  tr.cat-header td { background: #f1f5f9; font-weight: 700; font-size: 11px; color: #374151; padding: 8px 10px; border-top: 2px solid #e2e8f0; text-transform: uppercase; letter-spacing: 0.04em; }
  tr.spacer td { height: 4px; background: #fff; border: none; }
  .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }
  @media print {
    body { font-size: 11px; }
    .page { padding: 16px; }
    tr { page-break-inside: avoid; }
    tr.cat-header { page-break-before: auto; }
  }
</style>
</head><body><div class="page">
  <div class="header">
    <div class="header-left">
      <h1>Stock on Hand Report</h1>
      <p>Paynter Bar — GemLife Palmwoods</p>
    </div>
    <div class="header-right">
      <strong>${monthName}</strong>
      Generated: ${generated}<br>
      Sales period: ${daysBack} days<br>
      Target: ${targetWeeks} weeks stock
    </div>
  </div>
  <div class="summary">
    <div class="summary-card"><div class="num">${items.length}</div><div class="lbl">Total Items</div></div>
    <div class="summary-card crit"><div class="num">${critItems.length}</div><div class="lbl">Critical Stock</div></div>
    <div class="summary-card low"><div class="num">${lowItems.length}</div><div class="lbl">Low Stock</div></div>
    <div class="summary-card ord"><div class="num">${orderItems.length}</div><div class="lbl">Items to Order</div></div>
  </div>
  <table>
    <thead><tr>
      <th>Item</th><th>On Hand</th><th>Wkly Avg</th><th>Target</th><th style="text-align:center">Status</th><th>Order Qty</th><th>Supplier</th>
    </tr></thead>
    <tbody>${categorySections}</tbody>
  </table>
  <div class="footer">
    <span>Paynter Bar Reorder System — Data from Square POS</span>
    <span>Page 1</span>
  </div>
</div></body></html>`

    const w = window.open('', '_blank')
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 600)
  }

  async function generateSalesReport() {
    const now   = new Date()
    // Last completed month
    const end   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59) // last day of prev month
    const start = new Date(end.getFullYear(), end.getMonth(), 1, 0, 0, 0)
    const monthName = start.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
    const generated = now.toLocaleString('en-AU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

    // Compare to month before
    const compareEnd   = new Date(start.getTime() - 1)
    const compareStart = new Date(compareEnd.getFullYear(), compareEnd.getMonth(), 1)

    const params = new URLSearchParams({
      start: start.toISOString(), end: end.toISOString(),
      compareStart: compareStart.toISOString(), compareEnd: compareEnd.toISOString(),
    })

    let report
    try {
      const r = await fetch(`/api/sales?${params}`)
      if (!r.ok) throw new Error('Failed to fetch sales data')
      report = await r.json()
    } catch(e) {
      alert('Could not fetch sales data: ' + e.message)
      return
    }

    const CATEGORY_ORDER = ['Beer','Cider','PreMix','White Wine','Red Wine','Rose','Sparkling','Fortified & Liqueurs','Spirits','Soft Drinks','Snacks']
    const hasRev = report.items.some(i => i.revenue != null && i.revenue > 0)

    const fmtRev = n => n ? `$${Number(n).toFixed(2)}` : '—'
    const fmtChg = n => {
      if (n == null) return '—'
      return (n >= 0 ? '+' : '') + n + '%'
    }

    // Top 10
    const top10 = report.items.filter(i => i.unitsSold > 0).slice(0, 10)
    const top10Rows = top10.map((item, idx) => `
      <tr style="background:${idx % 2 === 0 ? '#fff' : '#f8fafc'}">
        <td style="text-align:center;color:#94a3b8;font-size:10px">${idx + 1}</td>
        <td>${item.name}</td>
        <td style="color:#64748b;font-size:11px">${item.category}</td>
        <td style="text-align:right;font-family:monospace;font-weight:700">${item.unitsSold}</td>
        <td style="text-align:right;font-family:monospace;color:#64748b">${item.prevSold || 0}</td>
        <td style="text-align:right;font-family:monospace;color:${item.change >= 0 ? '#16a34a' : '#dc2626'};font-weight:600">${fmtChg(item.change)}</td>
        ${hasRev ? `<td style="text-align:right;font-family:monospace;color:#16a34a">${fmtRev(item.revenue)}</td>` : ''}
      </tr>`).join('')

    // Category breakdown
    const catRows = CATEGORY_ORDER
      .filter(c => report.categories[c])
      .map((c, idx) => {
        const cat = report.categories[c]
        const pct = report.totals.unitsSold > 0 ? ((cat.unitsSold / report.totals.unitsSold) * 100).toFixed(1) : 0
        const chg = cat.prevSold > 0 ? +(((cat.unitsSold - cat.prevSold) / cat.prevSold) * 100).toFixed(1) : null
        return `<tr style="background:${idx % 2 === 0 ? '#fff' : '#f8fafc'}">
          <td>${c}</td>
          <td style="text-align:right;font-family:monospace;font-weight:700">${cat.unitsSold}</td>
          <td style="text-align:right;font-family:monospace;color:#64748b">${cat.prevSold || 0}</td>
          <td style="text-align:right;font-family:monospace;color:${chg >= 0 ? '#16a34a' : '#dc2626'};font-weight:600">${fmtChg(chg)}</td>
          <td style="text-align:right;color:#64748b">${pct}%</td>
          ${hasRev ? `<td style="text-align:right;font-family:monospace;color:#16a34a">${fmtRev(cat.revenue)}</td>` : ''}
        </tr>`
      }).join('')

    const prevMonthName = compareStart.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })

    const html = `<!DOCTYPE html><html><head><title>Sales Report — ${monthName}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #1f2937; background: #fff; }
  .page { padding: 28px 32px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0f172a; padding-bottom: 14px; margin-bottom: 20px; }
  .header-left h1 { font-size: 20px; font-weight: 700; color: #0f172a; }
  .header-left p { font-size: 11px; color: #64748b; margin-top: 3px; }
  .header-right { text-align: right; font-size: 11px; color: #64748b; line-height: 1.6; }
  .header-right strong { color: #0f172a; font-size: 13px; display: block; }
  .summary { display: flex; gap: 0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 22px; }
  .summary-card { flex: 1; padding: 12px 16px; border-right: 1px solid #e2e8f0; }
  .summary-card:last-child { border-right: none; }
  .summary-card .num { font-size: 22px; font-weight: 700; font-family: monospace; color: #0f172a; }
  .summary-card .lbl { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; margin-top: 2px; }
  .summary-card .sub { font-size: 10px; color: #94a3b8; margin-top: 1px; }
  .section-title { font-size: 12px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.06em; margin: 22px 0 10px; padding-bottom: 6px; border-bottom: 2px solid #e2e8f0; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  th { background: #0f172a; color: #fff; padding: 7px 10px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; }
  td { padding: 6px 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px; }
  .totals-row td { background: #f1f5f9; font-weight: 700; border-top: 2px solid #e2e8f0; }
  .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }
  @media print {
    body { font-size: 11px; }
    .page { padding: 16px; }
    .section-title { page-break-before: auto; }
    tr { page-break-inside: avoid; }
  }
</style>
</head><body><div class="page">
  <div class="header">
    <div class="header-left">
      <h1>Monthly Sales Report</h1>
      <p>Paynter Bar — GemLife Palmwoods</p>
    </div>
    <div class="header-right">
      <strong>${monthName}</strong>
      Generated: ${generated}<br>
      Compared to: ${prevMonthName}
    </div>
  </div>

  <div class="summary">
    <div class="summary-card">
      <div class="num">${report.totals.unitsSold}</div>
      <div class="lbl">Total Units Sold</div>
      <div class="sub">Prior: ${report.totals.prevSold || 0}</div>
    </div>
    ${hasRev ? `<div class="summary-card">
      <div class="num">${fmtRev(report.totals.revenue)}</div>
      <div class="lbl">Total Revenue</div>
      <div class="sub">Prior: ${fmtRev(report.totals.prevRev)}</div>
    </div>` : ''}
    <div class="summary-card">
      <div class="num">${report.items.filter(i => i.unitsSold > 0).length}</div>
      <div class="lbl">Items Sold</div>
    </div>
    <div class="summary-card">
      <div class="num" style="font-size:14px">${report.items[0]?.name.split(' ').slice(0,3).join(' ') || '—'}</div>
      <div class="lbl">Top Seller</div>
      <div class="sub">${report.items[0]?.unitsSold || 0} units</div>
    </div>
  </div>

  <div class="section-title">Category Breakdown</div>
  <table>
    <thead><tr>
      <th>Category</th>
      <th style="text-align:right">Units Sold</th>
      <th style="text-align:right">Prior Month</th>
      <th style="text-align:right">Change</th>
      <th style="text-align:right">% of Total</th>
      ${hasRev ? '<th style="text-align:right">Revenue</th>' : ''}
    </tr></thead>
    <tbody>
      ${catRows}
      <tr class="totals-row">
        <td>TOTAL</td>
        <td style="text-align:right;font-family:monospace">${report.totals.unitsSold}</td>
        <td style="text-align:right;font-family:monospace;color:#64748b">${report.totals.prevSold || 0}</td>
        <td style="text-align:right">—</td>
        <td style="text-align:right">100%</td>
        ${hasRev ? `<td style="text-align:right;font-family:monospace;color:#16a34a">${fmtRev(report.totals.revenue)}</td>` : ''}
      </tr>
    </tbody>
  </table>

  <div class="section-title">Top 10 Sellers</div>
  <table>
    <thead><tr>
      <th style="width:28px;text-align:center">#</th>
      <th>Item</th>
      <th>Category</th>
      <th style="text-align:right">Units Sold</th>
      <th style="text-align:right">Prior Month</th>
      <th style="text-align:right">Change</th>
      ${hasRev ? '<th style="text-align:right">Revenue</th>' : ''}
    </tr></thead>
    <tbody>${top10Rows}</tbody>
  </table>

  <div class="footer">
    <span>Paynter Bar Reorder System — Data from Square POS</span>
    <span>Generated ${generated}</span>
  </div>
</div></body></html>`

    const w = window.open('', '_blank')
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 600)
  }

  function printOrderSheet(supplier) {
    const orderItems = items.filter(i => i.supplier === supplier && i.orderQty > 0)
    const date = new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
    const rows = orderItems.map(item => `
      <tr>
        <td>${item.name}</td>
        <td>${item.category}</td>
        <td style="text-align:right">${item.onHand}</td>
        <td style="text-align:right;font-weight:700">${item.isSpirit ? (item.nipsToOrder || '-') : (item.orderQty || '-')}</td>
        <td style="text-align:right">${item.isSpirit && item.bottlesToOrder ? item.bottlesToOrder : '-'}</td>
        <td>${item.notes || ''}</td>
      </tr>`).join('')
    const html = `<!DOCTYPE html><html><head><title>Order - ${supplier} - ${date}</title>
<style>body{font-family:Arial,sans-serif;font-size:13px;margin:20px}h1{font-size:18px;margin-bottom:4px}.sub{color:#666;font-size:12px;margin-bottom:16px}table{width:100%;border-collapse:collapse}th{background:#1f2937;color:#fff;padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase}td{padding:7px 10px;border-bottom:1px solid #e5e7eb}tr:nth-child(even) td{background:#f9fafb}.footer{margin-top:24px;font-size:11px;color:#9ca3af}@media print{body{margin:10px}}</style>
</head><body>
<h1>Order Sheet - ${supplier}</h1>
<div class="sub">Paynter Bar, GemLife Palmwoods | ${date} | ${orderItems.length} item(s) to order</div>
<table><thead><tr><th>Item</th><th>Category</th><th style="text-align:right">On Hand</th><th style="text-align:right">Order Qty</th><th style="text-align:right">Bottles</th><th>Notes</th></tr></thead>
<tbody>${rows}</tbody></table>
${orderItems.length === 0 ? '<p style="color:#6b7280;margin-top:16px">No items to order from this supplier this week.</p>' : ''}
<div class="footer">Generated ${new Date().toLocaleString('en-AU')} | Paynter Bar Reorder System</div>
</body></html>`
    const w = window.open('', '_blank')
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 500)
  }

  function exportStocktake() {
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js'
    script.onload = () => {
      // Columns:
      // A=Item, B=Category, C=Supplier,
      // D=Cool Room, E=Store Room, F=Bar,
      // G=Total Count (=D+E+F)  [bottles (decimal) for spirits, units for others]
      // H=Nips/Bottle           [pre-filled for spirits, blank for others]
      // I=Total Nips            [=G*H for spirits, blank for others]
      // J=Square On Hand        [nips for spirits, units for others]
      // K=Difference            [=I-J for spirits, =G-J for others]

      const rows = displayed.map(item => ({
        'Item':           item.name,
        'Category':       item.category,
        'Supplier':       item.supplier,
        'Cool Room':      '',
        'Store Room':     '',
        'Bar':            '',
        'Total Count':    '',
        'Nips/Bottle':    item.isSpirit ? (item.bottleML || 700) / (item.nipML || 30) : '',
        'Total Nips':     '',
        'Square On Hand': item.onHand,
        'Difference':     '',
      }))

      const ws = window.XLSX.utils.json_to_sheet(rows)

      ws['!cols'] = [
        { wch: 40 }, // A Item
        { wch: 18 }, // B Category
        { wch: 16 }, // C Supplier
        { wch: 12 }, // D Cool Room
        { wch: 12 }, // E Store Room
        { wch: 8  }, // F Bar
        { wch: 13 }, // G Total Count
        { wch: 12 }, // H Nips/Bottle
        { wch: 12 }, // I Total Nips
        { wch: 16 }, // J Square On Hand
        { wch: 12 }, // K Difference
      ]
      ws['!freeze'] = { xSplit: 0, ySplit: 1 }

      const range = window.XLSX.utils.decode_range(ws['!ref'])

      // Style header row — dark navy background, white bold text, taller row
      const headerStyle = {
        font:      { bold: true, color: { rgb: 'FFFFFF' }, sz: 12 },
        fill:      { fgColor: { rgb: '0F172A' }, patternType: 'solid' },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: {
          bottom: { style: 'medium', color: { rgb: '2563EB' } }
        }
      }
      const cols = ['A','B','C','D','E','F','G','H','I','J','K']
      cols.forEach(col => {
        if (ws[`${col}1`]) ws[`${col}1`].s = headerStyle
      })
      ws['!rows'] = [{ hpt: 28 }] // taller header row

      // Format data rows
      displayed.forEach((item, idx) => {
        const row = idx + 2
        ws[`G${row}`] = { f: `D${row}+E${row}+F${row}`, t: 'n', z: '0.0' }

        if (item.isSpirit) {
          // Format pre-filled Nips/Bottle to 1dp
          if (ws[`H${row}`] && ws[`H${row}`].v !== '') {
            ws[`H${row}`] = { v: ws[`H${row}`].v, t: 'n', z: '0.0' }
          }
          ws[`I${row}`] = { f: `G${row}*H${row}`, t: 'n', z: '0.0' }
          ws[`K${row}`] = { f: `I${row}-J${row}`, t: 'n', z: '0.0' }
        } else {
          ws[`I${row}`] = { v: '', t: 's' }
          ws[`K${row}`] = { f: `G${row}-J${row}`, t: 'n', z: '0.0' }
        }
      })

      const wb = window.XLSX.utils.book_new()
      window.XLSX.utils.book_append_sheet(wb, ws, 'Stocktake')
      window.XLSX.writeFile(wb, `Paynter-Bar-Stocktake-${new Date().toISOString().split('T')[0]}.xlsx`)
    }
    document.head.appendChild(script)
  }

  const displayed = items
    .filter(item => view === 'all' || item.supplier === view)
    .filter(item => !filterOrder || item.orderQty > 0)

  const orderCount = items.filter(i => i.orderQty > 0).length
  const critCount  = items.filter(i => i.priority === 'CRITICAL').length

  if (!authed) return (
    <div style={styles.loadWrap}>
      <div style={{ ...styles.loadBox, background: '#fff', padding: 40, borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.10)', minWidth: 300 }}>
        <div style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', color: '#94a3b8', textTransform: 'uppercase', fontFamily: 'IBM Plex Mono, monospace' }}>PAYNTER BAR</span>
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Reorder Planner</h2>
        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>Enter PIN to continue</p>
        <input type="password" inputMode="numeric" maxLength={6} value={pin}
          onChange={e => { setPin(e.target.value); setPinError(false) }}
          onKeyDown={e => e.key === 'Enter' && checkPin()} placeholder="PIN" autoFocus
          style={{ width: '100%', fontSize: 24, textAlign: 'center', padding: '10px 16px', borderRadius: 8, border: pinError ? '2px solid #dc2626' : '2px solid #e2e8f0', outline: 'none', fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.3em', marginBottom: 8, boxSizing: 'border-box' }} />
        {pinError && <p style={{ color: '#dc2626', fontSize: 12, marginBottom: 8, textAlign: 'center' }}>Incorrect PIN. Try again.</p>}
        <button onClick={checkPin} style={{ width: '100%', background: '#0f172a', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 4 }}>Enter</button>
      </div>
    </div>
  )

  if (loading) return (
    <div style={styles.loadWrap}>
      <div style={styles.loadBox}>
        <div style={styles.spinner} />
        <p style={{ color: '#64748b', marginTop: 16 }}>Loading Square data...</p>
      </div>
    </div>
  )

  return (
    <>
      <Head>
        <title>Paynter Bar Hub</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </Head>
      <div style={styles.page}>
        <header style={styles.header}>
          <div style={styles.headerInner}>
            <div>
              <div style={styles.headerTop}>
                <span style={styles.logo}>PAYNTER BAR HUB</span>
                {readOnly && <span style={{ fontSize: 10, background: '#fef9c3', color: '#854d0e', border: '1px solid #fde68a', borderRadius: 4, padding: '2px 7px', fontWeight: 700, letterSpacing: '0.05em' }}>READ ONLY</span>}
                <span style={styles.logoSub}>GemLife Palmwoods</span>
              </div>
              <h1 style={styles.title}>{mainTab === 'sales' ? 'Sales Report' : mainTab === 'trends' ? 'Quarterly Trends' : mainTab === 'help' ? 'Help & Guide' : mainTab === 'pricelist' ? 'Price List' : mainTab === 'bestsellers' ? 'Best & Worst Sellers' : mainTab === 'home' ? 'Dashboard' : 'Reorder Planner'}</h1>
            </div>
            <div style={styles.headerRight}>
              {lastUpdated && <span style={styles.lastUpdated}>Updated {new Date(lastUpdated).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</span>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button style={{ ...styles.btn, background: mainTab === 'home' ? '#1e3a5f' : '#334155' }}
                  onClick={() => setMainTab('home')}>
                  🏠 Home
                </button>
                <button style={{ ...styles.btn, background: '#0e7490' }} onClick={generateStockReport} title="Stock on Hand PDF">📋 SOH PDF</button>
                <button style={{ ...styles.btn, background: '#065f46' }} onClick={generateSalesReport} title="Monthly Sales PDF">📈 Sales PDF</button>

                <button style={{ ...styles.btn, background: mainTab === 'trends' ? '#b45309' : '#92400e' }}
                  onClick={() => { const next = mainTab === 'trends' ? 'reorder' : 'trends'; setMainTab(next); if (next === 'trends' && !trendData) loadTrendData(); }}>
                  {mainTab === 'trends' ? '← Back' : '📈 Trends'}
                </button>
                <button style={{ ...styles.btn, background: mainTab === 'sales' ? '#7c3aed' : '#4b5563' }}
                  onClick={() => {
                    const next = mainTab === 'sales' ? 'reorder' : 'sales'
                    setMainTab(next)
                    if (next === 'sales' && !salesReport) loadSalesReport(salesPeriod, salesCustom)
                  }}>
                  {mainTab === 'sales' ? '← Reorder' : '📊 Sales Report'}
                </button>
                <button style={{ ...styles.btn, background: mainTab === 'bestsellers' ? '#b45309' : '#78350f' }}
                  onClick={() => { const next = mainTab === 'bestsellers' ? 'reorder' : 'bestsellers'; setMainTab(next); if (next === 'bestsellers') loadSellersData() }}>
                  {mainTab === 'bestsellers' ? '← Back' : '🏆 Sellers'}
                </button>
                <button style={{ ...styles.btn, background: mainTab === 'pricelist' ? '#be185d' : '#9d174d' }}
                  onClick={() => { setMainTab(t => t === 'pricelist' ? 'reorder' : 'pricelist') }}>
                  {mainTab === 'pricelist' ? '← Back' : '🏷️ Price List'}
                </button>
                <button style={{ ...styles.btn, background: '#0f766e' }}
                  onClick={() => window.open('https://paynter-bar-roster.vercel.app/', '_blank')}>
                  👥 Roster
                </button>
                <button style={{ ...styles.btn, background: mainTab === 'help' ? '#1e293b' : '#475569' }}
                  onClick={() => setMainTab(t => t === 'help' ? 'reorder' : 'help')}>
                  {mainTab === 'help' ? '← Back' : '❓ Help'}
                </button>
                <button style={{ ...styles.btn, ...(refreshing ? styles.btnDisabled : {}) }}
                  onClick={() => loadItems(true)} disabled={refreshing}>
                  {refreshing ? 'Refreshing...' : 'Refresh'}
                </button>
                {readOnly && <span style={{ fontSize: 11, color: '#94a3b8', alignSelf: 'center', paddingRight: 4 }}>👁 View only</span>}
              </div>
            </div>
          </div>
          <div style={styles.statsBar}>
            <div style={styles.stat}>
              <span style={styles.statNum}>{items.length}</span>
              <span style={styles.statLabel}>Total Items</span>
            </div>
            <div style={{ ...styles.stat, borderTopColor: '#dc2626' }}>
              <span style={{ ...styles.statNum, color: '#dc2626' }}>{critCount}</span>
              <span style={styles.statLabel}>Critical</span>
            </div>
            <div style={{ ...styles.stat, borderTopColor: '#2563eb' }}>
              <span style={{ ...styles.statNum, color: '#2563eb' }}>{orderCount}</span>
              <span style={styles.statLabel}>To Order</span>
            </div>
            <div style={{ ...styles.stat, borderTopColor: '#f59e0b' }}>
              <span style={styles.statLabel}>Target Weeks</span>
              {editingTarget ? (
                <input type="number" defaultValue={targetWeeks} style={styles.targetInput}
                  onBlur={e => saveTargetWeeks(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveTargetWeeks(e.target.value)}
                  autoFocus min="1" max="26" />
              ) : (
                <span style={{ ...styles.statNum, color: '#f59e0b', cursor: 'pointer', textDecoration: 'underline dotted' }}
                  onClick={() => setEditingTarget(true)} title="Click to edit">{targetWeeks}</span>
              )}
            </div>
          </div>
        </header>

        {error && <div style={styles.errorBox}><strong>Error:</strong> {error}</div>}

        {/* SALES TAB */}
        {mainTab === 'sales' && (
          <SalesView
            period={salesPeriod} setPeriod={setSalesPeriod}
            custom={salesCustom} setCustom={setSalesCustom}
            report={salesReport} loading={salesLoading} error={salesError}
            category={salesCategory} setCategory={setSalesCategory}
            sort={salesSort} setSort={setSalesSort}
            onLoad={loadSalesReport}
          />
        )}

        {/* REORDER TAB */}
        {mainTab === 'reorder' && (
          <>
            <div style={styles.controls}>
              <div style={styles.viewTabs}>
                <button style={{ ...styles.tab, ...(view === 'all' ? styles.tabActive : {}) }}
                  onClick={() => setView('all')}>All Items</button>
                {suppliers.map(s => (
                  <button key={s} style={{ ...styles.tab, ...(view === s ? { ...styles.tabActive, background: SUPPLIER_COLORS[s] || '#374151', color: '#fff', borderColor: SUPPLIER_COLORS[s] || '#374151' } : {}) }}
                    onClick={() => setView(s)}>{s}</button>
                ))}
                {addingSupplier ? (
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <input value={newSupplierName} onChange={e => setNewSupplierName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') addSupplier(); if (e.key === 'Escape') setAddingSupplier(false) }}
                      placeholder="Supplier name..." style={styles.supplierInput} autoFocus />
                    <button style={{ ...styles.tab, background: '#16a34a', color: '#fff', borderColor: '#16a34a' }} onClick={addSupplier}>Add</button>
                    <button style={styles.tab} onClick={() => setAddingSupplier(false)}>Cancel</button>
                  </div>
                ) : (
                  <button style={{ ...styles.tab, borderStyle: 'dashed', color: '#64748b' }}
                    onClick={() => setAddingSupplier(true)}>+ Supplier</button>
                )}
                <div style={{ width: 1, background: '#e2e8f0', margin: '0 6px', alignSelf: 'stretch' }} />
                <button style={{ ...styles.tab, ...(viewMode === 'pricing' ? { background: '#7c3aed', color: '#fff', borderColor: '#7c3aed' } : { color: '#7c3aed', borderColor: '#7c3aed' }) }}
                  onClick={() => setViewMode(v => v === 'pricing' ? 'reorder' : 'pricing')}>$ Pricing</button>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={styles.filterCheck}>
                  <input type="checkbox" checked={filterOrder} onChange={e => setFilterOrder(e.target.checked)} style={{ marginRight: 6 }} />
                  Order items only
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Sales period:</span>
                  {[30, 60, 90].map(d => (
                    <button key={d}
                      style={{ ...styles.tab, padding: '4px 12px', fontSize: 12, ...(daysBack === d ? { background: '#0f172a', color: '#fff', borderColor: '#0f172a' } : {}) }}
                      onClick={() => { setDaysBack(d); loadItems(true, d) }}>{d}d</button>
                  ))}
                </div>
                {view !== 'all' && (
                  <button style={{ ...styles.btn, background: '#0f172a', fontSize: 12, padding: '6px 14px' }}
                    onClick={() => printOrderSheet(view)}>Print {view} Order</button>
                )}
                <button style={{ ...styles.btn, background: '#16a34a', fontSize: 12, padding: '6px 14px' }}
                  onClick={exportStocktake}>Export Stocktake</button>
                <div style={{ position: 'relative' }}>
                  <button style={{ ...styles.btn, background: '#374151', fontSize: 12, padding: '6px 14px' }}
                    onClick={() => setPrinting(p => p === 'menu' ? null : 'menu')}>Print Order Sheet</button>
                  {printing === 'menu' && (
                    <div style={styles.dropdown}>
                      {suppliers.map(s => (
                        <button key={s} style={styles.dropItem}
                          onClick={() => { printOrderSheet(s); setPrinting(null) }}>
                          {s} ({items.filter(i => i.supplier === s && i.orderQty > 0).length} items)
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.thead}>
                    <th style={{ ...styles.th, width: 240 }}>Item</th>
                    <th style={styles.th}>Category</th>
                    <th style={styles.th}>Supplier</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>On Hand</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Wkly Avg</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Target</th>
                    <th style={{ ...styles.th, textAlign: 'center' }}>Pack</th>
                    <th style={{ ...styles.th, textAlign: 'center' }}>Bottle Size</th>
                    <th style={{ ...styles.th, textAlign: 'center' }}>Nip Size</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Order Qty</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Bottles</th>
                    <th style={{ ...styles.th, textAlign: 'center' }}>Priority</th>
                    <th style={{ ...styles.th, width: 180 }}>Notes</th>
                    {viewMode === 'pricing' && <>
                      <th style={{ ...styles.th, textAlign: 'right', color: '#7c3aed' }}>Buy Price</th>
                      <th style={{ ...styles.th, textAlign: 'right', color: '#7c3aed' }}>Sell Price</th>
                      <th style={{ ...styles.th, textAlign: 'right', color: '#7c3aed' }}>Margin</th>
                    </>}
                  </tr>
                </thead>
                <tbody>
                  {displayed.length === 0 && (
                    <tr><td colSpan={viewMode === 'pricing' ? 16 : 13} style={{ textAlign: 'center', padding: '48px 24px', color: '#64748b' }}>
                      {filterOrder ? 'No items to order this week.' : 'No items found.'}
                    </td></tr>
                  )}
                  {displayed.map((item, idx) => {
                    const p = PRIORITY_COLORS[item.priority]
                    const rowBg = item.orderQty > 0 ? p.bg : (idx % 2 === 0 ? '#fff' : '#f8fafc')
                    return (
                      <tr key={item.name} style={{ background: rowBg }}>
                        <td style={{ ...styles.td, fontWeight: 500, fontSize: 13 }}>{item.name}</td>
                        <td style={styles.td}>
                          <EditSelect value={item.category} options={CATEGORIES}
                            onChange={v => saveSetting(item.name, 'category', v)}
                            saving={saving[`${item.name}_category`]} readOnly={readOnly} />
                        </td>
                        <td style={styles.td}>
                          <EditSelect value={item.supplier} options={suppliers}
                            onChange={v => saveSetting(item.name, 'supplier', v)}
                            saving={saving[`${item.name}_supplier`]} colorMap={SUPPLIER_COLORS} readOnly={readOnly} />
                        </td>
                        <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace' }}>{item.onHand}</td>
                        <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace' }}>{item.weeklyAvg}</td>
                        <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace' }}>{item.targetStock}</td>
                        <td style={{ ...styles.td, textAlign: 'center' }}>
                          <EditNumber value={item.pack} onChange={v => saveSetting(item.name, 'pack', v)}
                            saving={saving[`${item.name}_pack`]} min={1} readOnly={readOnly} />
                        </td>
                        <td style={{ ...styles.td, textAlign: 'center' }}>
                          {item.isSpirit ? (
                            <EditSelect value={String(item.bottleML)} options={['700', '750', '1000']}
                              onChange={v => saveSetting(item.name, 'bottleML', Number(v))}
                              saving={saving[`${item.name}_bottleML`]} readOnly={readOnly} />
                          ) : <span style={{ color: '#e2e8f0' }}>—</span>}
                        </td>
                        <td style={{ ...styles.td, textAlign: 'center' }}>
                          {item.isSpirit ? (
                            <EditSelect value={String(item.nipML || 30)} options={['30', '60']}
                              onChange={v => saveSetting(item.name, 'nipML', Number(v))}
                              saving={saving[`${item.name}_nipML`]} readOnly={readOnly} />
                          ) : <span style={{ color: '#e2e8f0' }}>—</span>}
                        </td>
                        <td style={{ ...styles.td, textAlign: 'right', fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace', fontSize: 15 }}>
                          {item.isSpirit
                            ? (item.nipsToOrder > 0 ? item.nipsToOrder : '-')
                            : (item.orderQty > 0 ? item.orderQty : '-')}
                        </td>
                        <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', color: '#1f4e79' }}>
                          {item.isSpirit ? (item.bottlesToOrder > 0 ? item.bottlesToOrder : '-') : '-'}
                        </td>
                        <td style={{ ...styles.td, textAlign: 'center' }}>
                          <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', background: p.badge, color: '#fff' }}>{item.priority}</span>
                        </td>
                        <td style={styles.td}>
                          <EditText value={item.notes || ''} onChange={v => saveSetting(item.name, 'notes', v)}
                            saving={saving[`${item.name}_notes`]} placeholder="Add note..." readOnly={readOnly} />
                        </td>
                        {viewMode === 'pricing' && (() => {
                          const buy  = item.buyPrice  !== '' && item.buyPrice  != null ? Number(item.buyPrice)  : null
                          const sell = item.sellPrice !== '' && item.sellPrice != null ? Number(item.sellPrice) : null
                          const marginPct = (buy != null && sell != null && sell > 0) ? (((sell - buy) / sell) * 100) : null
                          const marginStr = marginPct != null ? marginPct.toFixed(1) + '%' : '-'
                          const marginColor = marginPct == null ? '#94a3b8' : marginPct >= 40 ? '#16a34a' : marginPct >= 20 ? '#d97706' : '#dc2626'
                          const sellFromSq = item.squareSellPrice != null && Number(item.sellPrice) === item.squareSellPrice
                          return <>
                            <td style={{ ...styles.td, textAlign: 'right' }}>
                              <EditNumber value={buy ?? ''} placeholder="$0.00" decimals={2} prefix="$"
                                onChange={v => saveSetting(item.name, 'buyPrice', v)}
                                saving={saving[`${item.name}_buyPrice`]} min={0} readOnly={readOnly} />
                            </td>
                            <td style={{ ...styles.td, textAlign: 'right' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                                <EditNumber value={sell ?? ''} placeholder="$0.00" decimals={2} prefix="$"
                                  onChange={v => saveSetting(item.name, 'sellPrice', v)}
                                  saving={saving[`${item.name}_sellPrice`]} min={0} readOnly={readOnly} />
                                {sellFromSq && <span style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'IBM Plex Mono, monospace' }}>from Square</span>}
                              </div>
                            </td>
                            <td style={{ ...styles.td, textAlign: 'right', fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace', color: marginColor }}>
                              {marginStr}
                            </td>
                          </>
                        })()}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {mainTab === 'home' && (
          <DashboardView
            items={items}
            lastUpdated={lastUpdated}
            onNav={(tab) => {
              setMainTab(tab)
              if (tab === 'sales' && !salesReport) loadSalesReport(salesPeriod, salesCustom)
              if (tab === 'trends' && !trendData) loadTrendData()
              if (tab === 'bestsellers') loadSellersData()
            }}
          />
        )}
        {mainTab === 'trends' && <TrendsView data={trendData} loading={trendLoading} error={trendError} />}
        {mainTab === 'bestsellers' && <BestSellersView items={items} salesData={sellersData} loading={sellersLoading} error={sellersError} />}
        {mainTab === 'pricelist' && (
          <PriceListView
            items={items}
            settings={priceListSettings}
            readOnly={readOnly}
            saving={plSaving}
            onSave={savePriceListSetting}
            onPrint={generatePriceListPDF}
          />
        )}
        {mainTab === 'help' && <HelpTab />}

        <footer style={styles.footer}>
          Paynter Bar Hub — GemLife Palmwoods | Data from Square POS | {items.length} items tracked
        </footer>
      </div>
    </>
  )
}

// ─── DASHBOARD VIEW ───────────────────────────────────────────────────────────
function DashboardView({ items, lastUpdated, onNav }) {
  const critCount  = items.filter(i => i.priority === 'CRITICAL').length
  const lowCount   = items.filter(i => i.priority === 'LOW').length
  const orderCount = items.filter(i => i.orderQty > 0).length
  const totalItems = items.length

  const now = new Date()
  const refreshedAgo = lastUpdated ? (() => {
    const mins = Math.floor((now - new Date(lastUpdated)) / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    return `${Math.floor(mins/60)}h ${mins%60}m ago`
  })() : 'Not yet refreshed'

  const features = [
    { icon: '📦', label: 'Reorder Planner',     desc: 'Stock levels, order quantities & supplier sheets', tab: 'reorder',     color: '#1e3a5f' },
    { icon: '📊', label: 'Sales Report',          desc: 'Period sales with category breakdown',             tab: 'sales',        color: '#7c3aed' },
    { icon: '📈', label: 'Quarterly Trends',      desc: 'Four-quarter category performance charts',         tab: 'trends',       color: '#0e7490' },
    { icon: '🏆', label: 'Best & Worst Sellers',  desc: 'Top 10, slow sellers and items not moving',        tab: 'bestsellers',  color: '#92400e' },
    { icon: '🏷️', label: 'Price List',            desc: 'Printable A4 price list for bar display',          tab: 'pricelist',    color: '#be185d' },
    { icon: '👥', label: 'Volunteer Roster',      desc: 'Volunteer scheduling (opens new tab)',             tab: 'roster',       color: '#065f46', external: true },
    { icon: '❓', label: 'Help & Guide',           desc: 'Full documentation for all features',             tab: 'help',         color: '#475569' },
  ]

  return (
    <div style={{ padding: '20px 32px', maxWidth: 1100, margin: '0 auto' }}>

      {/* Compact header row: stats + refresh */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Critical',      value: critCount,    sub: 'below target',    color: '#dc2626', bg: '#fef2f2', action: () => onNav('reorder') },
          { label: 'Low Stock',     value: lowCount,     sub: 'running low',     color: '#d97706', bg: '#fffbeb', action: () => onNav('reorder') },
          { label: 'To Order',      value: orderCount,   sub: 'need ordering',   color: '#2563eb', bg: '#eff6ff', action: () => onNav('reorder') },
          { label: 'Refreshed',     value: refreshedAgo, sub: 'Square data',     color: '#475569', bg: '#f8fafc', action: null },
        ].map(({ label, value, sub, color, bg, action }) => (
          <div key={label}
            onClick={action || undefined}
            style={{ background: bg, borderRadius: 8, border: `1px solid ${color}33`, padding: '10px 14px', cursor: action ? 'pointer' : 'default' }}
            onMouseEnter={e => { if (action) e.currentTarget.style.opacity = '0.85' }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}>
            <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color, fontFamily: 'IBM Plex Mono, monospace', lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Feature grid — 4 columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {features.map(f => (
          <div key={f.tab}
            onClick={() => f.external ? window.open('https://paynter-bar-roster.vercel.app/', '_blank') : onNav(f.tab)}
            style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', padding: '12px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, transition: 'border-color 0.15s, box-shadow 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = f.color; e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.07)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none' }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: f.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
              {f.icon}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.label}{f.external ? ' ↗' : ''}</div>
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1, lineHeight: 1.4 }}>{f.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14, fontSize: 10, color: '#cbd5e1', textAlign: 'center' }}>
        Paynter Bar Hub · GemLife Palmwoods · {totalItems} items tracked
      </div>
    </div>
  )
}


// ─── BEST & WORST SELLERS VIEW ───────────────────────────────────────────────
function BestSellersView({ items, salesData, loading, error }) {
  const today = new Date()

  // Build sales map from Orders API data
  const salesMap = {}
  if (salesData) {
    for (const item of salesData.items || []) {
      salesMap[item.name] = (salesMap[item.name] || 0) + item.unitsSold
    }
  }

  const withData = items.filter(i => i.weeklyAvg != null)
  const sorted   = [...withData].sort((a, b) => (b.weeklyAvg || 0) - (a.weeklyAvg || 0))
  const top10    = sorted.slice(0, 10)
  const maxAvg   = top10[0]?.weeklyAvg || 1

  // Slow sellers: has stock, sold in last 90 days but in bottom 25% by units
  const itemsWithSales = salesData
    ? withData
        .filter(i => (i.onHand || 0) > 0 && (salesMap[i.name] || 0) > 0)
        .sort((a, b) => (salesMap[a.name] || 0) - (salesMap[b.name] || 0))
    : []
  const slowCutoff = Math.ceil(itemsWithSales.length * 0.25)
  const slowSellers = itemsWithSales.slice(0, slowCutoff)

  // Not selling at all: has stock, zero sales in 90 days
  const notSelling = salesData
    ? withData.filter(i => (i.onHand || 0) > 0 && (salesMap[i.name] || 0) === 0)
        .sort((a, b) => (b.onHand || 0) - (a.onHand || 0))
    : []

  // Consistent stars: top 20% weekly avg that also appear in Orders API sales
  const avgThreshold = sorted[Math.floor(sorted.length * 0.2)]?.weeklyAvg || 0
  const consistent = sorted.filter(i =>
    (i.weeklyAvg || 0) >= avgThreshold && (salesData ? (salesMap[i.name] || 0) > 0 : true)
  )

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 64, color: '#64748b' }}>
      <div style={{ ...styles.spinner, margin: '0 auto 16px' }} />
      Loading 90 days of sales data from Square...
    </div>
  )

  if (error) return <div style={{ ...styles.errorBox, margin: 24 }}><strong>Error:</strong> {error}</div>

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1100, margin: '0 auto' }}>

      {/* Summary strip */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { label: 'Top Seller',      value: top10[0]?.name.split(' ').slice(0,3).join(' ') || '—', sub: top10[0] ? `${top10[0].weeklyAvg} / week` : '', color: '#16a34a' },
          { label: 'Items Tracked',   value: withData.length,   sub: `${items.length} total`,              color: '#2563eb' },
          { label: 'Slow Sellers',    value: slowSellers.length, sub: 'bottom 25% with stock',             color: '#d97706' },
          { label: 'Not Selling',     value: notSelling.length,  sub: 'zero sales, has stock',             color: '#dc2626' },
        ].map(({ label, value, sub, color }) => (
          <div key={label} style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: '12px 18px', flex: 1, minWidth: 150 }}>
            <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: 'IBM Plex Mono, monospace' }}>{value}</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Top 10 sellers */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ background: '#14532d', color: '#fff', padding: '10px 16px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            🏆 Top 10 Sellers — Weekly Average
          </div>
          {top10.map((item, idx) => {
            const barPct = Math.round((item.weeklyAvg / maxAvg) * 100)
            return (
              <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderBottom: idx < 9 ? '1px solid #f1f5f9' : 'none', background: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                <span style={{ fontSize: 11, color: '#94a3b8', width: 18, textAlign: 'right', flexShrink: 0 }}>{idx + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                  <div style={{ marginTop: 3, height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${barPct}%`, height: '100%', background: '#16a34a', borderRadius: 3 }} />
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>{item.weeklyAvg}</span>
                  <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 3 }}>/wk</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Slow sellers */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ background: '#92400e', color: '#fff', padding: '10px 16px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              🐢 Slow Sellers — Bottom 25% (Last 90 Days)
            </div>
            {slowSellers.length === 0 ? (
              <div style={{ padding: 16, fontSize: 12, color: '#64748b', textAlign: 'center' }}>
                {salesData ? 'No slow sellers identified ✓' : 'Loading...'}
              </div>
            ) : slowSellers.map((item, idx) => (
              <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 14px', borderBottom: idx < slowSellers.length - 1 ? '1px solid #f1f5f9' : 'none', background: idx % 2 === 0 ? '#fff' : '#fffbeb' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{item.name}</div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>{item.category} · {item.onHand} in stock</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: '#d97706' }}>{salesMap[item.name] || 0}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>units / 90 days</div>
                </div>
              </div>
            ))}
          </div>

          {/* Not selling */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ background: '#7f1d1d', color: '#fff', padding: '10px 16px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              ⚠️ Not Selling — Zero Sales, Has Stock
            </div>
            {notSelling.length === 0 ? (
              <div style={{ padding: 16, fontSize: 12, color: '#64748b', textAlign: 'center' }}>
                {salesData ? 'Everything is selling ✓' : 'Loading...'}
              </div>
            ) : notSelling.map((item, idx) => (
              <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 14px', borderBottom: idx < notSelling.length - 1 ? '1px solid #f1f5f9' : 'none', background: idx % 2 === 0 ? '#fff' : '#fef2f2' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{item.name}</div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>{item.category} · {item.onHand} in stock</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>0 sold</div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>last 90 days</div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>

      <div style={{ marginTop: 16, fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>
        Based on Square Orders API · 90 day window · {salesData ? `${(salesData.items||[]).length} items analysed` : 'Loading...'}
      </div>
    </div>
  )
}


// ─── PRICE LIST VIEW ──────────────────────────────────────────────────────────
function PriceListView({ items, settings, readOnly, saving, onSave, onPrint }) {
  const CATEGORY_ORDER = ['Beer','Cider','PreMix','White Wine','Red Wine','Rose','Sparkling','Fortified & Liqueurs','Spirits','Soft Drinks','Snacks']

  // Group items by category
  const grouped = {}
  for (const item of items) {
    const cat = item.category || 'Other'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(item)
  }
  const cats = CATEGORY_ORDER.filter(c => grouped[c])


  // Normalise Square variation names for display and sort Glass before Bottle
  function normaliseVariations(vars) {
    return vars
      .map(v => {
        const n = v.name.toLowerCase()
        const label = n.includes('glass') || n.includes('wine glass') ? 'Glass'
                    : n.includes('bottle') || n === 'regular' ? 'Bottle'
                    : v.name
        return { ...v, name: label }
      })
      .sort((a, b) => {
        if (a.name === 'Glass') return -1
        if (b.name === 'Glass') return 1
        return 0
      })
  }

  function getPrice(item) {
    if (item.sellPrice != null)       return item.sellPrice
    if (item.squareSellPrice != null) return item.squareSellPrice
    return null
  }

  function getVariations(item) {
    const vars = (item.variations || []).filter(v => v.price != null)
    if (vars.length > 1) return normaliseVariations(vars)
    return null
  }

function isHidden(item) {
    return (settings[item.name] || {}).hidden === true
  }

  const visibleCount = items.filter(i => !isHidden(i)).length

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1100, margin: '0 auto' }}>

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 20px', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Price List Editor</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            {visibleCount} items shown on price list · Prices from Square unless overridden
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {!readOnly && (
            <div style={{ fontSize: 11, color: '#64748b', alignSelf: 'center', textAlign: 'right', maxWidth: 200 }}>
              Click <strong>Shown/Hidden</strong> to include or exclude items from the price list
            </div>
          )}
          <button
            style={{ background: '#be185d', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
            onClick={() => onPrint(items, settings)}>
            🖨️ Print Price List
          </button>
        </div>
      </div>

      {/* Category sections */}
      {cats.map(cat => (
        <div key={cat} style={{ marginBottom: 20 }}>
          <div style={{ background: '#1e3a5f', color: '#fff', borderRadius: '8px 8px 0 0', padding: '8px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {cat}
          </div>
          <div style={{ border: '1px solid #e2e8f0', borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '7px 14px', textAlign: 'left', fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Display Name</th>
                  <th style={{ padding: '7px 14px', textAlign: 'left', fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Square Name</th>
                  <th style={{ padding: '7px 14px', textAlign: 'right', fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Price</th>
                  <th style={{ padding: '7px 14px', textAlign: 'center', fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>On List</th>
                </tr>
              </thead>
              <tbody>
                {grouped[cat].filter(item => (item.onHand || 0) > 0 || isHidden(item)).map((item, idx) => {
                  const hidden  = isHidden(item)
                  const price   = getPrice(item)
                  const rowBg   = hidden ? '#fafafa' : idx % 2 === 0 ? '#fff' : '#f8fafc'

                  return (
                    <tr key={item.name} style={{ background: rowBg, opacity: hidden ? 0.45 : 1 }}>
                      {/* Display name */}
                      <td style={{ padding: '7px 14px', fontSize: 13, color: '#0f172a' }}>
                        {item.name}
                      </td>

                      {/* Square name */}
                      <td style={{ padding: '7px 14px', fontSize: 11, color: '#94a3b8' }}>{item.name}</td>

                      {/* Price — from Square only */}
                      <td style={{ padding: '7px 14px', textAlign: 'right' }}>
                        {(() => {
                          const variations = getVariations(item)
                          if (variations) {
                            return (
                              <table style={{ borderCollapse: 'collapse', marginLeft: 'auto' }}>
                                {variations.map(v => (
                                  <tr key={v.name}>
                                    <td style={{ fontSize: 10, color: '#64748b', paddingRight: 8, whiteSpace: 'nowrap' }}>{v.name}</td>
                                    <td style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: '#0f172a', textAlign: 'right', whiteSpace: 'nowrap' }}>${Number(v.price).toFixed(2)}</td>
                                  </tr>
                                ))}
                                <tr><td colSpan={2} style={{ fontSize: 9, color: '#94a3b8', textAlign: 'right' }}>Square</td></tr>
                              </table>
                            )
                          }
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                              <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'monospace', color: price != null ? '#0f172a' : '#cbd5e1' }}>
                                {price != null ? `$${Number(price).toFixed(2)}` : '—'}
                              </span>
                              {price != null && <span style={{ fontSize: 9, color: '#94a3b8' }}>Square</span>}
                              {price == null && !readOnly && <span style={{ fontSize: 9, color: '#dc2626' }}>Set in Square</span>}
                            </div>
                          )
                        })()}
                      </td>

                      {/* Show/hide toggle */}
                      <td style={{ padding: '7px 14px', textAlign: 'center' }}>
                        {readOnly ? (
                          <span style={{ fontSize: 11, color: hidden ? '#dc2626' : '#16a34a' }}>{hidden ? 'Hidden' : 'Shown'}</span>
                        ) : (
                          <button
                            style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 99, border: 'none', cursor: 'pointer',
                              background: hidden ? '#fee2e2' : '#dcfce7', color: hidden ? '#dc2626' : '#16a34a' }}
                            onClick={() => onSave(item.name, 'hidden', !hidden)}>
                            {hidden ? 'Hidden' : 'Shown'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}


// ─── TRENDS VIEW ──────────────────────────────────────────────────────────────
const TREND_CAT_COLORS = {
  'Beer':                 '#2563eb',
  'Cider':                '#0891b2',
  'PreMix':               '#7c3aed',
  'White Wine':           '#ca8a04',
  'Red Wine':             '#dc2626',
  'Rose':                 '#db2777',
  'Sparkling':            '#0f766e',
  'Fortified & Liqueurs': '#9a3412',
  'Spirits':              '#4338ca',
  'Soft Drinks':          '#16a34a',
  'Snacks':               '#64748b',
}
const TREND_CHART_W = 680, TREND_CHART_H = 200, TREND_PAD_L = 50, TREND_PAD_T = 20, TREND_PAD_R = 20, TREND_PAD_B = 40

function CategoryChart({ cat, data, hasRev }) {
  const chartW = TREND_CHART_W, chartH = TREND_CHART_H, padL = TREND_PAD_L, padT = TREND_PAD_T, padR = TREND_PAD_R
  const innerW = chartW - padL - padR
  const innerH = chartH - padT - TREND_PAD_B
  const vals   = data.map(q => q.categories[cat]?.unitsSold || 0)
  const revs   = data.map(q => q.categories[cat]?.revenue  || 0)
  const maxVal = Math.max(...vals, 1)
  const color  = TREND_CAT_COLORS[cat] || '#2563eb'
  const barW   = Math.floor(innerW / data.length) - 16
  const trend  = vals[vals.length-1] - vals[0]
  const trendColor = trend > 0 ? '#16a34a' : trend < 0 ? '#dc2626' : '#64748b'
  const trendIcon  = trend > 0 ? '▲' : trend < 0 ? '▼' : '→'
  const total      = vals.reduce((s, v) => s + v, 0)

  const bars = data.map((q, i) => {
    const bh = Math.round((vals[i] / maxVal) * innerH)
    const x  = padL + i * (innerW / data.length) + 8
    const y  = padT + innerH - bh
    return (
      <g key={i}>
        <rect x={x} y={y} width={barW} height={bh} fill={color} rx={3} opacity={0.85}/>
        <text x={x + barW/2} y={y - 5} textAnchor="middle" fontSize={10} fill="#0f172a" fontWeight="600">{vals[i]}</text>
        <text x={x + barW/2} y={padT + innerH + 14} textAnchor="middle" fontSize={9} fill="#475569">{q.label.split(' ').slice(0,2).join(' ')}</text>
        {hasRev && <text x={x + barW/2} y={padT + innerH + 26} textAnchor="middle" fontSize={8} fill="#16a34a">${revs[i] ? revs[i].toFixed(0) : '—'}</text>}
      </g>
    )
  })

  const grids = [0.5, 1].map(pct => {
    const y   = padT + innerH - Math.round(pct * innerH)
    const val = Math.round(pct * maxVal)
    return (
      <g key={pct}>
        <line x1={padL} y1={y} x2={chartW - padR} y2={y} stroke="#e2e8f0" strokeWidth={1}/>
        <text x={padL - 4} y={y + 4} textAnchor="end" fontSize={9} fill="#94a3b8">{val}</text>
      </g>
    )
  })

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px 20px', marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 12, height: 12, borderRadius: 3, background: color }}/>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{cat}</span>
        </div>
        <div style={{ display: 'flex', gap: 20, fontSize: 11 }}>
          <span style={{ color: '#64748b' }}>4-quarter total: <strong style={{ color: '#0f172a' }}>{total.toLocaleString()} units</strong></span>
          <span style={{ color: trendColor, fontWeight: 700 }}>{trendIcon} {Math.abs(trend)} units {trend >= 0 ? 'up' : 'down'} vs 4 qtrs ago</span>
        </div>
      </div>
      <svg width="100%" viewBox={`0 0 ${chartW} ${chartH + (hasRev ? 10 : 0)}`} style={{ overflow: 'visible' }}>
        <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} stroke="#cbd5e1" strokeWidth={1}/>
        <line x1={padL} y1={padT + innerH} x2={chartW - padR} y2={padT + innerH} stroke="#cbd5e1" strokeWidth={1}/>
        {grids}
        {bars}
      </svg>
    </div>
  )
}

function TrendsView({ data, loading, error }) {
  const CATEGORY_ORDER = ['Beer','Cider','PreMix','White Wine','Red Wine','Rose','Sparkling','Fortified & Liqueurs','Spirits','Soft Drinks','Snacks']

  if (loading) return (
    <div style={{ padding: 60, textAlign: 'center', color: '#64748b' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
      <div style={{ fontSize: 14 }}>Loading quarterly data from Square...</div>
      <div style={{ fontSize: 11, marginTop: 8, color: '#94a3b8' }}>This may take a few seconds</div>
    </div>
  )
  if (error) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#dc2626' }}>
      <div style={{ fontSize: 14 }}>Could not load trend data: {error}</div>
    </div>
  )
  if (!data) return null

  const allCats    = CATEGORY_ORDER.filter(c => data.some(q => q.categories[c]))
  const hasRev     = data.some(q => q.totals.revenue > 0)
  const qLabels    = data.map(q => q.label)
  const grandTotals = data.map(q => q.totals.unitsSold)
  const maxGrand   = Math.max(...grandTotals, 1)

  return (
    <div style={{ padding: '28px 32px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '18px 24px', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Quarterly Sales Trends</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>Last 4 quarters — units sold by category</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {qLabels.map((q, i) => (
              <div key={i} style={{ fontSize: 10, background: '#f1f5f9', borderRadius: 4, padding: '3px 8px', color: '#475569' }}>
                {q}: <strong>{grandTotals[i].toLocaleString()}</strong>
              </div>
            ))}
          </div>
        </div>
        <svg width="100%" viewBox="0 0 680 60" style={{ overflow: 'visible' }}>
          {data.map((q, i) => {
            const bh = Math.round((grandTotals[i] / maxGrand) * 40)
            const x  = 10 + i * 165
            const y  = 50 - bh
            return (
              <g key={i}>
                <rect x={x} y={y} width={150} height={bh} fill="#0f172a" rx={3} opacity={0.15}/>
                <rect x={x} y={y} width={150} height={bh} fill="#2563eb" rx={3} opacity={0.6}/>
                <text x={x + 75} y={y - 4} textAnchor="middle" fontSize={10} fill="#0f172a" fontWeight="700">{grandTotals[i].toLocaleString()}</text>
                <text x={x + 75} y={58} textAnchor="middle" fontSize={9} fill="#64748b">{q.label}</text>
              </g>
            )
          })}
        </svg>
      </div>

      {allCats.map(cat => <CategoryChart key={cat} cat={cat} data={data} hasRev={hasRev} />)}
    </div>
  )
}


// ─── HELP TAB ─────────────────────────────────────────────────────────────────
function HelpTab() {
  const sections = [
    {
      icon: '🔐',
      title: 'Getting Started',
      items: [
        { q: 'Logging in', a: 'Enter your PIN on the login screen. Your session stays active until you close the browser tab. The app works on any device — phone, tablet or laptop.' },
        { q: 'Refreshing data', a: 'Click Refresh in the top-right to pull the latest stock levels and sales from Square POS. Always reflects what Square knows right now.' },
        { q: 'Sales period', a: 'The 30d / 60d / 90d buttons set how many days of sales history are used to calculate weekly averages. 90 days gives the most stable average; 30 days is more responsive to recent trends.' },
      ]
    },
    {
      icon: '📦',
      title: 'Reorder Planner',
      items: [
        { q: 'Reading the table', a: 'Each row shows current stock (On Hand), weekly average sales, target stock level, and how much to order. Red = CRITICAL (below target), yellow = LOW, green = OK.' },
        { q: 'Order Qty vs Bottles', a: 'For spirits and fortified wines, Order Qty shows nips needed and Bottles shows full bottles to buy (rounded up). For all other items, Order Qty shows units to order.' },
        { q: 'Target Weeks', a: 'Click the number in the header stats bar to change how many weeks of stock to hold. Default is 6 weeks. Affects all items\' target stock calculations.' },
        { q: 'Filtering to order items', a: 'Tick \"Order items only\" in the controls bar to hide items that don\'t need ordering — useful when preparing orders.' },
        { q: 'Supplier tabs', a: 'Click Dan Murphys, Coles Woolies or ACW to filter the table to just that supplier. Use + Supplier to add a new supplier.' },
        { q: 'Editing item settings', a: 'Click any value in the Category, Supplier, Pack, Bottle Size or Nip Size columns to edit inline. Changes save automatically to the cloud and are shared with all management team members.' },
        { q: 'Adding notes', a: 'Click the Notes column for any item to add a note (e.g. \"Discontinued\", \"Check price\"). Notes are saved and visible to all.' },
      ]
    },
    {
      icon: '🥃',
      title: 'Spirits & Fortified Wines',
      items: [
        { q: 'How spirits are tracked', a: 'Square tracks spirits in nips (30ml standard, 60ml for Baileys, Galway Pipe Port and Penfolds Club Port). All calculations — weekly average, target stock, order quantities — stay in nips throughout.' },
        { q: 'Bottle Size column', a: 'Set to 700ml, 750ml or 1000ml per item. Determines how many nips per bottle (e.g. 700ml ÷ 30ml = 23.3 nips). Affects order quantities and stocktake calculations.' },
        { q: 'Nip Size column', a: 'Most spirits are 30ml. Baileys Irish Cream, Galway Pipe Port and Penfolds Club Port are served as 60ml nips. Must be set correctly for accurate order quantities and stocktake counts.' },
        { q: 'Order quantities', a: 'Shows nips needed to reach target stock. Bottles column shows full bottles to buy (always rounded up). Example: need 70 nips from 700ml bottle → Order Qty 70, Bottles 3.' },
      ]
    },
    {
      icon: '💲',
      title: 'Pricing Mode',
      items: [
        { q: 'Enabling pricing', a: 'Click $ Pricing in the controls bar to reveal Buy Price, Sell Price and Margin % columns. This view is only available to committee members.' },
        { q: 'Sell prices from Square', a: 'Sell prices are imported automatically from your Square catalogue. Items marked \"from Square\" have been auto-populated. All price changes must be made in Square — this keeps Square as the single source of truth.' },
        { q: 'Margin calculation', a: 'Margin % = (Sell − Buy) ÷ Sell × 100. Green = 40%+, amber = 20–40%, red = below 20%. Requires both buy and sell price to be set.' },
        { q: 'Buy prices', a: 'Click the Buy Price cell for any item and type the cost price. Saved to the cloud and shared across all management team sessions.' },
      ]
    },
    {
      icon: '📊',
      title: 'Sales Report',
      items: [
        { q: 'Opening the report', a: 'Click 📊 Sales Report in the top-right header. Data is fetched live from Square\'s Orders API — allow a few seconds to load.' },
        { q: 'Period selector', a: 'Choose This Month, Last 3 Months, or a Custom date range. Each period automatically compares against the equivalent prior period.' },
        { q: 'Category breakdown', a: 'Click any category tile to filter the item table to just that category. Click again (or ALL) to reset.' },
        { q: 'Revenue figures', a: 'Revenue comes directly from Square\'s transaction records — the actual price charged at time of sale, not a calculation from current prices.' },
        { q: 'Sort order', a: 'Toggle between By Units and By Revenue using the buttons above the item table.' },
      ]
    },
    {
      icon: '🏆',
      title: 'Best & Worst Sellers',
      items: [
        { q: 'Opening the report', a: 'Click 🏆 Sellers in the top-right header. The report fetches 90 days of Orders API data from Square — allow a few seconds to load.' },
        { q: 'Top 10 Sellers', a: 'Ranked by weekly average from Square inventory data, with a bar chart showing relative performance. Your most reliable, high-volume items.' },
        { q: 'Slow Sellers', a: 'The bottom 25% of items that are selling but very slowly over the last 90 days. Useful for identifying items to reduce ordering on or consider dropping from the range.' },
        { q: 'Not Selling', a: 'Items with stock on hand but zero sales recorded in the last 90 days via Square Orders API. Strong candidates for discontinuing or running down stock.' },
        { q: 'Data source', a: 'The right column (Slow Sellers and Not Selling) uses the Square Orders API — the same reliable source as the Sales Report. The Top 10 uses weekly averages from inventory movement data.' },
      ]
    },
    {
      icon: '👥',
      title: 'Volunteer Roster',
      items: [
        { q: 'Opening the roster', a: 'Click 👥 Roster in the top-right header to open the volunteer roster app in a new tab. The roster runs independently at paynter-bar-roster.vercel.app.' },
        { q: 'How they connect', a: 'The two apps are separate — the roster link is just a shortcut for convenience. Any changes to the roster are made within the roster app itself.' },
      ]
    },
    {
      icon: '📈',
      title: 'Quarterly Trends',
      items: [
        { q: 'Opening trends', a: 'Click 📈 Trends in the top-right header. The chart loads the last 4 completed calendar quarters automatically.' },
        { q: 'Reading the charts', a: 'Each category gets its own bar chart showing units sold per quarter. A trend indicator (▲ up, ▼ down, → stable) shows the direction from the earliest to most recent quarter.' },
        { q: 'Summary panel', a: 'The top panel shows total units sold across all categories for each quarter, with a mini bar chart for a quick visual comparison.' },
        { q: 'Revenue data', a: 'Where available from Square, revenue figures are shown alongside unit counts for each quarter and category.' },
      ]
    },
    {
      icon: '🏷️',
      title: 'Price List',
      items: [
        { q: 'Opening the price list', a: 'Click 🏷️ Price List in the top-right header. The editor shows all items grouped by category with their current Square prices.' },
        { q: 'Showing and hiding items', a: 'Click the Shown/Hidden toggle next to any item to include or exclude it from the printed price list. Items with zero stock in Square are automatically excluded. Hidden items are shown faded in the editor.' },
        { q: 'Prices', a: 'All prices come directly from Square. To change a price, update it in Square and click Refresh. Wine items with both a Glass and Bottle price in Square will show both, with Glass listed first.' },
        { q: 'Printing the price list', a: 'Click 🖨️ Print Price List to open a two-page A4 portrait document — categories split across both pages in a two-column card layout. In the print dialog set paper to A4, margins to None and scale to 100%.' },
        { q: 'Edit access', a: 'The Shown/Hidden toggle is only available to committee members. Read-only users can view the price list but cannot make changes.' },
      ]
    },
    {
      icon: '🖨️',
      title: 'Printing & Exports',
      items: [
        { q: 'Print Order Sheet', a: 'Click Print Order Sheet → choose a supplier to open a print-ready order form. Use your browser\'s Print dialog or Save as PDF.' },
        { q: '📋 SOH PDF', a: 'Generates a Stock on Hand management report from current Square data — all items by category with status and order quantities. Print dialog opens automatically.' },
        { q: '📈 Sales PDF', a: 'Generates a Monthly Sales Report for the previous completed month — category breakdown, top 10 sellers, revenue and prior month comparisons. Best run on the 1st of each month.' },
        
        { q: 'Export Stocktake', a: 'Downloads an Excel spreadsheet for quarterly stocktakes. Count columns for Cool Room, Store Room and Bar. For spirits, enter decimal bottles (e.g. 4.5) — the sheet calculates nips automatically and shows the variance against Square.' },
      ]
    },
    {
      icon: '⚙️',
      title: 'Settings & Administration',
      items: [
        { q: 'Shared settings', a: 'All settings (categories, suppliers, pack sizes, bottle/nip sizes, prices, notes, target weeks, price list visibility) are saved to the cloud. Any management team member sees the same settings on any device.' },
        { q: 'Adding suppliers', a: 'Use the + Supplier button in the controls bar. Assign items to suppliers by clicking the Supplier column inline.' },
        { q: 'Item categories', a: 'Available categories: Beer, Cider, PreMix, White Wine, Red Wine, Rose, Sparkling, Fortified & Liqueurs, Spirits, Soft Drinks, Snacks. Spirits and Fortified & Liqueurs items get the bottle and nip size columns.' },
        { q: 'Square POS connection', a: 'The app connects to your Square account via API. Stock levels, sales and prices update on every Refresh. Square is always the source of truth — all transactions and price changes are made in Square.' },
      ]
    },
    {
      icon: '👁',
      title: 'Access Levels',
      items: [
        { q: 'Committee access', a: 'Full access to all features including editing item settings, categories, suppliers, pack sizes, bottle and nip sizes, buy prices, notes, target weeks, and price list visibility toggles. Can also export the stocktake spreadsheet and add suppliers.' },
        { q: 'Homeowners committee access', a: 'Read-only access. All data is visible — stock levels, order quantities, sales reports, trends, price list and PDF reports — but nothing can be edited. A READ ONLY badge appears in the header.' },
        { q: 'What read-only users can view', a: 'Stock on hand, weekly averages, order quantities, item status, sales reports, quarterly trends, best & worst sellers, category breakdowns, price list, and all PDF reports including the AGM annual report.' },
        { q: 'What read-only users cannot do', a: 'Edit any item settings, change prices, toggle price list visibility, export the stocktake spreadsheet, add suppliers, or change target weeks.' },
        { q: 'Pricing visibility', a: 'Buy prices and the $ Pricing view are only visible to committee members — hidden entirely for read-only users to keep cost prices confidential.' },
      ]
    },
  ]

  return (
    <div style={{ padding: '32px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '24px 32px', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div style={{ width: 48, height: 48, background: '#0f172a', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🍺</div>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: 0 }}>Paynter Bar Hub</h2>
            <p style={{ fontSize: 13, color: '#64748b', margin: '3px 0 0' }}>GemLife Palmwoods — Bar Management System</p>
          </div>
        </div>
        <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.7, margin: 0 }}>
          This app manages bar operations for the Paynter Bar Management Team. It connects directly to Square POS to provide
          live stock levels, sales analytics, automated reorder calculations, seller performance reports and management reports — all in one place.
          Settings and changes made by any management team member are shared across all devices instantly.
        </p>
      </div>

      {sections.map(section => (
        <div key={section.title} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 16, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <span style={{ fontSize: 18 }}>{section.icon}</span>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{section.title}</h3>
          </div>
          <div>
            {section.items.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', borderBottom: idx < section.items.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                <div style={{ width: 220, minWidth: 220, padding: '11px 20px', borderRight: '1px solid #f1f5f9', background: '#fafafa' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{item.q}</span>
                </div>
                <div style={{ flex: 1, padding: '11px 20px' }}>
                  <span style={{ fontSize: 12, color: '#4b5563', lineHeight: 1.65 }}>{item.a}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div style={{ background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0', padding: '16px 20px', textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: '#94a3b8', margin: 0, lineHeight: 1.8 }}>
          Paynter Bar Hub — Built for Paynter Bar Committee, GemLife Palmwoods<br />
          Data source: Square POS · Settings stored in Vercel KV · Deployed on Vercel
        </p>
      </div>
    </div>
  )
}


// ─── SALES REPORT VIEW ────────────────────────────────────────────────────────
function SalesView({ period, setPeriod, custom, setCustom, report, loading, error, category, setCategory, sort, setSort, onLoad }) {
  const fmt = n => n == null ? '-' : `$${Number(n).toFixed(2)}`

  const fmtChange = n => {
    if (n == null) return null
    const sign = n >= 0 ? '+' : ''
    const color = n >= 0 ? '#16a34a' : '#dc2626'
    return <span style={{ fontSize: 11, color, fontWeight: 700 }}>{sign}{n}%</span>
  }

  const allCats = report
    ? ['All', ...CATEGORY_ORDER_LIST.filter(c => report.categories[c])]
    : ['All']

  const filteredItems = report
    ? report.items
        .filter(i => category === 'All' || i.category === category)
        .sort((a, b) => sort === 'revenue' ? ((b.revenue || 0) - (a.revenue || 0)) : (b.unitsSold - a.unitsSold))
    : []

  const totals = filteredItems.reduce(
    (acc, i) => ({ units: acc.units + i.unitsSold, prev: acc.prev + i.prevSold, rev: acc.rev + (i.revenue || 0), prevRev: acc.prevRev + (i.prevRev || 0) }),
    { units: 0, prev: 0, rev: 0, prevRev: 0 }
  )

  const hasRev = report && report.items.some(i => i.revenue != null)

  return (
    <div style={{ padding: '24px 32px' }}>
      {/* Period controls */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12, background: '#fff', padding: '10px 20px', borderBottom: '1px solid #e2e8f0' }}>
        {[['month','This Month'],['3months','Last 3 Months'],['custom','Custom Range']].map(([val, label]) => (
          <button key={val}
            style={{ ...styles.tab, ...(period === val ? styles.tabActive : {}) }}
            onClick={() => { setPeriod(val); if (val !== 'custom') onLoad(val, custom) }}>
            {label}
          </button>
        ))}
        {period === 'custom' && (
          <>
            <input type="date" value={custom.start} onChange={e => setCustom(c => ({ ...c, start: e.target.value }))}
              style={{ ...styles.supplierInput, width: 140 }} />
            <span style={{ color: '#64748b' }}>to</span>
            <input type="date" value={custom.end} onChange={e => setCustom(c => ({ ...c, end: e.target.value }))}
              style={{ ...styles.supplierInput, width: 140 }} />
            <button style={{ ...styles.btn, padding: '6px 16px', fontSize: 13 }}
              onClick={() => onLoad('custom', custom)}>Load</button>
          </>
        )}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>
          <div style={{ ...styles.spinner, margin: '0 auto 16px' }} />
          Fetching sales data from Square...
        </div>
      )}

      {error && <div style={styles.errorBox}><strong>Error:</strong> {error}</div>}

      {report && !loading && (
        <>
          {/* Summary cards */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            {[
              { label: 'Units Sold',   value: totals.units,            prev: totals.prev,   money: false },
              ...(hasRev ? [{ label: 'Revenue', value: fmt(totals.rev), prev: totals.prevRev, money: true, rawVal: totals.rev, rawPrev: totals.prevRev }] : []),
              { label: 'Items Sold',  value: filteredItems.filter(i => i.unitsSold > 0).length, noChange: true },
              { label: 'Top Seller',  value: (filteredItems[0]?.name || '-').split(' ').slice(0,3).join(' '), noChange: true },
            ].map(({ label, value, prev, money, rawVal, rawPrev, noChange }) => {
              const numVal  = money ? (rawVal  ?? 0) : value
              const numPrev = money ? (rawPrev ?? 0) : prev
              const chg = (!noChange && numPrev > 0) ? +(((numVal - numPrev) / numPrev) * 100).toFixed(1) : null
              return (
                <div key={label} style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: '12px 16px', minWidth: 130, flex: 1 }}>
                  <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace', color: '#0f172a' }}>{value}</div>
                  {!noChange && prev != null && (
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                      Prior: {money ? fmt(rawPrev) : prev}
                      {chg != null && <span style={{ marginLeft: 6, color: chg >= 0 ? '#16a34a' : '#dc2626', fontWeight: 700 }}>{chg >= 0 ? '+' : ''}{chg}%</span>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Category bar */}
          <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: '10px 16px', marginBottom: 12, overflowX: 'auto' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Category Breakdown — click to filter</div>
            <div style={{ display: 'flex', gap: 0, minWidth: 'max-content' }}>
              {CATEGORY_ORDER_LIST.filter(c => report.categories[c]).map(c => {
                const cat = report.categories[c]
                const pct = report.totals.unitsSold > 0 ? Math.round((cat.unitsSold / report.totals.unitsSold) * 100) : 0
                const active = category === c
                return (
                  <button key={c} onClick={() => setCategory(active ? 'All' : c)}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '6px 12px', cursor: 'pointer', border: 'none', borderBottom: `3px solid ${active ? '#2563eb' : '#e2e8f0'}`, background: active ? '#eff6ff' : 'transparent', minWidth: 90 }}>
                    <span style={{ fontSize: 9, color: '#94a3b8', marginBottom: 1 }}>{c}</span>
                    <span style={{ fontSize: 15, fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace', color: '#0f172a' }}>{cat.unitsSold}</span>
                    <span style={{ fontSize: 9, color: '#94a3b8' }}>{pct}%</span>
                    {hasRev && cat.revenue > 0 && <span style={{ fontSize: 9, color: '#16a34a', fontWeight: 600 }}>{fmt(cat.revenue)}</span>}
                  </button>
                )
              })}
              <button onClick={() => setCategory('All')}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '6px 12px', cursor: 'pointer', border: 'none', borderBottom: `3px solid ${category === 'All' ? '#2563eb' : '#e2e8f0'}`, background: category === 'All' ? '#eff6ff' : 'transparent', minWidth: 70 }}>
                <span style={{ fontSize: 9, color: '#94a3b8', marginBottom: 1 }}>ALL</span>
                <span style={{ fontSize: 15, fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace', color: '#0f172a' }}>{report.totals.unitsSold}</span>
                <span style={{ fontSize: 9, color: '#94a3b8' }}>100%</span>
                {hasRev && <span style={{ fontSize: 9, color: '#16a34a', fontWeight: 600 }}>{fmt(report.totals.revenue)}</span>}
              </button>
            </div>
          </div>

          {/* Item table */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                {category === 'All' ? 'All Items' : category} — {filteredItems.filter(i => i.unitsSold > 0).length} items sold
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <span style={{ fontSize: 12, color: '#64748b', alignSelf: 'center' }}>Sort:</span>
                {[['units','By Units'],['revenue','By Revenue']].map(([val, label]) => (
                  (!hasRev && val === 'revenue') ? null :
                  <button key={val}
                    style={{ ...styles.tab, padding: '4px 12px', fontSize: 12, ...(sort === val ? styles.tabActive : {}) }}
                    onClick={() => setSort(val)}>{label}</button>
                ))}
              </div>
            </div>
            <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 380px)' }}>
              <table style={{ ...styles.table, fontSize: 13 }}>
                <thead>
                  <tr style={styles.thead}>
                    <th style={{ ...styles.th, width: 28, textAlign: 'right' }}>#</th>
                    <th style={styles.th}>Item</th>
                    <th style={styles.th}>Category</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Units Sold</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Prior Period</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Change</th>
                    {hasRev && <th style={{ ...styles.th, textAlign: 'right', color: '#16a34a' }}>Revenue</th>}
                    {hasRev && <th style={{ ...styles.th, textAlign: 'right', color: '#94a3b8' }}>Prior Rev</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.filter(i => i.unitsSold > 0 || i.prevSold > 0).map((item, idx) => (
                    <tr key={item.name} style={{ background: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                      <td style={{ ...styles.td, textAlign: 'right', color: '#94a3b8', fontSize: 11 }}>{idx + 1}</td>
                      <td style={{ ...styles.td, fontWeight: 500 }}>{item.name}</td>
                      <td style={{ ...styles.td, color: '#64748b', fontSize: 12 }}>{item.category}</td>
                      <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700, fontSize: 15, color: '#0f172a' }}>
                        {item.unitsSold || <span style={{ color: '#cbd5e1' }}>—</span>}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', color: '#64748b' }}>{item.prevSold || 0}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{fmtChange(item.change)}</td>
                      {hasRev && <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', color: '#16a34a', fontWeight: 600 }}>{fmt(item.revenue)}</td>}
                      {hasRev && <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', color: '#94a3b8' }}>{fmt(item.prevRev)}</td>}
                    </tr>
                  ))}
                  <tr style={{ background: '#f1f5f9' }}>
                    <td style={styles.td} />
                    <td style={{ ...styles.td, fontWeight: 700, fontSize: 13 }}>TOTAL</td>
                    <td style={styles.td} />
                    <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700, fontSize: 15 }}>{totals.units}</td>
                    <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', color: '#64748b' }}>{totals.prev}</td>
                    <td style={styles.td} />
                    {hasRev && <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700, color: '#16a34a' }}>{fmt(totals.rev)}</td>}
                    {hasRev && <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', color: '#94a3b8' }}>{fmt(totals.prevRev)}</td>}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── EDIT COMPONENTS ──────────────────────────────────────────────────────────
function EditSelect({ value, options, onChange, saving, colorMap, readOnly }) {
  const [editing, setEditing] = useState(false)
  if (readOnly) { const color = colorMap ? colorMap[value] : null; return <span style={{ fontSize: 12, color: color || '#374151', fontWeight: color ? 600 : 400 }}>{value}</span> }
  if (saving) return <span style={{ color: '#94a3b8', fontSize: 12 }}>Saving...</span>
  if (editing) return (
    <select defaultValue={value} autoFocus style={styles.inlineSelect}
      onChange={e => { onChange(e.target.value); setEditing(false) }}
      onBlur={() => setEditing(false)}>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
  const color = colorMap ? colorMap[value] : null
  return <span style={{ cursor: 'pointer', fontSize: 12, color: color || '#374151', fontWeight: color ? 600 : 400 }}
    onClick={() => setEditing(true)} title="Click to edit">{value}</span>
}

function EditNumber({ value, onChange, saving, min, placeholder, decimals, prefix, readOnly }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value)
  useEffect(() => setVal(value), [value])
  if (readOnly) { const display = decimals && (value !== '' && value != null) ? `${prefix || ''}${Number(value).toFixed(decimals)}` : (value !== '' && value != null ? `${prefix || ''}${value}` : '—'); return <span style={{ fontSize: 12, color: '#374151', fontFamily: 'IBM Plex Mono, monospace' }}>{display}</span> }
  if (saving) return <span style={{ color: '#94a3b8', fontSize: 12 }}>...</span>
  if (editing) return (
    <input type="number" value={val} min={min || 0} step={decimals ? 0.01 : 1} style={styles.inlineInput}
      onChange={e => setVal(e.target.value)}
      onBlur={() => { if (val !== '') onChange(val); setEditing(false) }}
      onKeyDown={e => { if (e.key === 'Enter') { onChange(val); setEditing(false) } if (e.key === 'Escape') setEditing(false) }}
      autoFocus />
  )
  if (value === '' || value === null || value === undefined) return (
    <span style={{ cursor: 'pointer', color: '#cbd5e1', fontSize: 11, fontStyle: 'italic' }}
      onClick={() => setEditing(true)}>{placeholder || 'Set'}</span>
  )
  const display = decimals ? `${prefix || ''}${Number(value).toFixed(decimals)}` : value
  return <span style={{ cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace', fontSize: 13 }}
    onClick={() => setEditing(true)} title="Click to edit">{display}</span>
}

function EditText({ value, onChange, saving, placeholder, readOnly }) {
  if (readOnly) return <span style={{ fontSize: 12, color: value ? '#374151' : '#e2e8f0' }}>{value || '—'}</span>
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value)
  useEffect(() => setVal(value), [value])
  if (saving) return <span style={{ color: '#94a3b8', fontSize: 12 }}>Saving...</span>
  if (editing) return (
    <input type="text" value={val} style={{ ...styles.inlineInput, width: 160, textAlign: 'left' }}
      onChange={e => setVal(e.target.value)}
      onBlur={() => { onChange(val); setEditing(false) }}
      onKeyDown={e => { if (e.key === 'Enter') { onChange(val); setEditing(false) } if (e.key === 'Escape') setEditing(false) }}
      autoFocus placeholder={placeholder} maxLength={120} />
  )
  return <span style={{ cursor: 'pointer', fontSize: 12, color: value ? '#374151' : '#cbd5e1', fontStyle: value ? 'normal' : 'italic' }}
    onClick={() => setEditing(true)} title="Click to edit">{value || placeholder}</span>
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = {
  page:          { minHeight: '100vh', background: '#f1f5f9', fontFamily: "'IBM Plex Sans', sans-serif" },
  loadWrap:      { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f1f5f9' },
  loadBox:       { textAlign: 'center' },
  spinner:       { width: 40, height: 40, border: '3px solid #e2e8f0', borderTop: '3px solid #1f4e79', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' },
  header:        { background: '#0f172a', color: '#fff' },
  headerInner:   { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '24px 32px 16px', flexWrap: 'wrap', gap: 16 },
  headerTop:     { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 },
  logo:          { fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', color: '#94a3b8', textTransform: 'uppercase', fontFamily: "'IBM Plex Mono', monospace" },
  logoSub:       { fontSize: 11, color: '#475569', fontFamily: "'IBM Plex Mono', monospace" },
  title:         { fontSize: 26, fontWeight: 700, margin: 0, color: '#f8fafc', letterSpacing: '-0.02em' },
  headerRight:   { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 },
  lastUpdated:   { fontSize: 12, color: '#64748b', fontFamily: "'IBM Plex Mono', monospace" },
  btn:           { background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" },
  btnDisabled:   { background: '#334155', cursor: 'not-allowed' },
  statsBar:      { display: 'flex', borderTop: '1px solid #1e293b', padding: '0 32px' },
  stat:          { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 24px', borderRight: '1px solid #1e293b', gap: 2, borderTopWidth: 3, borderTopStyle: 'solid', borderTopColor: 'transparent' },
  statNum:       { fontSize: 22, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", color: '#f8fafc' },
  statLabel:     { fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' },
  targetInput:   { width: 50, fontSize: 20, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", background: '#1e293b', color: '#f8fafc', border: '1px solid #475569', borderRadius: 4, textAlign: 'center', padding: '2px 4px' },
  errorBox:      { background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', margin: '16px 32px', padding: '12px 16px', borderRadius: 6, fontSize: 13 },
  controls:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 32px', background: '#fff', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap', gap: 12 },
  viewTabs:      { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  tab:           { padding: '6px 14px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#374151', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" },
  tabActive:     { background: '#0f172a', color: '#fff', borderColor: '#0f172a' },
  filterCheck:   { display: 'flex', alignItems: 'center', fontSize: 13, color: '#374151', cursor: 'pointer' },
  supplierInput: { fontSize: 13, border: '1px solid #3b82f6', borderRadius: 6, padding: '6px 10px', fontFamily: "'IBM Plex Sans', sans-serif", width: 160 },
  dropdown:      { position: 'absolute', top: '100%', right: 0, marginTop: 4, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, minWidth: 200 },
  dropItem:      { display: 'block', width: '100%', padding: '10px 16px', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: 13, color: '#374151', fontFamily: "'IBM Plex Sans', sans-serif" },
  tableWrap:     { overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 220px)' },
  table:         { width: '100%', borderCollapse: 'collapse', fontSize: 13, background: '#fff' },
  thead:         { background: '#f8fafc', position: 'sticky', top: 0, zIndex: 10 },
  th:            { padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap' },
  td:            { padding: '9px 14px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' },
  inlineSelect:  { fontSize: 12, border: '1px solid #3b82f6', borderRadius: 4, padding: '2px 4px', background: '#eff6ff', color: '#1d4ed8', fontFamily: "'IBM Plex Sans', sans-serif" },
  inlineInput:   { width: 70, fontSize: 13, border: '1px solid #3b82f6', borderRadius: 4, padding: '2px 6px', background: '#eff6ff', color: '#1d4ed8', textAlign: 'center', fontFamily: "'IBM Plex Mono', monospace" },
  footer:        { textAlign: 'center', padding: '24px', fontSize: 12, color: '#94a3b8', borderTop: '1px solid #e2e8f0', background: '#fff' },
}
