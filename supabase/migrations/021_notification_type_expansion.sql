-- Student Hub v1.6.0 — notification type coverage.
-- Extends the notification enum so schedule/material/documentation pushes
-- can be stored safely in the same notification center.

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'schedule';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'material';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'documentation';
