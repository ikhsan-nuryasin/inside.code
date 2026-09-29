-- Student Hub v1.0.9 Phase 2: feature completeness and server-side invariants.

-- ============================================================
-- 1. Assignments + material attachments
-- ============================================================
CREATE TABLE IF NOT EXISTS public.assignment_files (
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  file_id uuid NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (assignment_id, file_id)
);
CREATE INDEX IF NOT EXISTS assignment_files_file_idx ON public.assignment_files(file_id);
ALTER TABLE public.assignment_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS assignment_files_select_member ON public.assignment_files;
CREATE POLICY assignment_files_select_member ON public.assignment_files
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.assignments a WHERE a.id=assignment_id AND public.is_class_member(a.class_id)));
DROP POLICY IF EXISTS assignment_files_insert_leadership ON public.assignment_files;
CREATE POLICY assignment_files_insert_leadership ON public.assignment_files
FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.assignments a WHERE a.id=assignment_id AND public.is_class_leadership(a.class_id)));
DROP POLICY IF EXISTS assignment_files_delete_leadership ON public.assignment_files;
CREATE POLICY assignment_files_delete_leadership ON public.assignment_files
FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.assignments a WHERE a.id=assignment_id AND public.is_class_leadership(a.class_id)));

DROP POLICY IF EXISTS assignments_insert_member ON public.assignments;
CREATE POLICY assignments_insert_leadership ON public.assignments
FOR INSERT TO authenticated
WITH CHECK (created_by=auth.uid() AND public.is_class_leadership(class_id));

-- ============================================================
-- 2. Announcements: read state + pin/archive
-- ============================================================
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;
CREATE INDEX IF NOT EXISTS announcements_class_pin_idx
  ON public.announcements(class_id, pinned DESC, published_at DESC)
  WHERE deleted_at IS NULL AND archived_at IS NULL;

DROP POLICY IF EXISTS announcements_update_admin ON public.announcements;
CREATE POLICY announcements_update_secretary ON public.announcements
FOR UPDATE TO authenticated
USING (public.can_manage_secretary_features(class_id))
WITH CHECK (public.can_manage_secretary_features(class_id));
DROP POLICY IF EXISTS announcements_delete_admin ON public.announcements;
CREATE POLICY announcements_delete_secretary ON public.announcements
FOR DELETE TO authenticated
USING (public.can_manage_secretary_features(class_id));
DROP POLICY IF EXISTS announcements_insert_admin ON public.announcements;
CREATE POLICY announcements_insert_secretary ON public.announcements
FOR INSERT TO authenticated
WITH CHECK (created_by=auth.uid() AND public.can_manage_secretary_features(class_id));

-- Keep announcement reads private to the current user.
DROP POLICY IF EXISTS announcement_reads_insert_own ON public.announcement_reads;
CREATE POLICY announcement_reads_insert_own ON public.announcement_reads
FOR INSERT TO authenticated
WITH CHECK (user_id=auth.uid() AND EXISTS (
  SELECT 1 FROM public.announcements a WHERE a.id=announcement_id AND public.is_class_member(a.class_id)
));
DROP POLICY IF EXISTS announcement_reads_update_own ON public.announcement_reads;
CREATE POLICY announcement_reads_update_own ON public.announcement_reads
FOR UPDATE TO authenticated
USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid());

