export type UUID = string;
export type Role = 'member' | 'admin';
export type ClassPosition = 'ketua' | 'wakil_ketua' | 'sekretaris' | 'bendahara';
export type ClassDeliveryMode = 'offline' | 'online';
export type MemberStatus = 'active' | 'invited' | 'left' | 'removed';
export type Priority = 'low' | 'normal' | 'high' | 'urgent';
export type ProgressStatus = 'not_started' | 'in_progress' | 'completed';

export interface Profile { id: UUID; full_name: string; nim: string | null; major: string | null; semester: number | null; avatar_path: string | null; }
export interface ClassRecord { id: UUID; name: string; class_code: string; delivery_mode: ClassDeliveryMode; study_program: string | null; semester: number | null; academic_year: string | null; description: string | null; cover_path: string | null; role?: Role; member_count?: number; }
export interface ClassMember { id: UUID; class_id: UUID; user_id: UUID; role: Role; status: MemberStatus; joined_at: string; full_name?: string; nim?: string | null; }
export interface Subject { id: UUID; class_id: UUID; name: string; code: string | null; lecturer_code: string | null; lecturer_code_secondary: string | null; credits: number | null; practical_group: string | null; description?: string | null; }
export interface Schedule { id: UUID; subject_id: UUID; day_of_week: number; starts_at: string; ends_at: string; room: string | null; location: string | null; meeting_url: string | null; notes: string | null; subject?: Subject; class_name?: string; class_id?: UUID; }
export interface Assignment { id: UUID; class_id: UUID; subject_id: UUID | null; title: string; description: string | null; deadline: string | null; priority: Priority; created_by: UUID; progress_status?: ProgressStatus; class_name?: string; subject_name?: string; }
export interface ChecklistItem { id: UUID; assignment_id: UUID; title: string; sort_order: number; }
export interface ChecklistProgress { checklist_item_id: UUID; user_id: UUID; completed: boolean; updated_at: string; }
export interface Material { id: UUID; class_id: UUID; subject_id: UUID | null; title: string; description: string | null; material_type: string; external_url: string | null; created_at: string; updated_at?: string; }
export interface MaterialFile { material_id: UUID; file_id: UUID; sort_order: number; file?: FileRecord; }
export interface AssignmentFile { assignment_id: UUID; file_id: UUID; sort_order: number; file?: FileRecord; }
export interface FileRecord { id: UUID; uploaded_by: UUID; owner_scope: 'profile' | 'class'; class_id: UUID | null; bucket: string; storage_path: string; file_name: string; mime_type: string; file_size: number; checksum: string | null; metadata: Record<string, unknown>; created_at: string; deleted_at?: string | null; }
export interface PersonalNote { id: UUID; user_id: UUID; class_id: UUID | null; title: string; content: string; pinned: boolean; updated_at: string; }
export interface SharedNote { id: UUID; class_id: UUID; created_by: UUID; title: string; content: string; version: number; updated_at: string; }
export interface AdminNote { id: UUID; class_id: UUID; created_by: UUID; title: string; category: 'notulen'|'agenda'|'keputusan'|'administratif'; note_date: string; content: string; pinned: boolean; created_at: string; updated_at: string; }
export interface Announcement { id: UUID; class_id: UUID; created_by?: UUID; title: string; content: string; priority: number; published_at: string; pinned?: boolean; archived_at?: string | null; is_read?: boolean; }
export interface ForumTopic { id: UUID; class_id: UUID; created_by: UUID; title: string; category: string; pinned: boolean; created_at: string; updated_at?: string; creator_name?: string; post_count?: number; }
export interface ForumPost { id: UUID; topic_id: UUID; user_id: UUID; parent_id: UUID | null; content: string; created_at: string; updated_at?: string; author_name?: string; }
export interface ForumReport { id: UUID; topic_id: UUID; post_id: UUID | null; reporter_id: UUID; reason: string; status: 'open'|'reviewed'|'dismissed'; review_note: string | null; reviewed_by: UUID | null; reviewed_at: string | null; created_at: string; }
export interface GroupRecord { id: UUID; class_id: UUID; name: string; description: string | null; created_by: UUID; leader_user_id?: UUID | null; leader_name?: string | null; created_at?: string; }
export interface GroupMember { id: UUID; group_id: UUID; user_id: UUID; full_name?: string; nim?: string | null; }
export interface GroupTask { id: UUID; group_id: UUID; title: string; description: string | null; assigned_to: UUID | null; completed: boolean; deadline: string | null; }
export interface Poll { id: UUID; class_id: UUID; created_by: UUID; title: string; description: string | null; closes_at: string | null; is_anonymous: boolean; is_decision: boolean; closed: boolean; created_at: string; }
export interface PollOption { id: UUID; poll_id: UUID; label: string; sort_order: number; votes?: number; }
export interface PollVote { id: UUID; poll_id: UUID; poll_option_id: UUID; user_id: UUID; created_at: string; }
export interface CashAccount { id: UUID; class_id: UUID; }
export interface CashTransaction { id: UUID; cash_account_id: UUID; created_by: UUID; transaction_type: 'income' | 'expense'; amount: number; category: string; description: string | null; proof_file_id?: UUID | null; transaction_date: string; voided_at?: string | null; void_reason?: string | null; reversal_of_transaction_id?: UUID | null; correction_reason?: string | null; }
export interface CashSummary { total_income: number; total_expense: number; balance: number; }
export interface CashMonthlySummary { opening_balance: number; total_income: number; total_expense: number; net_change: number; closing_balance: number; transaction_count: number; month_start: string; }
export interface CashDue { id: UUID; class_id: UUID; title: string; amount: number; due_date: string | null; created_by: UUID; }
export interface CashPayment { id: UUID; due_id: UUID; user_id: UUID; amount: number; status: 'pending'|'paid'|'rejected'|'partial'; proof_file_id: UUID | null; paid_at: string | null; verified_by?: UUID | null; verified_at?: string | null; rejection_reason?: string | null; cash_transaction_id?: UUID | null; }
export interface Album { id: UUID; class_id: UUID; created_by: UUID; title: string; description: string | null; created_at: string; updated_at?: string; }
export interface Photo { id: UUID; album_id: UUID; file_id: UUID; uploaded_by: UUID; caption: string | null; created_at: string; }
export interface Notification { id: UUID; user_id: UUID; notification_type: string; title: string; body: string; data?: Record<string, unknown>; is_read: boolean; created_at: string; }
export interface SearchResult { id: UUID; title: string; excerpt: string; type: 'class'|'task'|'material'|'announcement'|'forum'|'note'; classId?: UUID; className?: string; href: string; }

