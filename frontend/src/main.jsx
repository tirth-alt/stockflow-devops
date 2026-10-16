import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const API = '/api/products'
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const EMPTY = { name: '', sku: '', category: '', quantity: 0, reorder_level: 10, unit_price: '', supplier: '' }

function stockLevel(p) {
  if (p.quantity === 0) return 'out'
  if (p.quantity <= p.reorder_level) return 'low'
  return 'ok'
}

async function request(url, options = {}) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const detail = Array.isArray(body.detail) ? body.detail.map((d) => `${d.loc.at(-1)}: ${d.msg}`).join(', ') : body.detail
    throw new Error(detail || `Request failed (${res.status})`)
  }
  return res.status === 204 ? null : res.json()
}

function App() {
  const [products, setProducts] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [editing, setEditing] = useState(null) // null = closed, {} = new, product = edit

  const load = async () => {
    try {
      const [list, s] = await Promise.all([request(API), request(`${API}/stats`)])
      setProducts(list)
      setStats(s)
      setError('')
    } catch (e) {
      setError(`Can't reach the inventory service: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const categories = useMemo(() => ['All', ...new Set(products.map((p) => p.category))].sort((a, b) => (a === 'All' ? -1 : a.localeCompare(b))), [products])
  const visible = products.filter((p) =>
    (category === 'All' || p.category === category) &&
    `${p.name} ${p.sku} ${p.supplier}`.toLowerCase().includes(query.toLowerCase()))
  const restock = products.filter((p) => stockLevel(p) !== 'ok').sort((a, b) => a.quantity - b.quantity)

  const adjust = async (p, delta) => {
    try {
      await request(`${API}/${p.id}`, { method: 'PUT', body: JSON.stringify({ quantity: Math.max(0, p.quantity + delta) }) })
      load()
    } catch (e) { setError(e.message) }
  }
  const remove = async (p) => {
    try {
      await request(`${API}/${p.id}`, { method: 'DELETE' })
      load()
    } catch (e) { setError(e.message) }
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand"><span className="brand-box" aria-hidden="true" />StockFlow</div>
        <span className="store">Northside Hardware · Main stock room</span>
        <button className="btn primary" onClick={() => setEditing({})}>Add product</button>
      </header>

      <main>
        <section className="ledger" aria-label="Inventory totals">
          <Figure label="Inventory value" value={stats ? money.format(stats.inventory_value) : '—'} big />
          <Figure label="Products" value={stats?.total_products ?? '—'} />
          <Figure label="Units on shelves" value={stats?.total_units ?? '—'} />
          <Figure label="Running low" value={stats?.low_stock ?? '—'} tone="low" />
          <Figure label="Out of stock" value={stats?.out_of_stock ?? '—'} tone="out" />
        </section>

        {error && <div className="alert" role="alert">{error}. Check that the backend and PostgreSQL are running, then <button className="link" onClick={load}>retry</button>.</div>}

        {restock.length > 0 && (
          <section className="restock" aria-label="Restock needed">
            <h2>Restock needed</h2>
            <ul>
              {restock.map((p) => (
                <li key={p.id} className={stockLevel(p)}>
                  <b>{p.name}</b>
                  <span>{p.quantity === 0 ? 'Out of stock' : `${p.quantity} left, reorder at ${p.reorder_level}`}</span>
                  <button className="btn small" onClick={() => adjust(p, p.reorder_level * 2)}>Receive {p.reorder_level * 2}</button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="stock">
          <div className="stock-head">
            <h1>Stock</h1>
            <input className="search" type="search" placeholder="Search name, SKU or supplier" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search products" />
          </div>
          <div className="tabs" role="tablist">
            {categories.map((c) => (
              <button key={c} role="tab" aria-selected={category === c} className={category === c ? 'tab on' : 'tab'} onClick={() => setCategory(c)}>{c}</button>
            ))}
          </div>

          {loading ? <p className="empty">Loading inventory…</p> : visible.length === 0 ? (
            <p className="empty">{products.length ? 'No products match this search.' : 'No products yet. Add your first product to start tracking stock.'}</p>
          ) : (
            <table>
              <thead>
                <tr><th>Product</th><th>Category</th><th>Stock</th><th className="num">Unit price</th><th className="num">Value</th><th><span className="sr">Actions</span></th></tr>
              </thead>
              <tbody>
                {visible.map((p) => (
                  <tr key={p.id}>
                    <td data-label="Product"><b>{p.name}</b><small>{p.sku}{p.supplier && ` · ${p.supplier}`}</small></td>
                    <td data-label="Category">{p.category}</td>
                    <td data-label="Stock"><Gauge p={p} onAdjust={adjust} /></td>
                    <td data-label="Unit price" className="num">{money.format(p.unit_price)}</td>
                    <td data-label="Value" className="num">{money.format(p.unit_price * p.quantity)}</td>
                    <td className="row-actions">
                      <button className="btn ghost small" onClick={() => setEditing(p)}>Edit</button>
                      <ConfirmDelete onConfirm={() => remove(p)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>

      {editing && <ProductForm product={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
    </div>
  )
}

function Figure({ label, value, tone, big }) {
  return <div className={`figure ${tone || ''} ${big ? 'big' : ''}`}><span>{label}</span><strong>{value}</strong></div>
}

// Bar is scaled so the reorder line always sits at 1/3 of the track.
function Gauge({ p, onAdjust }) {
  const level = stockLevel(p)
  const fill = Math.min(100, (p.quantity / Math.max(1, p.reorder_level * 3)) * 100)
  return (
    <div className={`gauge ${level}`}>
      <button className="step" onClick={() => onAdjust(p, -1)} disabled={p.quantity === 0} aria-label={`Remove one ${p.name}`}>−</button>
      <div className="track" title={`Reorder at ${p.reorder_level}`}><i style={{ width: `${fill}%` }} /><em /></div>
      <span className="qty">{p.quantity}</span>
      <button className="step" onClick={() => onAdjust(p, 1)} aria-label={`Add one ${p.name}`}>+</button>
    </div>
  )
}

function ConfirmDelete({ onConfirm }) {
  const [armed, setArmed] = useState(false)
  return armed
    ? <button className="btn danger small" onClick={onConfirm} onBlur={() => setArmed(false)} autoFocus>Confirm delete</button>
    : <button className="btn ghost small" onClick={() => setArmed(true)}>Delete</button>
}

function ProductForm({ product, onClose, onSaved }) {
  const isNew = !product.id
  const [form, setForm] = useState({ ...EMPTY, ...product })
  const [error, setError] = useState('')
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    const { name, sku, category, quantity, reorder_level, unit_price, supplier } = form
    const body = { name, sku, category, supplier, quantity: Number(quantity), reorder_level: Number(reorder_level), unit_price: Number(unit_price) }
    try {
      await request(isNew ? API : `${API}/${product.id}`, { method: isNew ? 'POST' : 'PUT', body: JSON.stringify(body) })
      onSaved()
    } catch (err) { setError(err.message) }
  }

  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="sheet" onSubmit={submit} aria-label={isNew ? 'Add product' : 'Edit product'}>
        <h2>{isNew ? 'Add product' : `Edit ${product.name}`}</h2>
        {error && <p className="form-error" role="alert">{error}</p>}
        <label>Name<input required maxLength={120} value={form.name} onChange={set('name')} placeholder="Cordless drill 18V" autoFocus /></label>
        <div className="row">
          <label>SKU<input required maxLength={40} value={form.sku} onChange={set('sku')} placeholder="DRL-018" /></label>
          <label>Category<input required maxLength={60} value={form.category} onChange={set('category')} placeholder="Power tools" /></label>
        </div>
        <div className="row three">
          <label>Quantity<input type="number" min="0" required value={form.quantity} onChange={set('quantity')} /></label>
          <label>Reorder at<input type="number" min="0" required value={form.reorder_level} onChange={set('reorder_level')} /></label>
          <label>Unit price ($)<input type="number" min="0" step="0.01" required value={form.unit_price} onChange={set('unit_price')} /></label>
        </div>
        <label>Supplier<input maxLength={120} value={form.supplier} onChange={set('supplier')} placeholder="Optional" /></label>
        <div className="sheet-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary">{isNew ? 'Add product' : 'Save changes'}</button>
        </div>
      </form>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
