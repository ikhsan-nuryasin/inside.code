# Monthly Class Cash — v1.7.0

The Kas Kelas module now presents accounting by month without changing historical transaction records.

## UI
- Month picker and previous/next navigation.
- Opening balance.
- Monthly income.
- Monthly expense.
- Closing balance.
- Monthly transaction count and ledger.
- Monthly dues and payment statuses.

## Calculation
Opening balance = all non-void, non-deleted transactions before the selected month.
Closing balance = opening balance + monthly income - monthly expense.

Run `supabase/migrations/025_cash_monthly_summary.sql` before using production monthly summaries.