-- ============================================================
-- 3. Forum reports and pin authority
-- ============================================================
CREATE TABLE IF NOT EXISTS public.forum_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES public.forum_topics(id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (char_length(trim(reason)) BETWEEN 3 AND 500),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewed','dismissed')),
  review_note text,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (post_id IS NULL OR EXISTS (SELECT 1 FROM public.forum_posts fp WHERE fp.id=post_id AND fp.topic_id=forum_reports.topic_id))
);
CREATE INDEX IF NOT EXISTS forum_reports_topic_idx ON public.forum_reports(topic_id, created_at DESC);
CREATE INDEX IF NOT EXISTS forum_reports_status_idx ON public.forum_reports(status, created_at DESC);
CREATE TRIGGER forum_reports_set_updated_at
BEFORE UPDATE ON public.forum_reports
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.forum_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS forum_reports_insert_member ON public.forum_reports;
CREATE POLICY forum_reports_insert_member ON public.forum_reports
FOR INSERT TO authenticated
WITH CHECK (
  reporter_id=auth.uid()
  AND EXISTS (SELECT 1 FROM public.forum_topics t WHERE t.id=topic_id AND public.is_class_member(t.class_id))
);
DROP POLICY IF EXISTS forum_reports_select_own_or_leadership ON public.forum_reports;
CREATE POLICY forum_reports_select_own_or_leadership ON public.forum_reports
FOR SELECT TO authenticated
USING (
  reporter_id=auth.uid()
  OR EXISTS (SELECT 1 FROM public.forum_topics t WHERE t.id=topic_id AND public.is_class_leadership(t.class_id))
);
DROP POLICY IF EXISTS forum_reports_update_leadership ON public.forum_reports;
CREATE POLICY forum_reports_update_leadership ON public.forum_reports
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.forum_topics t WHERE t.id=topic_id AND public.is_class_leadership(t.class_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.forum_topics t WHERE t.id=topic_id AND public.is_class_leadership(t.class_id)));

CREATE OR REPLACE FUNCTION public.guard_forum_topic_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.pinned IS DISTINCT FROM OLD.pinned
     AND NOT public.can_manage_secretary_features(OLD.class_id) THEN
    RAISE EXCEPTION 'FORUM_PIN_PERMISSION_DENIED' USING errcode='42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_forum_topic_update ON public.forum_topics;
CREATE TRIGGER trg_guard_forum_topic_update
BEFORE UPDATE ON public.forum_topics
FOR EACH ROW EXECUTE FUNCTION public.guard_forum_topic_update();

-- ============================================================
-- 4. Groups: current leader gets full group member/task management.
-- ============================================================
CREATE OR REPLACE FUNCTION public.can_manage_group(p_group_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,private
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id=p_group_id AND g.deleted_at IS NULL
      AND (public.is_class_leadership(g.class_id) OR g.leader_user_id=auth.uid())
  );
$$;
REVOKE ALL ON FUNCTION public.can_manage_group(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_group(uuid) TO authenticated;

ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS leader_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS group_members_insert_admin ON public.group_members;
CREATE POLICY group_members_insert_manager ON public.group_members
FOR INSERT TO authenticated
WITH CHECK (public.can_manage_group(group_id));
DROP POLICY IF EXISTS group_members_delete_admin ON public.group_members;
CREATE POLICY group_members_delete_manager ON public.group_members
FOR DELETE TO authenticated
USING (public.can_manage_group(group_id));
DROP POLICY IF EXISTS group_tasks_insert_admin ON public.group_tasks;
CREATE POLICY group_tasks_insert_manager ON public.group_tasks
FOR INSERT TO authenticated
WITH CHECK (public.can_manage_group(group_id));
DROP POLICY IF EXISTS group_tasks_update_admin ON public.group_tasks;
CREATE POLICY group_tasks_update_manager ON public.group_tasks
FOR UPDATE TO authenticated
USING (public.can_manage_group(group_id))
WITH CHECK (public.can_manage_group(group_id));
DROP POLICY IF EXISTS group_tasks_delete_admin ON public.group_tasks;
CREATE POLICY group_tasks_delete_manager ON public.group_tasks
FOR DELETE TO authenticated
USING (public.can_manage_group(group_id));

-- A group leader must always be a current group member.
CREATE OR REPLACE FUNCTION public.validate_group_leader_membership()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.leader_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.group_members gm WHERE gm.group_id=NEW.id AND gm.user_id=NEW.leader_user_id
  ) THEN
    RAISE EXCEPTION 'GROUP_LEADER_MUST_BE_GROUP_MEMBER' USING errcode='23514';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_validate_group_leader_membership ON public.groups;