export interface RandomizerHistoryRecord { id: UUID; class_id: UUID; created_by: UUID; mode: 'group_leader'|'presentation_order'|'member_random'; title: string; entries: string[]; created_at: string; }
export type ClassEventType = 'class'|'presentation'|'exam'|'meeting'|'task_deadline'|'other';
export interface ClassEvent { id: UUID; class_id: UUID; created_by: UUID; event_type: ClassEventType; title: string; description: string | null; starts_at: string; ends_at: string | null; location: string | null; meeting_url: string | null; pinned: boolean; created_at: string; updated_at: string; class_name?: string; }
export interface ActivityLog { id: UUID; user_id: UUID | null; class_id: UUID | null; action: string; entity_type: string | null; entity_id: UUID | null; metadata: Record<string, unknown>; created_at: string; }
export interface SyncQueueItem { operationId: UUID; userId: UUID; table: string; entityId: UUID; operation: 'insert' | 'upsert' | 'update' | 'delete'; payload: Record<string, unknown>; status: 'pending' | 'failed' | 'conflict'; attempts: number; lastError?: string; createdAt: number; updatedAt: number; }
export interface SyncEvent { cursor: number; table_name: string; entity_id: UUID | null; changed_at: string; }
export interface ClassPositionRecord { id: UUID; class_id: UUID; user_id: UUID; position: ClassPosition; assigned_by: UUID; created_at: string; updated_at: string; full_name?: string; nim?: string | null; }


export type BugReportCategory = 'ui' | 'feature' | 'performance' | 'offline_sync' | 'account' | 'other';
export type BugSeverity = 'low' | 'medium' | 'high' | 'critical';
export type BugReportStatus = 'open' | 'reviewing' | 'resolved' | 'closed';
export interface BugReport {
  id: UUID;
  user_id: UUID;
  title: string;
  category: BugReportCategory;
  severity: BugSeverity;
  description: string;
  steps: string | null;
  expected_behavior: string | null;
  actual_behavior: string | null;
  page_path: string | null;
  user_agent: string | null;
  status: BugReportStatus;
  created_at: string;
  updated_at: string;
}
