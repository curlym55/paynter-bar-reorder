import { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'
import { CATEGORIES, SUPPLIERS } from '../lib/calculations'

const PRIORITY_COLORS = {
  CRITICAL: { bg: '#fee2e2', text: '#991b1b', badge: '#dc2626' },
  LOW:      { bg: '#fef9c3', text: '#854d0e', badge: '#ca8a04' },
  OK:       { bg: '#f0fdf4', text: '#166534', badge: '#16a34a' },
}

const SUPPLIER_COLORS = {
  'Dan Murphys':  '#1f4e79',
  'Coles Woolies': '#c2410c',
  'ACW':          '#166534',
}

export default function Home() {
  const [items, setItems]             = useState([])
  const [loading, setLoading]         = useState(true)
  const [refreshing, setRefreshing]   = useState(false)
  const [error, setError]             = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [targetWeeks, setTargetWeeks] = useState(6)
  const [view, setView]               = useState('all')   // 'all' | supplier name
  const [filterOrder, setFilterOrder] = useState(false)
  const [saving, setSaving]           = useState({})
  const [editingTarget, setEditingTarget] = useState(false)

  const loadItems = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const r = await fetch('/api/items')
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

  async function saveSetting(itemName, field, value) {
    const key = `${itemName}_${field}`
    setSaving(s => ({ ...s, [key]: true }))
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemName, field, value })
      })
      // Update local state immediately
      setItems(prev => prev.map(item => {
        if (item.name !== itemName) return item
        const updated = { ...item, [field]: field === 'pack' || field === 'bottleML' || field === 'nipML'
          ? Number(value) : value }
        return updated
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

  const displayed = items
    .filter(item => view === 'all' || item.supplier === view)
    .filter(item => !filterOrder || item.orderQty > 0)

  const orderCount  = items.filter(i => i.orderQty > 0).length
  const critCount   = items.filter(i => i.priority === 'CRITICAL').length
  const suppliers   = ['Dan Murphys', 'Coles Woolies', 'ACW']

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
        <title>Paynter Bar — Reorder Planner</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </Head>

      <div style={styles.page}>
        {/* Header */}
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
              {lastUpdated && (
                <span style={styles.lastUpdated}>
                  Last updated {new Date(lastUpdated).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              <button
                style={{ ...styles.btn, ...(refreshing ? styles.btnDisabled : {}) }}
                onClick={() => loadItems(true)}
                disabled={refreshing}
              >
                {refreshing ? 'Refreshing...' : 'Refresh from Square'}
              </button>
            </div>
          </div>

          {/* Stats bar */}
          <div style={styles.statsBar}>
            <div style={styles.stat}>
              <span style={styles.statNum}>{items.length}</span>
              <span style={styles.statLabel}>Total Items</span>
            </div>
            <div style={{ ...styles.stat, borderColor: '#dc2626' }}>
              <span style={{ ...styles.statNum, color: '#dc2626' }}>{critCount}</span>
              <span style={styles.statLabel}>Critical</span>
            </div>
            <div style={{ ...styles.stat, borderColor: '#2563eb' }}>
              <span style={{ ...styles.statNum, color: '#2563eb' }}>{orderCount}</span>
              <span style={styles.statLabel}>To Order</span>
            </div>
            <div style={{ ...styles.stat, borderColor: '#f59e0b' }}>
              <span style={styles.statLabel}>Target Weeks</span>
              {editingTarget ? (
                <input
                  type="number"
                  defaultValue={targetWeeks}
                  style={styles.targetInput}
                  onBlur={e => saveTargetWeeks(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveTargetWeeks(e.target.value)}
                  autoFocus
                  min="1" max="26"
                />
              ) : (
                <span
                  style={{ ...styles.statNum, color: '#f59e0b', cursor: 'pointer', textDecoration: 'underline dotted' }}
                  onClick={() => setEditingTarget(true)}
                  title="Click to edit"
                >{targetWeeks}</span>
              )}
            </div>
          </div>
        </header>

        {/* Error */}
        {error && (
          <div style={styles.errorBox}>
            <strong>Error loading data:</strong> {error}
          </div>
        )}

        {/* Controls */}
        <div style={styles.controls}>
          <div style={styles.viewTabs}>
            <button
              style={{ ...styles.tab, ...(view === 'all' ? styles.tabActive : {}) }}
              onClick={() => setView('all')}
            >All Items</button>
            {suppliers.map(s => (
              <button
                key={s}
                style={{
                  ...styles.tab,
                  ...(view === s ? { ...styles.tabActive, background: SUPPLIER_COLORS[s], color: '#fff', borderColor: SUPPLIER_COLORS[s] } : {})
                }}
                onClick={() => setView(s)}
              >{s}</button>
            ))}
          </div>
          <label style={styles.filterCheck}>
            <input
              type="checkbox"
              checked={filterOrder}
              onChange={e => setFilterOrder(e.target.checked)}
              style={{ marginRight: 6 }}
            />
            Show order items only
          </label>
        </div>

        {/* Table */}
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.thead}>
                <th style={{ ...styles.th, width: 260 }}>Item</th>
                <th style={styles.th}>Category</th>
                <th style={styles.th}>Supplier</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>On Hand</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Wkly Avg</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Target</th>
                <th style={{ ...styles.th, textAlign: 'center' }}>Pack</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Order Qty</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Bottles</th>
                <th style={{ ...styles.th, textAlign: 'center' }}>Priority</th>
              </tr>
            </thead>
            <tbody>
              {displayed.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '48px 24px', color: '#64748b' }}>
                    {filterOrder ? 'No items to order this week.' : 'No items found.'}
                  </td>
                </tr>
              )}
              {displayed.map((item, idx) => {
                const p = PRIORITY_COLORS[item.priority]
                const rowBg = item.orderQty > 0 ? p.bg : (idx % 2 === 0 ? '#fff' : '#f8fafc')
                return (
                  <tr key={item.name} style={{ background: rowBg }}>
                    <td style={{ ...styles.td, fontWeight: 500, fontSize: 13 }}>
                      {item.name}
                    </td>
                    <td style={styles.td}>
                      <EditSelect
                        value={item.category}
                        options={CATEGORIES}
                        onChange={v => saveSetting(item.name, 'category', v)}
                        saving={saving[`${item.name}_category`]}
                      />
                    </td>
                    <td style={styles.td}>
                      <EditSelect
                        value={item.supplier}
                        options={SUPPLIERS}
                        onChange={v => saveSetting(item.name, 'supplier', v)}
                        saving={saving[`${item.name}_supplier`]}
                        colorMap={SUPPLIER_COLORS}
                      />
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace' }}>
                      {item.onHand}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace' }}>
                      {item.weeklyAvg}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace' }}>
                      {item.targetStock}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'center' }}>
                      <EditNumber
                        value={item.pack}
                        onChange={v => saveSetting(item.name, 'pack', v)}
                        saving={saving[`${item.name}_pack`]}
                        min={1}
                      />
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right', fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace', fontSize: 15 }}>
                      {item.orderQty > 0 ? item.orderQty : '—'}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', color: '#1f4e79' }}>
                      {item.bottlesToOrder ? item.bottlesToOrder : '—'}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 10px',
                        borderRadius: 99,
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                        background: p.badge,
                        color: '#fff'
                      }}>{item.priority}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <footer style={styles.footer}>
          Paynter Bar — GemLife Palmwoods &nbsp;|&nbsp; Data from Square POS &nbsp;|&nbsp; {items.length} items tracked
        </footer>
      </div>
    </>
  )
}