CREATE TRIGGER trg_validate_group_leader_membership
BEFORE UPDATE OF leader_user_id ON public.groups
FOR EACH ROW EXECUTE FUNCTION public.validate_group_leader_membership();

-- ============================================================
-- 5. Cash: proof verification + void/correction + authoritative balance.
-- ============================================================
ALTER TABLE public.cash_transactions
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS void_reason text,
  ADD COLUMN IF NOT EXISTS reversal_of_transaction_id uuid REFERENCES public.cash_transactions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS correction_reason text;
ALTER TABLE public.cash_payments
  ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text;
CREATE INDEX IF NOT EXISTS cash_transactions_active_idx ON public.cash_transactions(cash_account_id, transaction_date DESC) WHERE deleted_at IS NULL AND voided_at IS NULL;

DROP POLICY IF EXISTS cash_transactions_insert_admin ON public.cash_transactions;
DROP POLICY IF EXISTS cash_transactions_update_admin ON public.cash_transactions;
DROP POLICY IF EXISTS cash_transactions_delete_admin ON public.cash_transactions;
CREATE POLICY cash_transactions_insert_manager ON public.cash_transactions
FOR INSERT TO authenticated
WITH CHECK (created_by=auth.uid() AND public.can_manage_cash((SELECT class_id FROM public.cash_accounts ca WHERE ca.id=cash_account_id)));
CREATE POLICY cash_transactions_update_manager ON public.cash_transactions
FOR UPDATE TO authenticated
USING (public.can_manage_cash((SELECT class_id FROM public.cash_accounts ca WHERE ca.id=cash_account_id)))
WITH CHECK (public.can_manage_cash((SELECT class_id FROM public.cash_accounts ca WHERE ca.id=cash_account_id)));
CREATE POLICY cash_transactions_delete_manager ON public.cash_transactions
FOR DELETE TO authenticated
USING (false);

DROP POLICY IF EXISTS cash_payments_update_own_or_admin ON public.cash_payments;
CREATE POLICY cash_payments_update_self_or_manager ON public.cash_payments
FOR UPDATE TO authenticated
USING (
  user_id=auth.uid()
  OR EXISTS (SELECT 1 FROM public.cash_dues d WHERE d.id=due_id AND public.can_manage_cash(d.class_id))
)
WITH CHECK (
  user_id=auth.uid()
  OR EXISTS (SELECT 1 FROM public.cash_dues d WHERE d.id=due_id AND public.can_manage_cash(d.class_id))
);

