-- Apps Secundários (brpfklddehlxorjxcodk) — NÃO usar PedagoFlow (qrjmvqedoypxmnvfdetg)
CREATE TABLE IF NOT EXISTS public.orcamento_transacoes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    data date NOT NULL,
    descricao text NOT NULL,
    valor numeric NOT NULL,
    tipo text NOT NULL,
    usuario_id uuid REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE public.orcamento_transacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orcamento_select_own"
ON public.orcamento_transacoes FOR SELECT
TO authenticated
USING (auth.uid() = usuario_id);

CREATE POLICY "orcamento_insert_own"
ON public.orcamento_transacoes FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "orcamento_update_own"
ON public.orcamento_transacoes FOR UPDATE
TO authenticated
USING (auth.uid() = usuario_id);

CREATE POLICY "orcamento_delete_own"
ON public.orcamento_transacoes FOR DELETE
TO authenticated
USING (auth.uid() = usuario_id);
