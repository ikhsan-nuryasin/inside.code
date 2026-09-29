-- Student Hub v1.7.0 — monthly class cash summary.
-- Monthly reporting is derived from immutable transaction dates so historical data remains intact.

CREATE INDEX IF NOT EXISTS cash_transactions_account_date_idx
  ON public.cash_transactions(cash_account_id, transaction_date DESC)
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.get_cash_month_summary(p_class_id uuid, p_month date)
RETURNS TABLE(
  opening_balance numeric,
  total_income numeric,
  total_expense numeric,
  net_change numeric,
  closing_balance numeric,
  transaction_count bigint,
  month_start date
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path=public,private
AS $$
  WITH bounds AS (
    SELECT date_trunc('month', p_month)::date AS month_start,
           (date_trunc('month', p_month) + interval '1 month')::date AS next_month
  ),
  base AS (
    SELECT ct.transaction_type, ct.amount, ct.transaction_date
    FROM public.cash_transactions ct
    JOIN public.cash_accounts ca ON ca.id = ct.cash_account_id
    CROSS JOIN bounds b
    WHERE ca.class_id = p_class_id
      AND ct.deleted_at IS NULL
      AND ct.voided_at IS NULL
      AND public.is_class_member(p_class_id)
  ),
  calc AS (
    SELECT
      COALESCE(SUM(CASE WHEN b.transaction_date < bo.month_start THEN CASE WHEN b.transaction_type='income' THEN b.amount ELSE -b.amount END ELSE 0 END),0) AS opening_balance,
      COALESCE(SUM(CASE WHEN b.transaction_date >= bo.month_start AND b.transaction_date < bo.next_month AND b.transaction_type='income' THEN b.amount ELSE 0 END),0) AS total_income,
      COALESCE(SUM(CASE WHEN b.transaction_date >= bo.month_start AND b.transaction_date < bo.next_month AND b.transaction_type='expense' THEN b.amount ELSE 0 END),0) AS total_expense,
      COUNT(*) FILTER (WHERE b.transaction_date >= bo.month_start AND b.transaction_date < bo.next_month) AS transaction_count,
      bo.month_start
    FROM base b
    CROSS JOIN bounds bo
    GROUP BY bo.month_start, bo.next_month
  )
  SELECT opening_balance,
         total_income,
         total_expense,
         total_income - total_expense AS net_change,
         opening_balance + total_income - total_expense AS closing_balance,
         transaction_count,
         month_start
  FROM calc;
$$;

REVOKE ALL ON FUNCTION public.get_cash_month_summary(uuid,date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_cash_month_summary(uuid,date) TO authenticated;
