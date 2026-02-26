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
  const [mainTab, setMainTab]           = useState('reorder')
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
  const [agmLoading, setAgmLoading]     = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem('bar_authed') === 'yes') setAuthed(true)
  }, [])

  function checkPin() {
    if (pin === '3838') {
      sessionStorage.setItem('bar_authed', 'yes')
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
  async function generateAGMReport() {
    if (agmLoading) return
    setAgmLoading(true)
    const now = new Date()
    // Financial year: May 1 to April 30
    // Determine current FY: if month >= May (4), FY started this year; else last year
    const fyStartYear = now.getMonth() >= 4 ? now.getFullYear() : now.getFullYear() - 1
    const fyStart = new Date(fyStartYear, 4, 1, 0, 0, 0)       // May 1
    const fyEnd   = new Date(fyStartYear + 1, 3, 30, 23, 59, 59) // Apr 30
    // Prior year
    const pyStart = new Date(fyStartYear - 1, 4, 1, 0, 0, 0)
    const pyEnd   = new Date(fyStartYear, 3, 30, 23, 59, 59)

    const fyLabel = `${fyStartYear}–${fyStartYear + 1}`
    const generated = now.toLocaleString('en-AU', { day: '2-digit', month: 'long', year: 'numeric' })

    // Fetch full year data + prior year
    let report, priorReport
    try {
      const [r1, r2] = await Promise.all([
        fetch(`/api/sales?start=${fyStart.toISOString()}&end=${fyEnd.toISOString()}`),
        fetch(`/api/sales?start=${pyStart.toISOString()}&end=${pyEnd.toISOString()}`),
      ])
      if (!r1.ok || !r2.ok) throw new Error('Failed to fetch annual data')
      report      = await r1.json()
      priorReport = await r2.json()
    } catch(e) {
      alert('Could not fetch annual data: ' + e.message)
      setAgmLoading(false)
      return
    }

    // Fetch 4 quarters of current FY
    const quarters = [
      { label: 'Q1 May–Jul', start: new Date(fyStartYear, 4, 1), end: new Date(fyStartYear, 6, 31, 23, 59, 59) },
      { label: 'Q2 Aug–Oct', start: new Date(fyStartYear, 7, 1), end: new Date(fyStartYear, 9, 31, 23, 59, 59) },
      { label: 'Q3 Nov–Jan', start: new Date(fyStartYear, 10, 1), end: new Date(fyStartYear + 1, 0, 31, 23, 59, 59) },
      { label: 'Q4 Feb–Apr', start: new Date(fyStartYear + 1, 1, 1), end: new Date(fyStartYear + 1, 3, 30, 23, 59, 59) },
    ]
    const qResults = await Promise.all(quarters.map(async q => {
      try {
        const r = await fetch(`/api/sales?start=${q.start.toISOString()}&end=${q.end.toISOString()}`)
        const d = r.ok ? await r.json() : { categories: {}, totals: { unitsSold: 0, revenue: 0 } }
        return { ...q, categories: d.categories, totals: d.totals }
      } catch { return { ...q, categories: {}, totals: { unitsSold: 0, revenue: 0 } } }
    }))

    const CATEGORY_ORDER = ['Beer','Cider','PreMix','White Wine','Red Wine','Rose','Sparkling','Fortified & Liqueurs','Spirits','Soft Drinks','Snacks']
    const hasRev = report.totals.revenue > 0
    const fmtRev = n => n ? `$${Number(n).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'
    const fmtChg = (cur, pri) => {
      if (!pri) return '—'
      const pct = +(((cur - pri) / pri) * 100).toFixed(1)
      return `${pct >= 0 ? '+' : ''}${pct}%`
    }
    const chgColor = (cur, pri) => !pri ? '#64748b' : cur >= pri ? '#16a34a' : '#dc2626'

    // Category rows
    const catRows = CATEGORY_ORDER
      .filter(c => report.categories[c] || priorReport.categories[c])
      .map((c, idx) => {
        const cur = report.categories[c] || { unitsSold: 0, revenue: 0 }
        const pri = priorReport.categories[c] || { unitsSold: 0, revenue: 0 }
        const pct = report.totals.unitsSold > 0 ? ((cur.unitsSold / report.totals.unitsSold) * 100).toFixed(1) : 0
        const cc  = chgColor(cur.unitsSold, pri.unitsSold)
        const bg  = idx % 2 === 0 ? '#fff' : '#f8fafc'
        return `<tr style="background:${bg}">
          <td>${c}</td>
          <td style="text-align:right;font-family:monospace;font-weight:700">${cur.unitsSold.toLocaleString()}</td>
          <td style="text-align:right;color:#64748b;font-family:monospace">${pri.unitsSold.toLocaleString()}</td>
          <td style="text-align:right;color:${cc};font-weight:600">${fmtChg(cur.unitsSold, pri.unitsSold)}</td>
          <td style="text-align:right;color:#94a3b8">${pct}%</td>
          ${hasRev ? `<td style="text-align:right;font-family:monospace;color:#16a34a">${fmtRev(cur.revenue)}</td>
          <td style="text-align:right;font-family:monospace;color:#94a3b8">${fmtRev(pri.revenue)}</td>` : ''}
        </tr>`
      }).join('')

    // Top 10
    const top10 = report.items.filter(i => i.unitsSold > 0).slice(0, 10)
    const top10Rows = top10.map((item, idx) => `
      <tr style="background:${idx % 2 === 0 ? '#fff' : '#f8fafc'}">
        <td style="text-align:center;color:#94a3b8;font-size:11px;font-weight:700">${idx + 1}</td>
        <td style="font-weight:${idx < 3 ? '700' : '400'}">${item.name}</td>
        <td style="color:#64748b;font-size:11px">${item.category}</td>
        <td style="text-align:right;font-family:monospace;font-weight:700">${item.unitsSold.toLocaleString()}</td>
        ${hasRev ? `<td style="text-align:right;font-family:monospace;color:#16a34a">${fmtRev(item.revenue)}</td>` : ''}
      </tr>`).join('')

    // Quarterly bar chart (inline SVG)
    const maxUnits = Math.max(...qResults.map(q => q.totals.unitsSold), 1)
    const barW = 120, barGap = 40, chartH = 160, leftPad = 50
    const totalW = leftPad + qResults.length * (barW + barGap) + barGap
    const BAR_COLORS = ['#2563eb','#0891b2','#7c3aed','#0f766e']
    const bars = qResults.map((q, i) => {
      const bh = Math.round((q.totals.unitsSold / maxUnits) * chartH)
      const x  = leftPad + barGap + i * (barW + barGap)
      const y  = chartH - bh + 20
      return `<rect x="${x}" y="${y}" width="${barW}" height="${bh}" fill="${BAR_COLORS[i]}" rx="4"/>
        <text x="${x + barW/2}" y="${y - 6}" text-anchor="middle" font-size="11" font-family="Arial" fill="#0f172a" font-weight="700">${q.totals.unitsSold.toLocaleString()}</text>
        <text x="${x + barW/2}" y="${chartH + 36}" text-anchor="middle" font-size="10" font-family="Arial" fill="#475569">${q.label}</text>
        ${hasRev ? `<text x="${x + barW/2}" y="${chartH + 50}" text-anchor="middle" font-size="9" font-family="Arial" fill="#16a34a">${fmtRev(q.totals.revenue)}</text>` : ''}`
    }).join('')
    // Y-axis gridlines
    const gridLines = [0.25, 0.5, 0.75, 1].map(pct => {
      const y = chartH - Math.round(pct * chartH) + 20
      const val = Math.round(pct * maxUnits)
      return `<line x1="${leftPad}" y1="${y}" x2="${totalW - barGap}" y2="${y}" stroke="#e2e8f0" stroke-width="1"/>
        <text x="${leftPad - 6}" y="${y + 4}" text-anchor="end" font-size="9" font-family="Arial" fill="#94a3b8">${val}</text>`
    }).join('')
    const chartSVG = `<svg width="${totalW}" height="${chartH + 70}" xmlns="http://www.w3.org/2000/svg">
      ${gridLines}
      <line x1="${leftPad}" y1="20" x2="${leftPad}" y2="${chartH + 20}" stroke="#cbd5e1" stroke-width="1"/>
      ${bars}
    </svg>`

    const html = `<!DOCTYPE html><html><head><title>Annual Report ${fyLabel} — Paynter Bar</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;font-size:12px;color:#1f2937;background:#fff}
  .page{padding:28px 36px}
  .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:4px solid #0f172a;padding-bottom:16px;margin-bottom:24px}
  .header-left h1{font-size:22px;font-weight:700;color:#0f172a}
  .header-left .sub{font-size:12px;color:#64748b;margin-top:4px}
  .header-left .fy{font-size:16px;font-weight:700;color:#2563eb;margin-top:6px}
  .header-right{text-align:right;font-size:11px;color:#64748b;line-height:1.8}
  .summary{display:flex;gap:0;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:28px}
  .card{flex:1;padding:14px 18px;border-right:1px solid #e2e8f0}
  .card:last-child{border-right:none}
  .card .num{font-size:24px;font-weight:700;font-family:monospace;color:#0f172a}
  .card .lbl{font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-top:2px}
  .card .sub{font-size:10px;color:#94a3b8;margin-top:2px}
  .card .chg{font-size:11px;font-weight:600;margin-top:3px}
  .section-title{font-size:11px;font-weight:700;color:#0f172a;text-transform:uppercase;letter-spacing:.07em;margin:24px 0 10px;padding-bottom:6px;border-bottom:2px solid #e2e8f0}
  table{width:100%;border-collapse:collapse;margin-bottom:4px}
  th{background:#0f172a;color:#fff;padding:7px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.06em}
  td{padding:6px 10px;border-bottom:1px solid #f1f5f9;font-size:11px}
  .totals-row td{background:#f1f5f9;font-weight:700;border-top:2px solid #cbd5e1}
  .chart-wrap{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:4px;overflow-x:auto}
  .footer{margin-top:28px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;display:flex;justify-content:space-between}
  @media print{body{font-size:11px}.page{padding:16px}tr{page-break-inside:avoid}.section-title{page-break-before:auto}}
</style></head><body><div class="page">

  <div class="header">
    <div class="header-left">
      <h1>Annual Sales Report</h1>
      <div class="sub">Paynter Bar — GemLife Palmwoods</div>
      <div class="fy">Financial Year ${fyLabel} &nbsp;|&nbsp; 1 May ${fyStartYear} – 30 April ${fyStartYear + 1}</div>
    </div>
    <div class="header-right">
      <strong style="font-size:13px;color:#0f172a;display:block">AGM Report</strong>
      Generated: ${generated}<br>
      Prior year: 1 May ${fyStartYear - 1} – 30 April ${fyStartYear}
    </div>
  </div>

  <div class="summary">
    <div class="card">
      <div class="num">${report.totals.unitsSold.toLocaleString()}</div>
      <div class="lbl">Total Units Sold</div>
      <div class="sub">Prior year: ${priorReport.totals.unitsSold.toLocaleString()}</div>
      <div class="chg" style="color:${chgColor(report.totals.unitsSold, priorReport.totals.unitsSold)}">${fmtChg(report.totals.unitsSold, priorReport.totals.unitsSold)} vs prior year</div>
    </div>
    ${hasRev ? `<div class="card">
      <div class="num" style="font-size:18px">${fmtRev(report.totals.revenue)}</div>
      <div class="lbl">Total Revenue</div>
      <div class="sub">Prior year: ${fmtRev(priorReport.totals.revenue)}</div>
      <div class="chg" style="color:${chgColor(report.totals.revenue, priorReport.totals.revenue)}">${fmtChg(report.totals.revenue, priorReport.totals.revenue)} vs prior year</div>
    </div>` : ''}
    <div class="card">
      <div class="num">${report.items.filter(i => i.unitsSold > 0).length}</div>
      <div class="lbl">Items Sold</div>
      <div class="sub">across ${Object.keys(report.categories).length} categories</div>
    </div>
    <div class="card">
      <div class="num" style="font-size:15px">${report.items[0]?.name.split(' ').slice(0,3).join(' ') || '—'}</div>
      <div class="lbl">Top Seller</div>
      <div class="sub">${report.items[0]?.unitsSold.toLocaleString() || 0} units for the year</div>
    </div>
  </div>

  <div class="section-title">Quarterly Performance — Units Sold</div>
  <div class="chart-wrap">${chartSVG}</div>

  <div class="section-title">Annual Category Breakdown</div>
  <table>
    <thead><tr>
      <th>Category</th>
      <th style="text-align:right">Units ${fyLabel}</th>
      <th style="text-align:right">Units Prior Year</th>
      <th style="text-align:right">Change</th>
      <th style="text-align:right">% of Total</th>
      ${hasRev ? '<th style="text-align:right">Revenue</th><th style="text-align:right">Prior Revenue</th>' : ''}
    </tr></thead>
    <tbody>
      ${catRows}
      <tr class="totals-row">
        <td>TOTAL</td>
        <td style="text-align:right;font-family:monospace">${report.totals.unitsSold.toLocaleString()}</td>
        <td style="text-align:right;font-family:monospace;color:#64748b">${priorReport.totals.unitsSold.toLocaleString()}</td>
        <td style="text-align:right">${fmtChg(report.totals.unitsSold, priorReport.totals.unitsSold)}</td>
        <td style="text-align:right">100%</td>
        ${hasRev ? `<td style="text-align:right;font-family:monospace;color:#16a34a">${fmtRev(report.totals.revenue)}</td><td style="text-align:right;font-family:monospace;color:#94a3b8">${fmtRev(priorReport.totals.revenue)}</td>` : ''}
      </tr>
    </tbody>
  </table>

  <div class="section-title">Top 10 Sellers for the Year</div>
  <table>
    <thead><tr>
      <th style="width:28px;text-align:center">#</th>
      <th>Item</th>
      <th>Category</th>
      <th style="text-align:right">Units Sold</th>
      ${hasRev ? '<th style="text-align:right">Revenue</th>' : ''}
    </tr></thead>
    <tbody>${top10Rows}</tbody>
  </table>

  <div class="footer">
    <span>Paynter Bar Hub — GemLife Palmwoods | Data from Square POS</span>
    <span>Generated ${generated} | Financial Year ${fyLabel}</span>
  </div>
</div></body></html>`

    setAgmLoading(false)
    const w = window.open('', '_blank')
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 800)
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
                <span style={styles.logoSub}>GemLife Palmwoods</span>
              </div>
              <h1 style={styles.title}>{mainTab === 'sales' ? 'Sales Report' : mainTab === 'trends' ? 'Quarterly Trends' : mainTab === 'help' ? 'Help & Guide' : 'Reorder Planner'}</h1>
            </div>
            <div style={styles.headerRight}>
              {lastUpdated && <span style={styles.lastUpdated}>Updated {new Date(lastUpdated).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</span>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button style={{ ...styles.btn, background: '#0e7490' }} onClick={generateStockReport} title="Stock on Hand PDF">📋 Stock PDF</button>
                <button style={{ ...styles.btn, background: '#065f46' }} onClick={generateSalesReport} title="Monthly Sales PDF">📈 Sales PDF</button>
                <button style={{ ...styles.btn, background: '#7e22ce', ...(agmLoading ? styles.btnDisabled : {}) }} onClick={generateAGMReport} disabled={agmLoading} title="Annual AGM Report (May–April)">
                  {agmLoading ? '⏳ Building...' : '📑 AGM PDF'}
                </button>
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
                <button style={{ ...styles.btn, background: mainTab === 'help' ? '#1e293b' : '#475569' }}
                  onClick={() => setMainTab(t => t === 'help' ? 'reorder' : 'help')}>
                  {mainTab === 'help' ? '← Back' : '❓ Help'}
                </button>
                <button style={{ ...styles.btn, ...(refreshing ? styles.btnDisabled : {}) }}
                  onClick={() => loadItems(true)} disabled={refreshing}>
                  {refreshing ? 'Refreshing...' : 'Refresh'}
                </button>
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
                            saving={saving[`${item.name}_category`]} />
                        </td>
                        <td style={styles.td}>
                          <EditSelect value={item.supplier} options={suppliers}
                            onChange={v => saveSetting(item.name, 'supplier', v)}
                            saving={saving[`${item.name}_supplier`]} colorMap={SUPPLIER_COLORS} />
                        </td>
                        <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace' }}>{item.onHand}</td>
                        <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace' }}>{item.weeklyAvg}</td>
                        <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace' }}>{item.targetStock}</td>
                        <td style={{ ...styles.td, textAlign: 'center' }}>
                          <EditNumber value={item.pack} onChange={v => saveSetting(item.name, 'pack', v)}
                            saving={saving[`${item.name}_pack`]} min={1} />
                        </td>
                        <td style={{ ...styles.td, textAlign: 'center' }}>
                          {item.isSpirit ? (
                            <EditSelect value={String(item.bottleML)} options={['700', '750', '1000']}
                              onChange={v => saveSetting(item.name, 'bottleML', Number(v))}
                              saving={saving[`${item.name}_bottleML`]} />
                          ) : <span style={{ color: '#e2e8f0' }}>—</span>}
                        </td>
                        <td style={{ ...styles.td, textAlign: 'center' }}>
                          {item.isSpirit ? (
                            <EditSelect value={String(item.nipML || 30)} options={['30', '60']}
                              onChange={v => saveSetting(item.name, 'nipML', Number(v))}
                              saving={saving[`${item.name}_nipML`]} />
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
                            saving={saving[`${item.name}_notes`]} placeholder="Add note..." />
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
                                saving={saving[`${item.name}_buyPrice`]} min={0} />
                            </td>
                            <td style={{ ...styles.td, textAlign: 'right' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                                <EditNumber value={sell ?? ''} placeholder="$0.00" decimals={2} prefix="$"
                                  onChange={v => saveSetting(item.name, 'sellPrice', v)}
                                  saving={saving[`${item.name}_sellPrice`]} min={0} />
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

        {mainTab === 'trends' && <TrendsView data={trendData} loading={trendLoading} error={trendError} />}
        {mainTab === 'help' && <HelpTab />}

        <footer style={styles.footer}>
          Paynter Bar Hub — GemLife Palmwoods | Data from Square POS | {items.length} items tracked
        </footer>
      </div>
    </>
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
        { q: 'Logging in', a: 'Enter PIN 3838 on the login screen. Your session stays active until you close the browser tab. The app works on any device — phone, tablet or laptop.' },
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
        { q: 'Filtering to order items', a: 'Tick "Order items only" in the controls bar to hide items that don\'t need ordering — useful when preparing orders.' },
        { q: 'Supplier tabs', a: 'Click Dan Murphys, Coles Woolies or ACW to filter the table to just that supplier. Use + Supplier to add a new supplier.' },
        { q: 'Editing item settings', a: 'Click any value in the Category, Supplier, Pack, Bottle Size or Nip Size columns to edit inline. Changes save automatically to the cloud and are shared with all committee members.' },
        { q: 'Adding notes', a: 'Click the Notes column for any item to add a note (e.g. "Discontinued", "Check price"). Notes are saved and visible to all.' },
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
        { q: 'Enabling pricing', a: 'Click $ Pricing in the controls bar to reveal Buy Price, Sell Price and Margin % columns.' },
        { q: 'Sell prices from Square', a: 'Sell prices are imported automatically from your Square catalogue. Items marked "from Square" have been auto-populated. Click any price to override it.' },
        { q: 'Margin calculation', a: 'Margin % = (Sell − Buy) ÷ Sell × 100. Green = 40%+, amber = 20–40%, red = below 20%. Requires both buy and sell price to be set.' },
        { q: 'Buy prices', a: 'Click the Buy Price cell for any item and type the cost price. Saved to the cloud and shared across all sessions.' },
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
      icon: '🖨️',
      title: 'Printing & Exports',
      items: [
        { q: 'Print Order Sheet', a: 'Click Print Order Sheet → choose a supplier to open a print-ready order form. Use your browser\'s Print dialog or Save as PDF.' },
        { q: '📋 Stock PDF', a: 'Generates a Stock on Hand management report from current Square data — all items by category with status and order quantities. Print dialog opens automatically.' },
        { q: '📈 Sales PDF', a: 'Generates a Monthly Sales Report for the previous completed month — category breakdown, top 10 sellers, revenue and prior month comparisons. Best run on the 1st of each month.' },
        { q: 'Export Stocktake', a: 'Downloads an Excel spreadsheet for quarterly stocktakes. Count columns for Cool Room, Store Room and Bar. For spirits, enter decimal bottles (e.g. 4.5) — the sheet calculates nips automatically and shows the variance against Square.' },
      ]
    },
    {
      icon: '⚙️',
      title: 'Settings & Administration',
      items: [
        { q: 'Shared settings', a: 'All settings (categories, suppliers, pack sizes, bottle/nip sizes, prices, notes, target weeks) are saved to the cloud. Any committee member sees the same settings on any device.' },
        { q: 'Adding suppliers', a: 'Use the + Supplier button in the controls bar. Assign items to suppliers by clicking the Supplier column inline.' },
        { q: 'Item categories', a: 'Available categories: Beer, Cider, PreMix, White Wine, Red Wine, Rose, Sparkling, Fortified & Liqueurs, Spirits, Soft Drinks, Snacks. Spirits and Fortified & Liqueurs items get the bottle and nip size columns.' },
        { q: 'Square POS connection', a: 'The app connects to your Square account via API. Stock levels and sales update on every Refresh. Square remains the source of truth — all transactions happen through Square as normal.' },
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
          This app manages bar operations for the Paynter Bar volunteer team. It connects directly to Square POS to provide
          live stock levels, sales analytics, automated reorder calculations and management reports — all in one place.
          Settings and changes made by any committee member are shared across all devices instantly.
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
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 24, background: '#fff', padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
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
          <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
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
                <div key={label} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '20px 24px', minWidth: 150, flex: 1 }}>
                  <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{label}</div>
                  <div style={{ fontSize: 26, fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace', color: '#0f172a' }}>{value}</div>
                  {!noChange && prev != null && (
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                      Prior: {money ? fmt(rawPrev) : prev}
                      {chg != null && <span style={{ marginLeft: 6, color: chg >= 0 ? '#16a34a' : '#dc2626', fontWeight: 700 }}>{chg >= 0 ? '+' : ''}{chg}%</span>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Category bar */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '20px 24px', marginBottom: 24, overflowX: 'auto' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Category Breakdown — click to filter</div>
            <div style={{ display: 'flex', gap: 0, minWidth: 'max-content' }}>
              {CATEGORY_ORDER_LIST.filter(c => report.categories[c]).map(c => {
                const cat = report.categories[c]
                const pct = report.totals.unitsSold > 0 ? Math.round((cat.unitsSold / report.totals.unitsSold) * 100) : 0
                const active = category === c
                return (
                  <button key={c} onClick={() => setCategory(active ? 'All' : c)}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '10px 16px', cursor: 'pointer', border: 'none', borderBottom: `3px solid ${active ? '#2563eb' : '#e2e8f0'}`, background: active ? '#eff6ff' : 'transparent', minWidth: 110 }}>
                    <span style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>{c}</span>
                    <span style={{ fontSize: 20, fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace', color: '#0f172a' }}>{cat.unitsSold}</span>
                    <span style={{ fontSize: 10, color: '#94a3b8' }}>{pct}%</span>
                    {hasRev && cat.revenue > 0 && <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 600 }}>{fmt(cat.revenue)}</span>}
                  </button>
                )
              })}
              <button onClick={() => setCategory('All')}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '10px 16px', cursor: 'pointer', border: 'none', borderBottom: `3px solid ${category === 'All' ? '#2563eb' : '#e2e8f0'}`, background: category === 'All' ? '#eff6ff' : 'transparent', minWidth: 80 }}>
                <span style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>ALL</span>
                <span style={{ fontSize: 20, fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace', color: '#0f172a' }}>{report.totals.unitsSold}</span>
                <span style={{ fontSize: 10, color: '#94a3b8' }}>100%</span>
                {hasRev && <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 600 }}>{fmt(report.totals.revenue)}</span>}
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
            <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 500px)' }}>
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
function EditSelect({ value, options, onChange, saving, colorMap }) {
  const [editing, setEditing] = useState(false)
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

function EditNumber({ value, onChange, saving, min, placeholder, decimals, prefix }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value)
  useEffect(() => setVal(value), [value])
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

function EditText({ value, onChange, saving, placeholder }) {
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
