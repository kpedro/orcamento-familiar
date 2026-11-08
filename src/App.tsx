import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from './supabaseClient'
import './App.css'

type Tipo = 'receita' | 'despesa'

type Transacao = {
  id: string
  data: string
  descricao: string
  valor: number
  tipo: Tipo
}

const STORAGE_KEY = 'orcamento_lancamentos_v1'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function money(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function loadLocal(): Transacao[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Transacao[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function mapRemote(remote: { id: unknown; data: unknown; descricao: unknown; valor: unknown; tipo: unknown }[]): Transacao[] {
  return remote.map((r) => ({
    id: String(r.id),
    data: String(r.data),
    descricao: String(r.descricao),
    valor: Number(r.valor),
    tipo: r.tipo === 'receita' ? 'receita' : 'despesa',
  }))
}

function App() {
  const [rows, setRows] = useState<Transacao[]>(() => loadLocal())
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [tipo, setTipo] = useState<Tipo>('despesa')
  const [data, setData] = useState(todayISO())
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [syncNote, setSyncNote] = useState<string | null>(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
  }, [rows])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setSyncing(true)
      const local = loadLocal()
      const { data: remote, error: qErr } = await supabase
        .from('orcamento_transacoes')
        .select('id, data, descricao, valor, tipo')
        .order('data', { ascending: false })
        .limit(100)

      if (cancelled) return

      if (qErr) {
        setError(`Nuvem: ${qErr.message}. A mostrar só o que está neste aparelho.`)
        setSyncing(false)
        return
      }

      if (remote && remote.length > 0) {
        setRows(mapRemote(remote))
        setSyncNote('Sincronizado com a nuvem')
        setSyncing(false)
        return
      }

      // Nuvem vazia + dados só neste browser → enviar para o telemóvel ver
      if (local.length > 0) {
        const payload = local.map((r) => ({
          data: r.data,
          descricao: r.descricao,
          valor: r.valor,
          tipo: r.tipo,
        }))
        const { error: upErr } = await supabase.from('orcamento_transacoes').insert(payload)
        if (cancelled) return
        if (upErr) {
          setError(`Não consegui enviar para a nuvem: ${upErr.message}`)
        } else {
          const { data: again } = await supabase
            .from('orcamento_transacoes')
            .select('id, data, descricao, valor, tipo')
            .order('data', { ascending: false })
            .limit(100)
          if (again?.length) setRows(mapRemote(again))
          setSyncNote('Dados deste PC enviados para a nuvem')
        }
      } else {
        setSyncNote('Sem movimentos na nuvem ainda')
      }
      setSyncing(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const monthLabel = useMemo(
    () =>
      new Date().toLocaleDateString('pt-BR', {
        month: 'long',
        year: 'numeric',
      }),
    [],
  )

  const { receitas, despesas, saldo } = useMemo(() => {
    const month = todayISO().slice(0, 7)
    let r = 0
    let d = 0
    for (const row of rows) {
      if (!row.data.startsWith(month)) continue
      if (row.tipo === 'receita') r += row.valor
      else d += row.valor
    }
    return { receitas: r, despesas: d, saldo: r - d }
  }, [rows])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const amount = Number(String(valor).replace(',', '.'))
    if (!descricao.trim()) {
      setError('Escreve uma descrição.')
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Indica um valor maior que zero.')
      return
    }

    const draft: Transacao = {
      id: crypto.randomUUID(),
      data,
      descricao: descricao.trim(),
      valor: amount,
      tipo,
    }

    setSaving(true)
    setRows((prev) => [draft, ...prev])
    setDescricao('')
    setValor('')
    setTipo('despesa')
    setData(todayISO())

    const { data: inserted, error: insErr } = await supabase
      .from('orcamento_transacoes')
      .insert({
        data: draft.data,
        descricao: draft.descricao,
        valor: draft.valor,
        tipo: draft.tipo,
      })
      .select('id, data, descricao, valor, tipo')
      .single()

    if (insErr) {
      setError(`Guardado neste aparelho, mas não na nuvem: ${insErr.message}`)
    } else if (inserted) {
      setRows((prev) => {
        const withoutDraft = prev.filter((r) => r.id !== draft.id)
        return [mapRemote([inserted])[0], ...withoutDraft]
      })
      setSyncNote('Guardado na nuvem')
    }
    setSaving(false)
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <h1>Orçamento familiar</h1>
        </div>
        <div className="month-chip">{monthLabel}</div>
      </header>

      {(syncing || syncNote) && (
        <p className="status sync-line">{syncing ? 'A sincronizar…' : syncNote}</p>
      )}

      <section className="summary" aria-label="Resumo do mês">
        <article className="summary-card saldo">
          <span>Saldo</span>
          <strong>{money(saldo)}</strong>
        </article>
        <article className="summary-card receita">
          <span>Receitas</span>
          <strong>{money(receitas)}</strong>
        </article>
        <article className="summary-card despesa">
          <span>Despesas</span>
          <strong>{money(despesas)}</strong>
        </article>
      </section>

      <section className="panel">
        <h2>Novo lançamento</h2>
        <form onSubmit={onSubmit}>
          <div className="form-grid">
            <label className="full">
              Descrição
              <input
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Mercado, salário, luz…"
                autoComplete="off"
              />
            </label>
            <label>
              Valor
              <input
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0,00"
              />
            </label>
            <label>
              Tipo
              <select value={tipo} onChange={(e) => setTipo(e.target.value as Tipo)}>
                <option value="despesa">Despesa</option>
                <option value="receita">Receita</option>
              </select>
            </label>
            <label className="data-field">
              Data
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </label>
          </div>
          <div className="actions">
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'A guardar…' : 'Adicionar'}
            </button>
          </div>
        </form>
        {error && <p className="status">{error}</p>}
      </section>

      <section className="panel">
        <h2>Lançamentos</h2>
        {rows.length === 0 ? (
          <p className="empty">Sem movimentos ainda. Adiciona o primeiro acima.</p>
        ) : (
          <ul className="list">
            {rows.map((r) => (
              <li key={r.id}>
                <span className={`badge ${r.tipo}`}>{r.tipo}</span>
                <div className="item-main">
                  <strong>{r.descricao}</strong>
                  <small>
                    {new Date(r.data + 'T12:00:00').toLocaleDateString('pt-BR')}
                  </small>
                </div>
                <span className={`item-valor ${r.tipo}`}>
                  {r.tipo === 'despesa' ? '−' : '+'}
                  {money(r.valor)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export default App
