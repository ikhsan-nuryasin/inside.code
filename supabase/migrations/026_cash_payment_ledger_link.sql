-- Student Hub v1.7.0 — link verified class-fee payments to the monthly cash ledger.
-- A payment becomes an income transaction only when the treasurer verifies it as paid.
-- The link makes the operation idempotent and prevents double-counting.

ALTER TABLE public.cash_payments
  ADD COLUMN IF NOT EXISTS cash_transaction_id uuid REFERENCES public.cash_transactions(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS cash_payments_cash_transaction_uidx
  ON public.cash_payments(cash_transaction_id)
  WHERE cash_transaction_id IS NOT NULL;

DROP FUNCTION IF EXISTS public.verify_cash_payment(uuid,public.cash_payment_status,text);
CREATE OR REPLACE FUNCTION public.verify_cash_payment(
  p_payment_id uuid,
  p_status public.cash_payment_status,
  p_rejection_reason text DEFAULT NULL
)
RETURNS public.cash_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,private
AS $$
DECLARE
  v public.cash_payments;
  v_class_id uuid;
  v_due_title text;
  v_cash_account_id uuid;
  v_tx_id uuid;
BEGIN
  SELECT cp.* INTO v
  FROM public.cash_payments cp
  WHERE cp.id=p_payment_id AND cp.deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'CASH_PAYMENT_NOT_FOUND'; END IF;

  SELECT d.class_id,d.title INTO v_class_id,v_due_title
  FROM public.cash_dues d WHERE d.id=v.due_id AND d.deleted_at IS NULL;
  IF v_class_id IS NULL THEN RAISE EXCEPTION 'CASH_DUE_NOT_FOUND'; END IF;
  IF NOT public.can_manage_cash(v_class_id) THEN RAISE EXCEPTION 'CASH_MANAGER_REQUIRED' USING errcode='42501'; END IF;

  IF v.status='paid' AND p_status <> 'paid' THEN
    RAISE EXCEPTION 'CASH_PAYMENT_PAID_IMMUTABLE';
  END IF;
  IF p_status='rejected' AND char_length(trim(coalesce(p_rejection_reason,''))) < 3 THEN
    RAISE EXCEPTION 'REJECTION_REASON_REQUIRED';
  END IF;

  UPDATE public.cash_payments
  SET status=p_status,
      paid_at=CASE WHEN p_status='paid' THEN COALESCE(paid_at,now()) ELSE NULL END,
      verified_by=auth.uid(),
      verified_at=now(),
      rejection_reason=nullif(trim(p_rejection_reason),''),
      updated_at=now()
  WHERE id=p_payment_id
  RETURNING * INTO v;

  IF p_status='paid' AND v.cash_transaction_id IS NULL THEN
    SELECT id INTO v_cash_account_id FROM public.cash_accounts WHERE class_id=v_class_id LIMIT 1;
    IF v_cash_account_id IS NULL THEN RAISE EXCEPTION 'CASH_ACCOUNT_NOT_FOUND'; END IF;

    INSERT INTO public.cash_transactions(
      cash_account_id, created_by, transaction_type, amount, category, description,
      proof_file_id, transaction_date
    )
    VALUES(
      v_cash_account_id,
      auth.uid(),
      'income',
      v.amount,
      'Iuran Kelas',
      v_due_title,
      v.proof_file_id,
      COALESCE((v.paid_at AT TIME ZONE 'Asia/Jakarta')::date, CURRENT_DATE)
    )
    RETURNING id INTO v_tx_id;

    UPDATE public.cash_payments
    SET cash_transaction_id=v_tx_id, updated_at=now()
    WHERE id=v.id
    RETURNING * INTO v;
  END IF;

  RETURN v;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_cash_payment(uuid,public.cash_payment_status,text) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.verify_cash_payment(uuid,public.cash_payment_status,text) TO authenticated;