CREATE OR REPLACE FUNCTION public.get_cash_summary(p_class_id uuid)
RETURNS TABLE(total_income numeric,total_expense numeric,balance numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,private
AS $$
  SELECT
    COALESCE(SUM(CASE WHEN ct.transaction_type='income' THEN ct.amount ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN ct.transaction_type='expense' THEN ct.amount ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN ct.transaction_type='income' THEN ct.amount ELSE -ct.amount END),0)
  FROM public.cash_transactions ct
  JOIN public.cash_accounts ca ON ca.id=ct.cash_account_id
  WHERE ca.class_id=p_class_id
    AND ct.deleted_at IS NULL
    AND ct.voided_at IS NULL
    AND public.is_class_member(p_class_id);
$$;
REVOKE ALL ON FUNCTION public.get_cash_summary(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_cash_summary(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.void_cash_transaction(p_transaction_id uuid,p_reason text)
RETURNS public.cash_transactions
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private
AS $$
DECLARE v_row public.cash_transactions;
BEGIN
  SELECT ct.* INTO v_row
  FROM public.cash_transactions ct
  JOIN public.cash_accounts ca ON ca.id=ct.cash_account_id
  WHERE ct.id=p_transaction_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'CASH_TRANSACTION_NOT_FOUND'; END IF;
  IF NOT public.can_manage_cash((SELECT class_id FROM public.cash_accounts WHERE id=v_row.cash_account_id)) THEN
    RAISE EXCEPTION 'CASH_MANAGER_REQUIRED' USING errcode='42501';
  END IF;
  IF v_row.voided_at IS NOT NULL THEN RAISE EXCEPTION 'CASH_TRANSACTION_ALREADY_VOIDED'; END IF;
  IF char_length(trim(coalesce(p_reason,''))) < 3 THEN RAISE EXCEPTION 'VOID_REASON_REQUIRED'; END IF;
  UPDATE public.cash_transactions
  SET voided_at=now(),voided_by=auth.uid(),void_reason=trim(p_reason),updated_at=now()
  WHERE id=p_transaction_id
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.void_cash_transaction(uuid,text) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.void_cash_transaction(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.correct_cash_transaction(
  p_transaction_id uuid,
  p_type public.cash_transaction_type,
  p_amount numeric,
  p_category text,
  p_description text,
  p_transaction_date date,
  p_reason text
)
RETURNS public.cash_transactions
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private
AS $$
DECLARE v_old public.cash_transactions; v_new public.cash_transactions;
BEGIN
  SELECT ct.* INTO v_old FROM public.cash_transactions ct WHERE ct.id=p_transaction_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'CASH_TRANSACTION_NOT_FOUND'; END IF;
  IF NOT public.can_manage_cash((SELECT class_id FROM public.cash_accounts WHERE id=v_old.cash_account_id)) THEN
    RAISE EXCEPTION 'CASH_MANAGER_REQUIRED' USING errcode='42501';
  END IF;
  IF v_old.voided_at IS NOT NULL THEN RAISE EXCEPTION 'CASH_TRANSACTION_ALREADY_VOIDED'; END IF;
  IF p_amount <= 0 OR char_length(trim(coalesce(p_reason,''))) < 3 THEN RAISE EXCEPTION 'INVALID_CORRECTION'; END IF;
  UPDATE public.cash_transactions
  SET voided_at=now(),voided_by=auth.uid(),void_reason='Corrected: '||trim(p_reason),updated_at=now()
  WHERE id=p_transaction_id;
  INSERT INTO public.cash_transactions(cash_account_id,created_by,transaction_type,amount,category,description,transaction_date,reversal_of_transaction_id,correction_reason)
  VALUES(v_old.cash_account_id,auth.uid(),p_type,p_amount,trim(p_category),p_description,p_transaction_date,v_old.id,trim(p_reason))
  RETURNING * INTO v_new;
  RETURN v_new;
END;
$$;
REVOKE ALL ON FUNCTION public.correct_cash_transaction(uuid,public.cash_transaction_type,numeric,text,text,date,text) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.correct_cash_transaction(uuid,public.cash_transaction_type,numeric,text,text,date,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.verify_cash_payment(
  p_payment_id uuid,
  p_status public.cash_payment_status,
  p_rejection_reason text DEFAULT NULL
)
RETURNS public.cash_payments
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private
AS $$
DECLARE v public.cash_payments; v_class_id uuid;
BEGIN
  SELECT cp.* INTO v FROM public.cash_payments cp WHERE cp.id=p_payment_id AND cp.deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'CASH_PAYMENT_NOT_FOUND'; END IF;
  SELECT d.class_id INTO v_class_id FROM public.cash_dues d WHERE d.id=v.due_id;
  IF NOT public.can_manage_cash(v_class_id) THEN RAISE EXCEPTION 'CASH_MANAGER_REQUIRED' USING errcode='42501'; END IF;
  IF p_status='rejected' AND char_length(trim(coalesce(p_rejection_reason,''))) < 3 THEN RAISE EXCEPTION 'REJECTION_REASON_REQUIRED'; END IF;
  UPDATE public.cash_payments
  SET status=p_status,
      paid_at=CASE WHEN p_status='paid' THEN COALESCE(paid_at,now()) ELSE NULL END,
      verified_by=auth.uid(),verified_at=now(),rejection_reason=nullif(trim(p_rejection_reason),''),updated_at=now()
  WHERE id=p_payment_id
  RETURNING * INTO v;
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.verify_cash_payment(uuid,public.cash_payment_status,text) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.verify_cash_payment(uuid,public.cash_payment_status,text) TO authenticated;

-- ============================================================
-- 6. Documentation CRUD
-- ============================================================
DROP POLICY IF EXISTS albums_insert_member ON public.albums;
DROP POLICY IF EXISTS albums_update_creator_admin ON public.albums;
DROP POLICY IF EXISTS albums_delete_creator_admin ON public.albums;
CREATE POLICY albums_insert_manager ON public.albums FOR INSERT TO authenticated
WITH CHECK (created_by=auth.uid() AND public.can_manage_documentation(class_id));
CREATE POLICY albums_update_manager ON public.albums FOR UPDATE TO authenticated
USING (public.can_manage_documentation(class_id)) WITH CHECK (public.can_manage_documentation(class_id));
CREATE POLICY albums_delete_manager ON public.albums FOR DELETE TO authenticated
USING (public.can_manage_documentation(class_id));

DROP POLICY IF EXISTS photos_insert_member ON public.photos;
DROP POLICY IF EXISTS photos_update_creator_admin ON public.photos;
DROP POLICY IF EXISTS photos_delete_creator_admin ON public.photos;
CREATE POLICY photos_insert_class_member ON public.photos FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by=auth.uid()
  AND EXISTS (SELECT 1 FROM public.albums a WHERE a.id=album_id AND public.is_class_member(a.class_id))
);
CREATE POLICY photos_update_uploader_or_manager ON public.photos FOR UPDATE TO authenticated
USING (
  uploaded_by=auth.uid()
  OR EXISTS (SELECT 1 FROM public.albums a WHERE a.id=album_id AND public.can_manage_documentation(a.class_id))
)
WITH CHECK (
  uploaded_by=auth.uid()
  OR EXISTS (SELECT 1 FROM public.albums a WHERE a.id=album_id AND public.can_manage_documentation(a.class_id))
);
CREATE POLICY photos_delete_uploader_or_manager ON public.photos FOR DELETE TO authenticated
USING (
  uploaded_by=auth.uid()
  OR EXISTS (SELECT 1 FROM public.albums a WHERE a.id=album_id AND public.can_manage_documentation(a.class_id))
);

-- ============================================================
-- 7. Secretary administration notes / minutes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.class_admin_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 1 AND 200),
  category text NOT NULL DEFAULT 'notulen' CHECK (category IN ('notulen','agenda','keputusan','administratif')),
  note_date date NOT NULL DEFAULT current_date,
  content text NOT NULL DEFAULT '',
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS class_admin_notes_class_date_idx ON public.class_admin_notes(class_id,note_date DESC,updated_at DESC) WHERE deleted_at IS NULL;
CREATE TRIGGER class_admin_notes_set_updated_at
BEFORE UPDATE ON public.class_admin_notes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.class_admin_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY class_admin_notes_select_member ON public.class_admin_notes
FOR SELECT TO authenticated USING (public.is_class_member(class_id) AND deleted_at IS NULL);
CREATE POLICY class_admin_notes_insert_secretary ON public.class_admin_notes
FOR INSERT TO authenticated WITH CHECK (created_by=auth.uid() AND public.can_manage_secretary_features(class_id));
CREATE POLICY class_admin_notes_update_secretary ON public.class_admin_notes
FOR UPDATE TO authenticated USING (public.can_manage_secretary_features(class_id)) WITH CHECK (public.can_manage_secretary_features(class_id));
CREATE POLICY class_admin_notes_delete_secretary ON public.class_admin_notes
FOR DELETE TO authenticated USING (public.can_manage_secretary_features(class_id));

-- ============================================================
-- 8. Performance: count relations instead of client-side N+1 loops.
-- ============================================================
CREATE INDEX IF NOT EXISTS forum_posts_topic_active_idx ON public.forum_posts(topic_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS poll_votes_poll_idx ON public.poll_votes(poll_id);
CREATE INDEX IF NOT EXISTS announcement_reads_ann_user_idx ON public.announcement_reads(announcement_id,user_id);
