import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import './App.css'

type Transacao = {
  id: string
  data: string
  descricao: string
  valor: number
  tipo: string
}

function App() {
  const [rows, setRows] = useState<Transacao[]>([])
  const [status, setStatus] = useState('A ligar ao Supabase…')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error: qErr } = await supabase
        .from('orcamento_transacoes')
        .select('id, data, descricao, valor, tipo')
        .limit(20)

      if (cancelled) return
      if (qErr) {
        setError(qErr.message)
        setStatus('Falha na consulta')
        return
      }
      setRows(data ?? [])
      setStatus(
        data && data.length > 0
          ? `${data.length} lançamento(s)`
          : 'Ligação OK — tabela vazia (normal sem login/RLS)',
      )
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main style={{ fontFamily: 'system-ui', maxWidth: 640, margin: '2rem auto', padding: 16 }}>
      <h1>Orçamento familiar — teste Supabase</h1>
      <p>
        Projecto: <code>brpfklddehlxorjxcodk</code> · tabela <code>orcamento_transacoes</code>
      </p>
      <p>
        <strong>{status}</strong>
      </p>
      {error && (
        <p style={{ color: 'crimson' }}>
          Erro: {error}
          <br />
          <small>Com RLS, sem login autenticado a lista pode falhar ou vir vazia — a ligação URL/anon já é um sinal.</small>
        </p>
      )}
      <ul>
        {rows.map((r) => (
          <li key={r.id}>
            {r.data} · {r.tipo} · {r.descricao} · {r.valor}
          </li>
        ))}
      </ul>
    </main>
  )
}

export default App
