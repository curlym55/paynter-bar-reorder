import { useState, useEffect, useCallback, useRef } from 'react'
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

  async function clearOverride(itemName) {
    const key = `${itemName}_stockOverride`
    setSaving(s => ({ ...s, [key]: true }))
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemName, field: 'stockOverride', value: null })
      })
      setItems(prev => prev.map(item =>
        item.name === itemName ? { ...item, stockOverride: null } : item
      ))
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

  function printOrderSheet(supplier) {
    const orderItems = items.filter(i => i.supplier === supplier && i.orderQty > 0)
    const date = new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
    const isSpirit = (cat) => cat === 'Spirits' || cat === 'Fortified & Liqueurs'
    const rows = orderItems.map(item => `
      <tr>
        <td>${item.name}</td>
        <td>${item.category}</td>
        <td style="text-align:right">${item.onHand}</td>
        <td style="text-align:right;font-weight:700">${item.orderQty}</td>
        <td style="text-align:right">${isSpirit(item.category) && item.bottlesToOrder ? item.bottlesToOrder : '-'}</td>
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
    // Build rows
    const rows = displayed.map(item => ({
      'Item': item.name,
      'Category': item.category,
      'Supplier': item.supplier,
      'Cool Room': '',
      'Store Room': '',
      'Bar': '',
      'Total Count': '',
      'Square On Hand': item.onHand,
      'Difference': '',
    }))

    // Load SheetJS dynamically
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
    script.onload = () => {
      const ws = window.XLSX.utils.json_to_sheet(rows)

      // Column widths
      ws['!cols'] = [
        { wch: 40 }, // Item
        { wch: 18 }, // Category
        { wch: 16 }, // Supplier
        { wch: 12 }, // Cool Room
        { wch: 12 }, // Store Room
        { wch: 10 }, // Bar
        { wch: 13 }, // Total Count
        { wch: 16 }, // Square On Hand
        { wch: 12 }, // Difference
      ]

      // Freeze header row
      ws['!freeze'] = { xSplit: 0, ySplit: 1 }

      // Add Total Count formula = D+E+F, Difference = H-G
      const range = window.XLSX.utils.decode_range(ws['!ref'])
      for (let r = 1; r <= range.e.r; r++) {
        const row = r + 1
        // Total Count = Cool Room + Store Room + Bar
        ws[`G${row}`] = { f: `D${row}+E${row}+F${row}`, t: 'n' }
        // Difference = Total Count - Square On Hand
        ws[`I${row}`] = { f: `G${row}-H${row}`, t: 'n' }
      }

      const wb = window.XLSX.utils.book_new()
      window.XLSX.utils.book_append_sheet(wb, ws, 'Stocktake')

      const date = new Date().toISOString().split('T')[0]
      window.XLSX.writeFile(wb, `Paynter-Bar-Stocktake-${date}.xlsx`)
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
        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          value={pin}
          onChange={e => { setPin(e.target.value); setPinError(false) }}
          onKeyDown={e => e.key === 'Enter' && checkPin()}
          placeholder="PIN"
          autoFocus
          style={{ width: '100%', fontSize: 24, textAlign: 'center', padding: '10px 16px', borderRadius: 8, border: pinError ? '2px solid #dc2626' : '2px solid #e2e8f0', outline: 'none', fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.3em', marginBottom: 8 }}
        />
        {pinError && <p style={{ color: '#dc2626', fontSize: 12, marginBottom: 8, textAlign: 'center' }}>Incorrect PIN. Try again.</p>}
        <button onClick={checkPin}
          style={{ width: '100%', background: '#0f172a', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 4 }}>
          Enter
        </button>
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
        <title>Paynter Bar - Reorder Planner</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </Head>
      <div style={styles.page}>
        <header style={styles.header}>
          <div style={styles.headerInner}>
            <div>
              <div style={styles.headerTop}>
                <span style={styles.logo}>PAYNTER BAR</span>
                <span style={styles.logoSub}>GemLife Palmwoods</span>
              </div>
              <h1 style={styles.title}>Reorder Planner</h1>
            </div>
            <div style={styles.headerRight}>
              {lastUpdated && <span style={styles.lastUpdated}>Updated {new Date(lastUpdated).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</span>}
              <button style={{ ...styles.btn, ...(refreshing ? styles.btnDisabled : {}) }}
                onClick={() => loadItems(true)} disabled={refreshing}>
                {refreshing ? 'Refreshing...' : 'Refresh from Square'}
              </button>
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
                  style={{ ...styles.tab, padding: '4px 12px', fontSize: 12,
                    ...(daysBack === d ? { background: '#0f172a', color: '#fff', borderColor: '#0f172a' } : {}) }}
                  onClick={() => { setDaysBack(d); loadItems(true, d) }}>
                  {d}d
                </button>
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
                <tr><td colSpan={viewMode === 'pricing' ? 14 : 11} style={{ textAlign: 'center', padding: '48px 24px', color: '#64748b' }}>
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
                    <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace' }}>
                      {item.onHand}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace' }}>{item.weeklyAvg}</td>
                    <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace' }}>{item.targetStock}</td>
                    <td style={{ ...styles.td, textAlign: 'center' }}>
                      <EditNumber value={item.pack} onChange={v => saveSetting(item.name, 'pack', v)}
                        saving={saving[`${item.name}_pack`]} min={1} />
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right', fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace', fontSize: 15 }}>
                      {item.orderQty > 0 ? item.orderQty : '-'}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', color: '#1f4e79' }}>
                      {item.bottlesToOrder ? item.bottlesToOrder : '-'}
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
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                            <EditNumber value={buy ?? ''} placeholder="$0.00" decimals={2} prefix="$"
                              onChange={v => saveSetting(item.name, 'buyPrice', v)}
                              saving={saving[`${item.name}_buyPrice`]} min={0} />

                          </div>
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
        <footer style={styles.footer}>
          Paynter Bar - GemLife Palmwoods | Data from Square POS | {items.length} items tracked
        </footer>
      </div>
    </>
  )
}

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

const styles = {
  page: { minHeight: '100vh', background: '#f1f5f9', fontFamily: "'IBM Plex Sans', sans-serif" },
  loadWrap: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f1f5f9' },
  loadBox: { textAlign: 'center' },
  spinner: { width: 40, height: 40, border: '3px solid #e2e8f0', borderTop: '3px solid #1f4e79', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' },
  header: { background: '#0f172a', color: '#fff' },
  headerInner: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '24px 32px 16px', flexWrap: 'wrap', gap: 16 },
  headerTop: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 },
  logo: { fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', color: '#94a3b8', textTransform: 'uppercase', fontFamily: "'IBM Plex Mono', monospace" },
  logoSub: { fontSize: 11, color: '#475569', fontFamily: "'IBM Plex Mono', monospace" },
  title: { fontSize: 26, fontWeight: 700, margin: 0, color: '#f8fafc', letterSpacing: '-0.02em' },
  headerRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 },
  lastUpdated: { fontSize: 12, color: '#64748b', fontFamily: "'IBM Plex Mono', monospace" },
  btn: { background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" },
  btnDisabled: { background: '#334155', cursor: 'not-allowed' },
  statsBar: { display: 'flex', borderTop: '1px solid #1e293b', padding: '0 32px' },
  stat: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 24px', borderRight: '1px solid #1e293b', gap: 2, borderTopWidth: 3, borderTopStyle: 'solid', borderTopColor: 'transparent' },
  statNum: { fontSize: 22, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", color: '#f8fafc' },
  statLabel: { fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' },
  targetInput: { width: 50, fontSize: 20, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", background: '#1e293b', color: '#f8fafc', border: '1px solid #475569', borderRadius: 4, textAlign: 'center', padding: '2px 4px' },
  errorBox: { background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', margin: '16px 32px', padding: '12px 16px', borderRadius: 6, fontSize: 13 },
  controls: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 32px', background: '#fff', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap', gap: 12 },
  viewTabs: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  tab: { padding: '6px 14px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#374151', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" },
  tabActive: { background: '#0f172a', color: '#fff', borderColor: '#0f172a' },
  filterCheck: { display: 'flex', alignItems: 'center', fontSize: 13, color: '#374151', cursor: 'pointer' },
  supplierInput: { fontSize: 13, border: '1px solid #3b82f6', borderRadius: 6, padding: '6px 10px', fontFamily: "'IBM Plex Sans', sans-serif", width: 160 },
  dropdown: { position: 'absolute', top: '100%', right: 0, marginTop: 4, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, minWidth: 200 },
  dropItem: { display: 'block', width: '100%', padding: '10px 16px', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: 13, color: '#374151', fontFamily: "'IBM Plex Sans', sans-serif" },
  tableWrap: { overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 220px)' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13, background: '#fff' },
  thead: { background: '#f8fafc', position: 'sticky', top: 0, zIndex: 10 },
  th: { padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap' },
  td: { padding: '9px 14px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' },
  inlineSelect: { fontSize: 12, border: '1px solid #3b82f6', borderRadius: 4, padding: '2px 4px', background: '#eff6ff', color: '#1d4ed8', fontFamily: "'IBM Plex Sans', sans-serif" },
  inlineInput: { width: 70, fontSize: 13, border: '1px solid #3b82f6', borderRadius: 4, padding: '2px 6px', background: '#eff6ff', color: '#1d4ed8', textAlign: 'center', fontFamily: "'IBM Plex Mono', monospace" },
  footer: { textAlign: 'center', padding: '24px', fontSize: 12, color: '#94a3b8', borderTop: '1px solid #e2e8f0', background: '#fff' }
}