// Inline editable select
function EditSelect({ value, options, onChange, saving, colorMap }) {
  const [editing, setEditing] = useState(false)
  if (saving) return <span style={{ color: '#94a3b8', fontSize: 12 }}>Saving...</span>
  if (editing) return (
    <select
      defaultValue={value}
      autoFocus
      style={styles.inlineSelect}
      onChange={e => { onChange(e.target.value); setEditing(false) }}
      onBlur={() => setEditing(false)}
    >
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
  const color = colorMap ? colorMap[value] : null
  return (
    <span
      style={{ cursor: 'pointer', fontSize: 12, color: color || '#374151', fontWeight: color ? 600 : 400 }}
      onClick={() => setEditing(true)}
      title="Click to edit"
    >{value}</span>
  )
}

// Inline editable number
function EditNumber({ value, onChange, saving, min }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value)
  useEffect(() => setVal(value), [value])
  if (saving) return <span style={{ color: '#94a3b8', fontSize: 12 }}>...</span>
  if (editing) return (
    <input
      type="number"
      value={val}
      min={min || 1}
      style={styles.inlineInput}
      onChange={e => setVal(e.target.value)}
      onBlur={() => { onChange(val); setEditing(false) }}
      onKeyDown={e => { if (e.key === 'Enter') { onChange(val); setEditing(false) } }}
      autoFocus
    />
  )
  return (
    <span
      style={{ cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace', fontSize: 13 }}
      onClick={() => setEditing(true)}
      title="Click to edit"
    >{value}</span>
  )
}

const styles = {
  page: { minHeight: '100vh', background: '#f1f5f9', fontFamily: "'IBM Plex Sans', sans-serif" },
  loadWrap: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f1f5f9' },
  loadBox: { textAlign: 'center' },
  spinner: {
    width: 40, height: 40, border: '3px solid #e2e8f0',
    borderTop: '3px solid #1f4e79', borderRadius: '50%',
    animation: 'spin 1s linear infinite', margin: '0 auto'
  },
  header: { background: '#0f172a', color: '#fff', padding: '0 0 0 0' },
  headerInner: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '24px 32px 16px', flexWrap: 'wrap', gap: 16 },
  headerTop: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 },
  logo: { fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', color: '#94a3b8', textTransform: 'uppercase', fontFamily: "'IBM Plex Mono', monospace" },
  logoSub: { fontSize: 11, color: '#475569', fontFamily: "'IBM Plex Mono', monospace" },
  title: { fontSize: 26, fontWeight: 700, margin: 0, color: '#f8fafc', letterSpacing: '-0.02em' },
  headerRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 },
  lastUpdated: { fontSize: 12, color: '#64748b', fontFamily: "'IBM Plex Mono', monospace" },
  btn: {
    background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6,
    padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    fontFamily: "'IBM Plex Sans', sans-serif"
  },
  btnDisabled: { background: '#334155', cursor: 'not-allowed' },
  statsBar: { display: 'flex', gap: 0, borderTop: '1px solid #1e293b', padding: '0 32px' },
  stat: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '12px 24px', borderRight: '1px solid #1e293b', gap: 2,
    borderTopWidth: 2, borderTopStyle: 'solid', borderTopColor: 'transparent'
  },
  statNum: { fontSize: 22, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", color: '#f8fafc' },
  statLabel: { fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' },
  targetInput: {
    width: 50, fontSize: 20, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace",
    background: '#1e293b', color: '#f8fafc', border: '1px solid #475569',
    borderRadius: 4, textAlign: 'center', padding: '2px 4px'
  },
  errorBox: {
    background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b',
    margin: '16px 32px', padding: '12px 16px', borderRadius: 6, fontSize: 13
  },
  controls: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '16px 32px', background: '#fff', borderBottom: '1px solid #e2e8f0',
    flexWrap: 'wrap', gap: 12
  },
  viewTabs: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  tab: {
    padding: '6px 14px', borderRadius: 6, border: '1px solid #cbd5e1',
    background: '#f8fafc', color: '#374151', fontSize: 13, fontWeight: 500,
    cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif"
  },
  tabActive: { background: '#0f172a', color: '#fff', borderColor: '#0f172a' },
  filterCheck: { display: 'flex', alignItems: 'center', fontSize: 13, color: '#374151', cursor: 'pointer' },
  tableWrap: { overflowX: 'auto', margin: '0 0 0 0' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13, background: '#fff' },
  thead: { background: '#f8fafc' },
  th: {
    padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700,
    color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em',
    borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap'
  },
  td: { padding: '9px 14px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' },
  inlineSelect: {
    fontSize: 12, border: '1px solid #3b82f6', borderRadius: 4,
    padding: '2px 4px', background: '#eff6ff', color: '#1d4ed8',
    fontFamily: "'IBM Plex Sans', sans-serif"
  },
  inlineInput: {
    width: 56, fontSize: 13, border: '1px solid #3b82f6', borderRadius: 4,
    padding: '2px 6px', background: '#eff6ff', color: '#1d4ed8', textAlign: 'center',
    fontFamily: "'IBM Plex Mono', monospace"
  },
  footer: {
    textAlign: 'center', padding: '24px', fontSize: 12,
    color: '#94a3b8', borderTop: '1px solid #e2e8f0', background: '#fff'
  }
}
