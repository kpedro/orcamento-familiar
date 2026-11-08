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

function App() {
  const [rows, setRows] = useState<Transacao[]>(() => loadLocal())
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [tipo, setTipo] = useState<Tipo>('despesa')
  const [data, setData] = useState(todayISO())
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
  }, [rows])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: remote, error: qErr } = await supabase
        .from('orcamento_transacoes')
        .select('id, data, descricao, valor, tipo')
        .order('data', { ascending: false })
        .limit(50)

      if (cancelled) return
      if (qErr) {
        // Sem login/RLS a nuvem pode falhar — o app continua com dados locais
        setStatus('A trabalhar neste aparelho. Liga a conta depois para sincronizar na família.')
        return
      }
      if (remote && remote.length > 0) {
        setRows(
          remote.map((r) => ({
            id: String(r.id),
            data: String(r.data),
            descricao: String(r.descricao),
            valor: Number(r.valor),
            tipo: r.tipo === 'receita' ? 'receita' : 'despesa',
          })),
        )
        setStatus('Sincronizado com a nuvem.')
      } else {
        setStatus('Pronto. Os lançamentos ficam neste aparelho até haver login familiar.')
      }
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

    const { error: insErr } = await supabase.from('orcamento_transacoes').insert({
      data: draft.data,
      descricao: draft.descricao,
      valor: draft.valor,
      tipo: draft.tipo,
    })
    setSaving(false)

    if (insErr) {
      setStatus('Guardado neste aparelho. Para gravar na nuvem será preciso login (RLS).')
    } else {
      setStatus('Lançamento guardado.')
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <p>Casa · contas em ordem</p>
          <h1>Orçamento familiar</h1>
        </div>
        <div className="month-chip">{monthLabel}</div>
      </header>

      <section className="summary" aria-label="Resumo do mês">
        <article className="summary-card saldo">
          <span>Saldo do mês</span>
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
                placeholder="Ex.: Mercado, salário, luz…"
                autoComplete="off"
              />
            </label>
            <label>
              Valor (R$)
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
            <label className="full">
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
        {error && <p className="status error">{error}</p>}
        {status && !error && <p className="hint">{status}</p>}
      </section>

      <section className="panel">
        <h2>Lançamentos</h2>
        {rows.length === 0 ? (
          <p className="empty">Ainda não há movimentos. Adiciona o primeiro em cima.</p>
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
