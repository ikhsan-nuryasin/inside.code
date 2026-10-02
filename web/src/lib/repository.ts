import { requireSupabase, supabase } from './supabase';
import {
  cacheGet, cacheSet, cacheRemoveByPrefixes, metaGet, metaSet, queueAll, queuePush, queueRemove,
  localFileGet, localFileSet, localFileRemove, broadcastSyncEvent,
} from './offline';
import { semester3ScheduleTemplate } from './schedule-template';

import type {
  AdminNote, Album, Announcement, Assignment, CashAccount, CashDue, CashPayment, CashSummary,
  CashTransaction, CashMonthlySummary, ChecklistItem, ChecklistProgress, ClassMember, ClassRecord, ClassPosition, ClassPositionRecord,
  AssignmentFile, FileRecord, ForumPost, ForumReport, ForumTopic, GroupMember, GroupRecord, GroupTask, Material, MaterialFile,
  Notification, PersonalNote, Photo, Poll, PollOption, Profile, Schedule, SearchResult, SharedNote, Subject,
  SyncEvent, SyncQueueItem, RandomizerHistoryRecord, ClassEvent, ClassEventType, ActivityLog, BugReport, BugReportCategory, BugSeverity,
} from '../types/models';

const now = () => new Date().toISOString();
export const localDateISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const uuid = () => crypto.randomUUID();
const empty = <T,>(value: T | null | undefined) => value as T;

const CACHE_INVALIDATION_PREFIXES: Record<string, string[]> = {
  classes: ['classes:'],
  class_members: ['members:'],
  class_positions: ['positions:'],
  subjects: ['subjects:', 'schedules:', 'schedule:all'],
  schedules: ['schedules:', 'schedule:all'],
  class_events: ['class-events:'],
  assignments: ['assignments:', 'checklist:'],
  assignment_checklist_items: ['checklist:'],
  assignment_progress: ['assignments:'],
  assignment_files: ['assignments:', 'files:'],
  materials: ['materials:'],
  material_files: ['materials:', 'files:'],
  announcements: ['announcements:', 'notifications:'],
  announcement_reads: ['announcements:'],
  forum_topics: ['forum:'],
  forum_posts: ['forum:'],
  forum_reports: ['forum:'],
  groups: ['groups:', 'group-members:', 'group-tasks:'],
  group_members: ['groups:', 'group-members:'],
  group_tasks: ['groups:', 'group-tasks:'],
  polls: ['polls:'],
  poll_options: ['polls:'],
  poll_votes: ['polls:'],
  cash_accounts: ['cash-'],
  cash_transactions: ['cash-'],
  cash_dues: ['cash-'],
  cash_payments: ['cash-'],
  files: ['files:', 'materials:', 'assignments:'],
  albums: ['albums:'],
  photos: ['albums:'],
  shared_notes: ['shared-notes:'],
  class_admin_notes: ['admin-notes:'],
  personal_notes: ['notes:'],
  notifications: ['notifications:'],
  bug_reports: ['bug-reports:'],
  randomizer_results: ['randomizer-history:'],
  activity_logs: [],
};

async function invalidateCachesForTable(table: string) {
  const prefixes = CACHE_INVALIDATION_PREFIXES[table] ?? [];
  if (prefixes.length) await cacheRemoveByPrefixes(prefixes);
}

/** Invalidate only cache entries that belong to one class. Used after class-scoped mutations. */
export async function invalidateClassCache(classId: string) {
  if (!classId) return;
  const exactPrefixes = [
    `members:${classId}`, `subjects:${classId}`, `schedules:${classId}`, `class-events:${classId}`,
    `assignments:${classId}:`, `materials:${classId}`, `announcements:${classId}:`, `forum:topics:${classId}`,
    `groups:${classId}`, `polls:${classId}`, `files:${classId}`, `albums:${classId}`,
    `shared-notes:${classId}`, `admin-notes:${classId}`, `cash-dues:${classId}`, `cash-dues-payments:${classId}`,
    `class-events:all:`, `assignments:all:`, `schedule:all`, `group-members:`, `group-tasks:`,
  ];
  await cacheRemoveByPrefixes(exactPrefixes);
}

function isRetryableNetworkError(error: unknown): boolean {
  if (!navigator.onLine) return true;
  if (error instanceof TypeError) return /fetch|network|load|timeout/i.test(error.message);
  const value = error as { status?: number; code?: string; message?: string } | null;
  if (value && typeof value.status === 'number') return value.status >= 500 || value.status === 408 || value.status === 429;
  const code = String(value?.code ?? '');
  const message = String(value?.message ?? error ?? '');
  return code === 'NETWORK_ERROR' || /failed to fetch|network request failed|networkerror|timeout/i.test(message);
}

async function queueWrite(table: string, entityId: string, payload: Record<string, unknown>, operation: SyncQueueItem['operation'] = 'upsert', error?: unknown) {
  const userId = await currentUserId();
  if (!userId) throw new Error('UNAUTHENTICATED');
  return queuePush({
    operationId: uuid(), userId, table, entityId, operation, payload, status: 'pending', attempts: 0,
    createdAt: Date.now(), updatedAt: Date.now(), lastError: error instanceof Error ? error.message : String(error ?? ''),
  });
}

function splitQueuedPayload(payload: Record<string, unknown>) {
  const match = payload.__match as Record<string, unknown> | undefined;
  const { __match: _ignored, ...dbPayload } = payload as Record<string, unknown> & { __match?: Record<string, unknown> };
  return { match, dbPayload };
}

function applyQueuedMatch(query: any, match: Record<string, unknown> | undefined, entityId: string) {
  if (match && Object.keys(match).length) {
    let scoped = query;
    for (const [key, value] of Object.entries(match)) scoped = value === null ? scoped.is(key, null) : scoped.eq(key, value);
    return scoped;
  }
  return query.eq('id', entityId);
}

async function mergeCachedList<T extends { id: string }>(key: string, item: T) {
  const current = (await cacheGet<T[]>(key)) ?? [];
  const merged = [item, ...current.filter(x => x.id !== item.id)];
  await cacheSet(key, merged);
  return merged;
}

async function removeCachedListItem<T extends { id: string }>(key: string, id: string) {
  const current = (await cacheGet<T[]>(key)) ?? [];
  await cacheSet(key, current.filter(x => x.id !== id));
}

async function cachedList<T>(key: string, loader: () => Promise<T[]>): Promise<T[]> {
  const cached = await cacheGet<T[]>(key);
  if (cached) {
    void loader().then(rows => cacheSet(key, rows)).catch(() => {});
    return cached;
  }
  const rows = await loader();
  await cacheSet(key, rows);
  return rows;
}

async function tryMutation<T>(
  row: Record<string, unknown>,
  table: string,
  operation: SyncQueueItem['operation'],
  request: () => Promise<T>,
  optimistic: () => Promise<void> = async () => {},
): Promise<T> {
  try {
    const result = await request();
    await invalidateCachesForTable(table);
    return result;
  } catch (error) {
    if (!isRetryableNetworkError(error)) throw error;
    await queueWrite(table, String(row.id ?? uuid()), row, operation, error);
    await optimistic();
    return row as T;
  }
}

export async function currentUserId(): Promise<string | null> {

  const { data } = await requireSupabase().auth.getSession();
  return data.session?.user.id ?? null;
}

export async function getProfile(): Promise<Profile | null> {

  const uid = await currentUserId(); if (!uid) return null;
  return cachedList(`profile:${uid}`, async () => {
    const { data, error } = await requireSupabase().from('profiles').select('id,full_name,nim,major,semester,avatar_path').eq('id', uid).maybeSingle();
    if (error) throw error;
    return data ? [data as Profile] : [];
  }).then(rows => rows[0] ?? null);
}

export async function updateProfile(payload: { full_name: string; nim?: string | null; major?: string | null; semester?: number | null }) {
  const uid = await currentUserId(); if (!uid) throw new Error('UNAUTHENTICATED');
  const row = { id: uid, full_name: payload.full_name.trim(), nim: payload.nim?.trim() || null, major: payload.major?.trim() || null, semester: payload.semester ?? null, updated_at: now() };

  return tryMutation(row, 'profiles', 'update', async () => {
    const { data, error } = await requireSupabase().from('profiles').update({ full_name: row.full_name, nim: row.nim, major: row.major, semester: row.semester }).eq('id', uid).select().single();
    if (error) throw error;
    await cacheSet(`profile:${uid}`, data as Profile);
    return data as Profile;
  }, async () => { await cacheSet(`profile:${uid}`, { ...row, avatar_path: null } as Profile); });
}

export async function getClassPosition(classId: string): Promise<ClassPositionRecord | null> {

  const uid = await currentUserId(); if (!uid) return null;
  const { data, error } = await requireSupabase().from('class_positions').select('id,class_id,user_id,position,assigned_by,created_at,updated_at').eq('class_id', classId).eq('user_id', uid).maybeSingle();
  if (error) throw error;
  return data as ClassPositionRecord | null;
}

export async function listClassPositions(classId: string): Promise<ClassPositionRecord[]> {

  const key = `positions:${classId}`;
  return cachedList(key, async () => {
    const { data, error } = await requireSupabase().from('class_positions').select('id,class_id,user_id,position,assigned_by,created_at,updated_at,profiles!inner(full_name,nim)').eq('class_id', classId).order('position');
    if (error) throw error;
    return (data ?? []).map((r: any) => ({ ...r, full_name: r.profiles?.full_name, nim: r.profiles?.nim })) as ClassPositionRecord[];
  });
}

export async function listMyClassPositions(): Promise<ClassPositionRecord[]> {

  const uid = await currentUserId();
  if (!uid) return [];
  return cachedList(`positions:self:${uid}`, async () => {
    const { data, error } = await requireSupabase().from('class_positions').select('id,class_id,user_id,position,assigned_by,created_at,updated_at').eq('user_id', uid).order('updated_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as ClassPositionRecord[];
  });
}

export async function assignClassPosition(classId: string, userId: string, position: ClassPosition) {

  const { data, error } = await requireSupabase().rpc('assign_class_position', { p_class_id: classId, p_user_id: userId, p_position: position });
  if (error) throw error; await invalidateCachesForTable('class_positions'); return data as ClassPositionRecord;
}
export async function removeClassPosition(classId: string, userId: string) {

  const { error } = await requireSupabase().rpc('remove_class_position', { p_class_id: classId, p_user_id: userId }); if (error) throw error; await invalidateCachesForTable('class_positions');
}

export async function listClasses(): Promise<ClassRecord[]> {

  const uid = await currentUserId(); if (!uid) return [];
  return cachedList(`classes:${uid}`, async () => {
    const { data, error } = await requireSupabase().from('class_members').select('class_id,role,classes!inner(id,name,class_code,delivery_mode,study_program,semester,academic_year,description,cover_path,deleted_at)').eq('user_id', uid).eq('status', 'active').is('classes.deleted_at', null);
    if (error) throw error;
    return (data ?? []).map((r: any) => ({ ...r.classes, role: r.role })) as ClassRecord[];
  });
}

export async function updateClass(classId: string, payload: { name: string; deliveryMode: 'offline' | 'online'; studyProgram?: string | null; semester?: number | null; academicYear?: string | null; description?: string | null }) {

  const row = { id: classId, name: payload.name.trim(), delivery_mode: payload.deliveryMode, study_program: payload.studyProgram ?? null, semester: payload.semester ?? null, academic_year: payload.academicYear ?? null, description: payload.description ?? null };
  return tryMutation(row, 'classes', 'update', async () => { const { data, error } = await requireSupabase().from('classes').update({ name: row.name, delivery_mode: row.delivery_mode, study_program: row.study_program, semester: row.semester, academic_year: row.academic_year, description: row.description }).eq('id', classId).select().single(); if (error) throw error; return data as ClassRecord; }, async () => { const uid = await currentUserId(); if (uid) await mergeCachedList(`classes:${uid}`, { ...row, id: classId } as ClassRecord); });
}

export async function listClassMembers(classId: string): Promise<ClassMember[]> {

  return cachedList(`members:${classId}`, async () => {
    const { data, error } = await requireSupabase().from('class_members').select('id,class_id,user_id,role,status,joined_at,profiles!inner(full_name,nim)').eq('class_id', classId).eq('status', 'active').order('joined_at');
    if (error) throw error;
    return (data ?? []).map((r: any) => ({ ...r, full_name: r.profiles?.full_name, nim: r.profiles?.nim })) as ClassMember[];
  });
}
export async function updateMemberRole(classId: string, userId: string, role: 'admin' | 'member') {

  const row = { id: uuid(), class_id: classId, user_id: userId, role, __match: { class_id: classId, user_id: userId } };
  await tryMutation(row, 'class_members', 'update', async () => { const { error } = await requireSupabase().from('class_members').update({ role }).eq('class_id', classId).eq('user_id', userId); if (error) throw error; return undefined; });
}
export async function removeMember(classId: string, userId: string) {

  const row = { id: uuid(), class_id: classId, user_id: userId, status: 'removed', __match: { class_id: classId, user_id: userId } };
  await tryMutation(row, 'class_members', 'update', async () => { const { error } = await requireSupabase().from('class_members').update({ status: 'removed' }).eq('class_id', classId).eq('user_id', userId); if (error) throw error; return undefined; });
}

export async function listSubjects(classId: string): Promise<Subject[]> {

  return cachedList(`subjects:${classId}`, async () => {
    const { data, error } = await requireSupabase().from('subjects').select('id,class_id,name,code,lecturer_code,lecturer_code_secondary,credits,practical_group,description').eq('class_id', classId).is('deleted_at', null).order('name');
    if (error) throw error; return (data ?? []) as Subject[];
  });
}
export async function insertSubject(classId: string, name: string, code?: string | null, details?: { lecturerCode?: string | null; lecturerCodeSecondary?: string | null; credits?: number | null; practicalGroup?: string | null }) {
  const uid = await currentUserId(); if (!uid) throw new Error('UNAUTHENTICATED');
  const row = { id: uuid(), class_id: classId, name: name.trim(), code: code?.trim() || null, lecturer_code: details?.lecturerCode ?? null, lecturer_code_secondary: details?.lecturerCodeSecondary ?? null, credits: details?.credits ?? null, practical_group: details?.practicalGroup ?? null };

  return tryMutation(row, 'subjects', 'insert', async () => { const { data, error } = await requireSupabase().from('subjects').insert(row).select().single(); if (error) throw error; return data as Subject; });
}
export async function updateSubject(id: string, payload: Partial<Pick<Subject, 'name' | 'code' | 'lecturer_code' | 'lecturer_code_secondary' | 'credits' | 'practical_group' | 'description'>>) {
  const row = { id, ...payload, ...(payload.name !== undefined ? { name: payload.name.trim() } : {}), ...(payload.code !== undefined ? { code: payload.code?.trim() || null } : {}) };

  return tryMutation(row, 'subjects', 'update', async () => { const { data, error } = await requireSupabase().from('subjects').update(payload).eq('id', id).select().single(); if (error) throw error; return data as Subject; });
}
export async function deleteSubject(id: string) {

  const row = { id, deleted_at: now() };
  await tryMutation(row, 'subjects', 'update', async () => { const { error } = await requireSupabase().from('subjects').update({ deleted_at: row.deleted_at }).eq('id', id); if (error) throw error; return undefined; });
}
export async function listSchedules(classId: string): Promise<Schedule[]> {

  const subjects = await listSubjects(classId); if (!subjects.length) return [];
  return cachedList(`schedules:${classId}`, async () => {
    const { data, error } = await requireSupabase().from('schedules').select('id,subject_id,day_of_week,starts_at,ends_at,room,location,meeting_url,notes').in('subject_id', subjects.map(s => s.id)).is('deleted_at', null).order('day_of_week').order('starts_at');
    if (error) throw error;
    return (data ?? []).map((r: any) => ({ ...r, subject: subjects.find(s => s.id === r.subject_id) })) as Schedule[];
  });
}
export async function listCrossClassSchedules(): Promise<Schedule[]> {

  return cachedList('schedule:all', async () => {
    const { data, error } = await requireSupabase().from('schedules').select('id,subject_id,day_of_week,starts_at,ends_at,room,location,meeting_url,notes,subjects!inner(id,class_id,name,code,classes!inner(id,name))').is('deleted_at', null).order('day_of_week').order('starts_at');
    if (error) throw error;
    return (data ?? []).map((r: any) => ({ ...r, subject: r.subjects, class_id: r.subjects?.class_id, class_name: r.subjects?.classes?.name })) as Schedule[];
  });
}
export async function insertSchedule(subjectId: string, payload: { day: number; start: string; end: string; room?: string; location?: string; meetingUrl?: string; notes?: string }) {
  const row = { id: uuid(), subject_id: subjectId, day_of_week: payload.day, starts_at: payload.start, ends_at: payload.end, room: payload.room || null, location: payload.location || null, meeting_url: payload.meetingUrl || null, notes: payload.notes || null };

  return tryMutation(row, 'schedules', 'insert', async () => { const { data, error } = await requireSupabase().from('schedules').insert(row).select().single(); if (error) throw error; return data as Schedule; });
}
export async function updateSchedule(id: string, payload: Partial<{ subject_id: string; day_of_week: number; starts_at: string; ends_at: string; room: string | null; location: string | null; meeting_url: string | null; notes: string | null }>) {
  const row = { id, ...payload };

  return tryMutation(row, 'schedules', 'update', async () => { const { data, error } = await requireSupabase().from('schedules').update(payload).eq('id', id).select().single(); if (error) throw error; return data as Schedule; });
}
export async function deleteSchedule(id: string) {

  const row = { id, deleted_at: now() };
  await tryMutation(row, 'schedules', 'update', async () => { const { error } = await requireSupabase().from('schedules').update({ deleted_at: row.deleted_at }).eq('id', id); if (error) throw error; return undefined; });
}

export async function listClassEvents(classId: string): Promise<ClassEvent[]> {

  return cachedList(`class-events:${classId}`, async () => {
    const { data, error } = await requireSupabase().from('class_events').select('id,class_id,created_by,event_type,title,description,starts_at,ends_at,location,meeting_url,pinned,created_at,updated_at').eq('class_id', classId).is('deleted_at', null).order('pinned',{ascending:false}).order('starts_at');
    if (error) throw error;
    return (data ?? []) as ClassEvent[];
  });
}


export async function listAllClassEvents(): Promise<ClassEvent[]> {

  const uid = await currentUserId(); if (!uid) return [];
  return cachedList(`class-events:all:${uid}`, async () => {
    const { data, error } = await requireSupabase().from('class_events').select('id,class_id,created_by,event_type,title,description,starts_at,ends_at,location,meeting_url,pinned,created_at,updated_at,classes(name)').is('deleted_at', null).order('starts_at');
    if (error) throw error;
    return (data ?? []).map((r:any)=>({...r,class_name:r.classes?.name})) as ClassEvent[];
  });
}

export async function createClassEvent(classId: string, payload: { eventType: ClassEventType; title: string; description?: string; startsAt: string; endsAt?: string | null; location?: string | null; meetingUrl?: string | null; pinned?: boolean }) {
  const uid = await currentUserId(); if (!uid) throw new Error('UNAUTHENTICATED');
  const row = { id: uuid(), class_id: classId, created_by: uid, event_type: payload.eventType, title: payload.title.trim(), description: payload.description?.trim() || null, starts_at: payload.startsAt, ends_at: payload.endsAt ?? null, location: payload.location?.trim() || null, meeting_url: payload.meetingUrl?.trim() || null, pinned: payload.pinned ?? false };

  return tryMutation(row, 'class_events', 'insert', async () => { const { data, error } = await requireSupabase().from('class_events').insert(row).select().single(); if (error) throw error; return data as ClassEvent; });
}
export async function updateClassEvent(id: string, payload: Partial<Pick<ClassEvent,'event_type'|'title'|'description'|'starts_at'|'ends_at'|'location'|'meeting_url'|'pinned'>>) {
  const row = { id, ...payload, updated_at: now() };

  return tryMutation(row, 'class_events', 'update', async () => { const { data, error } = await requireSupabase().from('class_events').update(payload).eq('id', id).select().single(); if (error) throw error; return data as ClassEvent; });
}
export async function deleteClassEvent(id: string) {
  const row = { id, deleted_at: now() };

  await tryMutation(row, 'class_events', 'update', async () => { const { error } = await requireSupabase().from('class_events').update({ deleted_at: row.deleted_at }).eq('id', id); if (error) throw error; return undefined; });
}

export async function applyScheduleTemplate(classId: string): Promise<number> {

  const { data, error } = await requireSupabase().rpc('apply_schedule_template', { p_class_id: classId }); if (error) throw error; return Number(data ?? 0);
}

export async function listAssignments(classId: string): Promise<Assignment[]> {

  const uid = await currentUserId();
  return cachedList(`assignments:${classId}:${uid}`, async () => {
    const { data, error } = await requireSupabase().from('assignments').select('id,class_id,subject_id,title,description,deadline,priority,created_by,subjects(name)').eq('class_id', classId).is('deleted_at', null).order('deadline', { ascending: true, nullsFirst: false });
    if (error) throw error;
    let rows = (data ?? []).map((r: any) => ({ ...r, subject_name: r.subjects?.name })) as Assignment[];
    if (uid && rows.length) {
      const { data: p, error: pe } = await requireSupabase().from('assignment_progress').select('assignment_id,status').eq('user_id', uid).in('assignment_id', rows.map(x => x.id));
      if (pe) throw pe; const map = new Map((p ?? []).map(x => [x.assignment_id, x.status])); rows = rows.map(x => ({ ...x, progress_status: (map.get(x.id) ?? 'not_started') as Assignment['progress_status'] }));
    }
    return rows;
  });
}
export async function listAllAssignments(): Promise<Assignment[]> {

  const uid = await currentUserId(); if (!uid) return [];
  return cachedList(`assignments:all:${uid}`, async () => {
    const { data, error } = await requireSupabase().from('assignments').select('id,class_id,subject_id,title,description,deadline,priority,created_by,subjects(name,classes(id,name))').is('deleted_at', null).order('deadline', { ascending: true, nullsFirst: false });
    if (error) throw error;
    const base = (data ?? []).map((r: any) => ({ ...r, class_name: r.subjects?.classes?.name, subject_name: r.subjects?.name })) as Assignment[];
    if (!base.length) return base;
    const { data: p, error: pe } = await requireSupabase().from('assignment_progress').select('assignment_id,status').eq('user_id', uid).in('assignment_id', base.map(x => x.id));
    if (pe) throw pe; const map = new Map((p ?? []).map(x => [x.assignment_id, x.status]));
    return base.map(x => ({ ...x, progress_status: (map.get(x.id) ?? 'not_started') as Assignment['progress_status'] }));
  });
}
export async function insertClassTask(classId: string, payload: { title: string; description?: string; deadline?: string | null; priority: Assignment['priority']; subjectId?: string | null }) {
  const uid = await currentUserId(); if (!uid) throw new Error('UNAUTHENTICATED');
  const row = { id: uuid(), class_id: classId, subject_id: payload.subjectId ?? null, created_by: uid, title: payload.title.trim(), description: payload.description?.trim() || null, deadline: payload.deadline ?? null, priority: payload.priority };

  return tryMutation(row, 'assignments', 'insert', async () => { const { data, error } = await requireSupabase().from('assignments').insert(row).select().single(); if (error) throw error; return data as Assignment; });
}
export async function updateAssignment(id: string, payload: Partial<Pick<Assignment, 'title' | 'description' | 'deadline' | 'priority' | 'subject_id'>>) {
  const row = { id, ...payload, updated_at: now() };

  return tryMutation(row, 'assignments', 'update', async () => { const { data, error } = await requireSupabase().from('assignments').update(payload).eq('id', id).select().single(); if (error) throw error; return data as Assignment; });
}
export async function deleteAssignment(id: string) {

  const row = { id, deleted_at: now() };
  await tryMutation(row, 'assignments', 'update', async () => { const { error } = await requireSupabase().from('assignments').update({ deleted_at: row.deleted_at }).eq('id', id); if (error) throw error; return undefined; });
}
export async function listChecklistItems(assignmentId: string): Promise<ChecklistItem[]> {

  return cachedList(`checklist:${assignmentId}`, async () => { const { data, error } = await requireSupabase().from('assignment_checklist_items').select('id,assignment_id,title,sort_order').eq('assignment_id', assignmentId).is('deleted_at', null).order('sort_order'); if (error) throw error; return (data ?? []) as ChecklistItem[]; });
}
export async function saveChecklistItem(assignmentId: string, title: string, sortOrder: number, id?: string) {
  const row = { id: id ?? uuid(), assignment_id: assignmentId, title: title.trim(), sort_order: sortOrder };

  return tryMutation(row, 'assignment_checklist_items', id ? 'update' : 'insert', async () => {
    const q = requireSupabase().from('assignment_checklist_items'); const result = id ? await q.update({ title: row.title, sort_order: row.sort_order }).eq('id', id).select().single() : await q.insert(row).select().single(); if (result.error) throw result.error; return result.data as ChecklistItem;
  });
}
export async function deleteChecklistItem(id: string) {

  const row = { id, deleted_at: now() }; await tryMutation(row, 'assignment_checklist_items', 'update', async () => { const { error } = await requireSupabase().from('assignment_checklist_items').update({ deleted_at: row.deleted_at }).eq('id', id); if (error) throw error; return undefined; });
}
export async function listChecklistProgress(assignmentId: string): Promise<ChecklistProgress[]> {
  const uid = await currentUserId(); if (!uid) return [];

  const items = await listChecklistItems(assignmentId); if (!items.length) return [];
  const { data, error } = await requireSupabase().from('checklist_progress').select('checklist_item_id,user_id,completed,updated_at').eq('user_id', uid).in('checklist_item_id', items.map(x => x.id)); if (error) throw error; return (data ?? []) as ChecklistProgress[];
}
export async function setChecklistProgress(itemId: string, completed: boolean) {
  const uid = await currentUserId(); if (!uid) throw new Error('UNAUTHENTICATED');
  const row = { id: uuid(), checklist_item_id: itemId, user_id: uid, completed, updated_at: now() };

  await tryMutation(row, 'checklist_progress', 'upsert', async () => { const { error } = await requireSupabase().from('checklist_progress').upsert(row, { onConflict: 'checklist_item_id,user_id' }); if (error) throw error; return undefined; });
}
export async function setAssignmentProgress(assignmentId: string, status: NonNullable<Assignment['progress_status']>) {
  const uid = await currentUserId(); if (!uid) throw new Error('UNAUTHENTICATED');

  const row = { id: uuid(), assignment_id: assignmentId, user_id: uid, status, updated_at: now() };
  await tryMutation(row, 'assignment_progress', 'upsert', async () => { const { error } = await requireSupabase().from('assignment_progress').upsert(row, { onConflict: 'assignment_id,user_id' }); if (error) throw error; return undefined; });
}

export async function listAssignmentFiles(assignmentId: string): Promise<AssignmentFile[]> {

  const { data, error } = await requireSupabase().from('assignment_files').select('assignment_id,file_id,sort_order,files(id,uploaded_by,owner_scope,class_id,bucket,storage_path,file_name,mime_type,file_size,checksum,metadata,created_at)').eq('assignment_id', assignmentId).order('sort_order');
  if (error) throw error; return (data ?? []).map((r: any) => ({ assignment_id: r.assignment_id, file_id: r.file_id, sort_order: r.sort_order, file: r.files })) as AssignmentFile[];
}
export async function attachAssignmentFile(assignmentId: string, fileId: string, sortOrder = 0) {
  const row = { assignment_id: assignmentId, file_id: fileId, sort_order: sortOrder };

  const queuedRow = { ...row, __match: { assignment_id: assignmentId, file_id: fileId } }; return tryMutation(queuedRow, 'assignment_files', 'upsert', async () => { const { error } = await requireSupabase().from('assignment_files').upsert(row); if (error) throw error; return row; });
}
export async function detachAssignmentFile(assignmentId: string, fileId: string) {

  const row = { __match: { assignment_id: assignmentId, file_id: fileId } }; await tryMutation({ id: `${assignmentId}:${fileId}`, ...row }, 'assignment_files', 'delete', async () => { const { error } = await requireSupabase().from('assignment_files').delete().eq('assignment_id', assignmentId).eq('file_id', fileId); if (error) throw error; return undefined; });
}

export async function listMaterials(classId: string): Promise<Material[]> {

  return cachedList(`materials:${classId}`, async () => { const { data, error } = await requireSupabase().from('materials').select('id,class_id,subject_id,title,description,material_type,external_url,created_at,updated_at').eq('class_id', classId).is('deleted_at', null).order('created_at', { ascending: false }); if (error) throw error; return (data ?? []) as Material[]; });
}
export async function createMaterial(classId: string, payload: { title: string; description?: string; type: string; subjectId?: string | null; externalUrl?: string | null }) {
  const uid = await currentUserId(); if (!uid) throw new Error('UNAUTHENTICATED');
  const row = { id: uuid(), class_id: classId, subject_id: payload.subjectId ?? null, created_by: uid, title: payload.title.trim(), description: payload.description?.trim() || null, material_type: payload.type, external_url: payload.externalUrl || null };

  return tryMutation(row, 'materials', 'insert', async () => { const { data, error } = await requireSupabase().from('materials').insert(row).select().single(); if (error) throw error; return data as Material; });
}
export async function updateMaterial(id: string, payload: Partial<Pick<Material, 'title' | 'description' | 'material_type' | 'external_url' | 'subject_id'>>) {

  const row = { id, ...payload }; return tryMutation(row, 'materials', 'update', async () => { const { data, error } = await requireSupabase().from('materials').update(payload).eq('id', id).select().single(); if (error) throw error; return data as Material; });
}
export async function deleteMaterial(id: string) {

  const row = { id, deleted_at: now() }; await tryMutation(row, 'materials', 'update', async () => { const { error } = await requireSupabase().from('materials').update({ deleted_at: row.deleted_at }).eq('id', id); if (error) throw error; return undefined; });
}
export async function listMaterialFiles(materialId: string): Promise<MaterialFile[]> {

  const { data, error } = await requireSupabase().from('material_files').select('material_id,file_id,sort_order,files(id,uploaded_by,owner_scope,class_id,bucket,storage_path,file_name,mime_type,file_size,checksum,metadata,created_at)').eq('material_id', materialId).order('sort_order');
  if (error) throw error; return (data ?? []).map((r: any) => ({ material_id: r.material_id, file_id: r.file_id, sort_order: r.sort_order, file: r.files })) as MaterialFile[];
}
export async function attachMaterialFile(materialId: string, fileId: string, sortOrder = 0) { const row={ material_id: materialId, file_id: fileId, sort_order: sortOrder };  return tryMutation({ ...row, id: `${materialId}:${fileId}`, __match: { material_id: materialId, file_id: fileId } }, 'material_files', 'upsert', async () => { const { error } = await requireSupabase().from('material_files').upsert(row); if (error) throw error; return row; }); }
export async function detachMaterialFile(materialId: string, fileId: string) {  const row = { id: `${materialId}:${fileId}`, __match: { material_id: materialId, file_id: fileId } }; await tryMutation(row, 'material_files', 'delete', async () => { const { error } = await requireSupabase().from('material_files').delete().eq('material_id', materialId).eq('file_id', fileId); if (error) throw error; return undefined; }); }

export async function listAnnouncements(classId: string): Promise<Announcement[]> {

  const uid = await currentUserId(); if (!uid) return [];
  return cachedList(`announcements:${classId}:${uid}`, async () => {
    const [a, r] = await Promise.all([
      requireSupabase().from('announcements').select('id,class_id,created_by,title,content,priority,published_at,pinned,archived_at').eq('class_id', classId).is('deleted_at', null).is('archived_at', null).order('pinned', { ascending: false }).order('published_at', { ascending: false }),
      requireSupabase().from('announcement_reads').select('announcement_id').eq('user_id', uid),
    ]);
    if (a.error) throw a.error; if (r.error) throw r.error;
    const read = new Set((r.data ?? []).map(x => x.announcement_id)); return (a.data ?? []).map(x => ({ ...x, is_read: read.has(x.id) })) as Announcement[];
  });
}
export async function insertAnnouncement(classId: string, title: string, content: string, priority = 1, pinned = false) {
  const uid = await currentUserId(); if (!uid) throw new Error('UNAUTHENTICATED');
  const row = { id: uuid(), class_id: classId, created_by: uid, title: title.trim(), content: content.trim(), priority, published_at: now(), pinned, archived_at: null };

  return tryMutation(row, 'announcements', 'insert', async () => { const { data, error } = await requireSupabase().from('announcements').insert(row).select().single(); if (error) throw error; return data as Announcement; });
}
export async function updateAnnouncement(id: string, payload: Partial<Pick<Announcement, 'title' | 'content' | 'priority' | 'pinned'>>) {  const row = { id, ...payload }; return tryMutation(row, 'announcements', 'update', async () => { const { data, error } = await requireSupabase().from('announcements').update(payload).eq('id', id).select().single(); if (error) throw error; return data as Announcement; }); }
export async function archiveAnnouncement(id: string) { const archivedAt = now();  const row = { id, archived_at: archivedAt }; await tryMutation(row, 'announcements', 'update', async () => { const { error } = await requireSupabase().from('announcements').update({ archived_at: archivedAt }).eq('id', id); if (error) throw error; return undefined; }); }
export async function markAnnouncementRead(announcementId: string) {
  const uid = await currentUserId(); if (!uid) return;
  const row = { id: uuid(), announcement_id: announcementId, user_id: uid, read_at: now() };

  await tryMutation(row, 'announcement_reads', 'upsert', async () => { const { error } = await requireSupabase().from('announcement_reads').upsert(row, { onConflict: 'announcement_id,user_id' }); if (error) throw error; return undefined; });
}

export async function listForumTopics(classId: string): Promise<ForumTopic[]> {

  return cachedList(`forum:topics:${classId}`, async () => {
    const { data, error } = await requireSupabase().from('forum_topics').select('id,class_id,created_by,title,category,pinned,created_at,updated_at,profiles!inner(full_name),forum_posts(count)').eq('class_id', classId).is('deleted_at', null).order('pinned', { ascending: false }).order('updated_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((x: any) => ({ ...x, creator_name: x.profiles?.full_name, post_count: x.forum_posts?.[0]?.count ?? 0 })) as ForumTopic[];
  });
}
export async function createForumTopic(classId: string, title: string, category: string) { const uid = await currentUserId(); if (!uid) throw new Error('UNAUTHENTICATED'); const row = { id: uuid(), class_id: classId, created_by: uid, title: title.trim(), category, pinned: false };  return tryMutation(row, 'forum_topics', 'insert', async () => { const { data, error } = await requireSupabase().from('forum_topics').insert(row).select().single(); if (error) throw error; return data as ForumTopic; }); }
export async function updateForumTopic(id: string, payload: Partial<Pick<ForumTopic, 'title' | 'category' | 'pinned'>>) {  const row = { id, ...payload }; return tryMutation(row, 'forum_topics', 'update', async () => { const { data, error } = await requireSupabase().from('forum_topics').update(payload).eq('id', id).select().single(); if (error) throw error; return data as ForumTopic; }); }
export async function deleteForumTopic(id: string) {  const row = { id, deleted_at: now() }; await tryMutation(row, 'forum_topics', 'update', async () => { const { error } = await requireSupabase().from('forum_topics').update({ deleted_at: row.deleted_at }).eq('id', id); if (error) throw error; return undefined; }); }
export async function listForumPosts(topicId: string): Promise<ForumPost[]> {  const { data, error } = await requireSupabase().from('forum_posts').select('id,topic_id,user_id,parent_id,content,created_at,updated_at,profiles!inner(full_name)').eq('topic_id', topicId).is('deleted_at', null).order('created_at'); if (error) throw error; return (data ?? []).map((x: any) => ({ ...x, author_name: x.profiles?.full_name })) as ForumPost[]; }
export async function createForumPost(topicId: string, content: string, parentId?: string | null) { const uid = await currentUserId(); if (!uid) throw new Error('UNAUTHENTICATED'); const row = { id: uuid(), topic_id: topicId, user_id: uid, parent_id: parentId ?? null, content: content.trim() };  return tryMutation(row, 'forum_posts', 'insert', async () => { const { data, error } = await requireSupabase().from('forum_posts').insert(row).select().single(); if (error) throw error; return data as ForumPost; }); }
export async function updateForumPost(id: string, content: string) { const row = { id, content: content.trim(), updated_at: now() };  return tryMutation(row, 'forum_posts', 'update', async () => { const { data, error } = await requireSupabase().from('forum_posts').update({ content: row.content }).eq('id', id).select().single(); if (error) throw error; return data as ForumPost; }); }
export async function deleteForumPost(id: string) {  const row = { id, deleted_at: now() }; await tryMutation(row, 'forum_posts', 'update', async () => { const { error } = await requireSupabase().from('forum_posts').update({ deleted_at: row.deleted_at }).eq('id', id); if (error) throw error; return undefined; }); }
export async function reportForum(topicId: string, postId: string | null, reason: string) { const uid = await currentUserId(); if (!uid) throw new Error('UNAUTHENTICATED'); const row = { id: uuid(), topic_id: topicId, post_id: postId, reporter_id: uid, reason: reason.trim(), status: 'open' as const, review_note: null, reviewed_by: null, reviewed_at: null };  return tryMutation(row, 'forum_reports', 'insert', async () => { const { data, error } = await requireSupabase().from('forum_reports').insert(row).select().single(); if (error) throw error; return data as ForumReport; }); }
export async function listForumReports(classId: string): Promise<ForumReport[]> {  const { data, error } = await requireSupabase().from('forum_reports').select('id,topic_id,post_id,reporter_id,reason,status,review_note,reviewed_by,reviewed_at,created_at').in('topic_id', (await listForumTopics(classId)).map(t => t.id)).order('created_at', { ascending: false }); if (error) throw error; return (data ?? []) as ForumReport[]; }
export async function reviewForumReport(id: string, status: ForumReport['status'], reviewNote?: string) { const uid = await currentUserId(); if (!uid) throw new Error('UNAUTHENTICATED');  const { error } = await requireSupabase().from('forum_reports').update({ status, review_note: reviewNote?.trim() || null, reviewed_by: uid, reviewed_at: now() }).eq('id', id); if (error) throw error; }

export async function listGroups(classId: string): Promise<GroupRecord[]> {  return cachedList(`groups:${classId}`, async () => { const { data, error } = await requireSupabase().from('groups').select('id,class_id,name,description,created_by,leader_user_id,created_at').eq('class_id', classId).is('deleted_at', null).order('created_at'); if (error) throw error; return (data ?? []) as GroupRecord[]; }); }
export async function setGroupLeader(groupId: string, userId: string | null) {

  const { data, error } = await requireSupabase().rpc('set_group_leader', { p_group_id: groupId, p_user_id: userId }); if (error) throw error; await invalidateCachesForTable('groups'); return data as GroupRecord;
}
export async function createGroup(classId: string, name: string, description?: string) { const uid = await currentUserId(); if (!uid) throw new Error('UNAUTHENTICATED'); const row = { id: uuid(), class_id: classId, name: name.trim(), description: description?.trim() || null, created_by: uid };  return tryMutation(row, 'groups', 'insert', async () => { const { data, error } = await requireSupabase().from('groups').insert(row).select().single(); if (error) throw error; return data as GroupRecord; }); }
export async function updateGroup(id: string, payload: Pick<Partial<GroupRecord>, 'name' | 'description'>) {  const { data, error } = await requireSupabase().from('groups').update(payload).eq('id', id).select().single(); if (error) throw error; return data as GroupRecord; }
export async function deleteGroup(id: string) {  const { error } = await requireSupabase().from('groups').update({ deleted_at: now() }).eq('id', id); if (error) throw error; }
export async function listGroupMembers(groupId: string): Promise<GroupMember[]> {  return cachedList(`group-members:${groupId}`, async () => { const { data, error } = await requireSupabase().from('group_members').select('id,group_id,user_id,profiles!inner(full_name,nim)').eq('group_id', groupId).order('joined_at'); if (error) throw error; return (data ?? []).map((x: any) => ({ ...x, full_name: x.profiles?.full_name, nim: x.profiles?.nim })) as GroupMember[]; }); }
export async function addGroupMember(groupId: string, userId: string) {  const row = { id: uuid(), group_id: groupId, user_id: userId }; await tryMutation(row, 'group_members', 'insert', async () => { const { error } = await requireSupabase().from('group_members').insert({ group_id: groupId, user_id: userId }); if (error) throw error; return undefined; }); }
export async function removeGroupMember(groupId: string, userId: string) {  const row = { id: `${groupId}:${userId}`, group_id: groupId, user_id: userId, __match: { group_id: groupId, user_id: userId } }; await tryMutation(row, 'group_members', 'delete', async () => { const { error } = await requireSupabase().from('group_members').delete().eq('group_id', groupId).eq('user_id', userId); if (error) throw error; return undefined; }); }
export async function listGroupTasks(groupId: string): Promise<GroupTask[]> {  return cachedList(`group-tasks:${groupId}`, async () => { const { data, error } = await requireSupabase().from('group_tasks').select('id,group_id,title,description,assigned_to,completed,deadline').eq('group_id', groupId).is('deleted_at', null).order('deadline'); if (error) throw error; return (data ?? []) as GroupTask[]; }); }
export async function createGroupTask(groupId: string, payload: { title: string; description?: string; assignedTo?: string | null; deadline?: string | null }) { const row = { id: uuid(), group_id: groupId, title: payload.title.trim(), description: payload.description?.trim() || null, assigned_to: payload.assignedTo ?? null, completed: false, deadline: payload.deadline ?? null };  return tryMutation(row, 'group_tasks', 'insert', async () => { const { data, error } = await requireSupabase().from('group_tasks').insert(row).select().single(); if (error) throw error; return data as GroupTask; }); }
export async function updateGroupTask(id: string, payload: Partial<Pick<GroupTask, 'title' | 'description' | 'assigned_to' | 'deadline' | 'completed'>>) {  const row = { id, ...payload }; return tryMutation(row, 'group_tasks', 'update', async () => { const { data, error } = await requireSupabase().from('group_tasks').update(payload).eq('id', id).select().single(); if (error) throw error; return data as GroupTask; }); }
export async function deleteGroupTask(id: string) {  const row = { id, deleted_at: now() }; await tryMutation(row, 'group_tasks', 'update', async () => { const { error } = await requireSupabase().from('group_tasks').update({ deleted_at: row.deleted_at }).eq('id', id); if (error) throw error; return undefined; }); }
export async function toggleGroupTask(task: GroupTask) { return updateGroupTask(task.id, { completed: !task.completed }); }

export async function listPolls(classId: string): Promise<Poll[]> {  return cachedList(`polls:${classId}`, async () => { const { data, error } = await requireSupabase().from('polls').select('id,class_id,created_by,title,description,closes_at,is_anonymous,is_decision,closed,created_at').eq('class_id', classId).is('deleted_at', null).order('created_at', { ascending: false }); if (error) throw error; return (data ?? []) as Poll[]; }); }
export async function listPollOptions(pollId: string): Promise<PollOption[]> {  const { data, error } = await requireSupabase().from('poll_options').select('id,poll_id,label,sort_order,poll_votes(count)').eq('poll_id', pollId).order('sort_order'); if (error) throw error; return (data ?? []).map((o: any) => ({ ...o, votes: o.poll_votes?.[0]?.count ?? 0 })) as PollOption[]; }
export async function listPollOptionsBatch(pollIds: string[]): Promise<Record<string, PollOption[]>> {
  if (!pollIds.length) return {};

  const { data, error } = await requireSupabase().from('poll_options').select('id,poll_id,label,sort_order,poll_votes(count)').in('poll_id', pollIds).order('sort_order');
  if (error) throw error;
  const grouped: Record<string, PollOption[]> = {};
  for (const row of (data ?? []) as any[]) {
    const item = { ...row, votes: row.poll_votes?.[0]?.count ?? 0 } as PollOption;
    (grouped[item.poll_id] ??= []).push(item);
  }
  return grouped;
}
export async function listMyPollVote(pollId: string): Promise<PollVoteLike | null> { const uid = await currentUserId(); if (!uid) return null; const { data, error } = await requireSupabase().from('poll_votes').select('id,poll_id,poll_option_id,user_id,created_at').eq('poll_id', pollId).eq('user_id', uid).maybeSingle(); if (error) throw error; return data as PollVoteLike | null; }
export async function listMyPollVotes(pollIds: string[]): Promise<Record<string, PollVoteLike | null>> {
  const uid = await currentUserId();
  if (!uid || !pollIds.length) return {};

  const { data, error } = await requireSupabase().from('poll_votes').select('id,poll_id,poll_option_id,user_id,created_at').eq('user_id', uid).in('poll_id', pollIds);
  if (error) throw error;
  return Object.fromEntries(pollIds.map(id => [id, (data ?? []).find((v:any)=>v.poll_id===id) as PollVoteLike | undefined ?? null]));
}
type PollVoteLike = { id: string; poll_id: string; poll_option_id: string; user_id: string; created_at: string };
export async function createPoll(classId: string, title: string, description: string, closesAt: string | null, anonymous: boolean, options: string[], isDecision = false) { const uid = await currentUserId(); if (!uid) throw new Error('UNAUTHENTICATED'); const clean = [...new Set(options.map(x => x.trim()).filter(Boolean))]; if (clean.length < 2) throw new Error('MIN_TWO_POLL_OPTIONS'); const id = uuid(); const row = { id, class_id: classId, created_by: uid, title: title.trim(), description: description.trim() || null, closes_at: closesAt, is_anonymous: anonymous, is_decision: isDecision, closed: false };  const { data, error } = await requireSupabase().from('polls').insert(row).select().single(); if (error) throw error; const { error: oe } = await requireSupabase().from('poll_options').insert(clean.map((label, i) => ({ id: uuid(), poll_id: id, label, sort_order: i + 1 }))); if (oe) throw oe; return data as Poll; }
export async function votePoll(pollId: string, optionId: string) { const uid = await currentUserId(); if (!uid) throw new Error('UNAUTHENTICATED');  const row = { id: uuid(), poll_id: pollId, poll_option_id: optionId, user_id: uid }; await tryMutation(row, 'poll_votes', 'insert', async () => { const { error } = await requireSupabase().from('poll_votes').insert(row); if (error) throw error; return undefined; }); }
export async function closePoll(id: string) {  const row = { id, closed: true }; await tryMutation(row, 'polls', 'update', async () => { const { error } = await requireSupabase().from('polls').update({ closed: true }).eq('id', id); if (error) throw error; return undefined; }); }

export async function getCashAccount(classId: string): Promise<CashAccount> {  const { data, error } = await requireSupabase().from('cash_accounts').select('id,class_id').eq('class_id', classId).single(); if (error) throw error; return data as CashAccount; }
export async function getCashSummary(classId: string): Promise<CashSummary> {  const { data, error } = await requireSupabase().rpc('get_cash_summary', { p_class_id: classId }); if (error) throw error; return (Array.isArray(data) ? data[0] : data) as CashSummary; }
export async function listCashTransactions(accountId: string): Promise<CashTransaction[]> {  return cachedList(`cash-tx:${accountId}`, async () => { const { data, error } = await requireSupabase().from('cash_transactions').select('id,cash_account_id,created_by,transaction_type,amount,category,description,proof_file_id,transaction_date,voided_at,void_reason,reversal_of_transaction_id,correction_reason').eq('cash_account_id', accountId).is('deleted_at', null).order('transaction_date', { ascending: false }).order('created_at', { ascending: false }); if (error) throw error; return (data ?? []) as CashTransaction[]; }); }

function normalizeCashMonth(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('INVALID_CASH_MONTH');
  const [year, rawMonth] = month.split('-').map(Number);
  if (!Number.isInteger(year) || rawMonth < 1 || rawMonth > 12) throw new Error('INVALID_CASH_MONTH');
  return month;
}

export async function listCashTransactionsByMonth(accountId: string, month: string): Promise<CashTransaction[]> {
  const normalized = normalizeCashMonth(month);

  const start = `${normalized}-01`;
  const [year, rawMonth] = normalized.split('-').map(Number);
  const endDate = new Date(Date.UTC(year, rawMonth, 1));
  const end = endDate.toISOString().slice(0, 10);
  return cachedList(`cash-tx:${accountId}:${normalized}`, async () => {
    const { data, error } = await requireSupabase().from('cash_transactions')
      .select('id,cash_account_id,created_by,transaction_type,amount,category,description,proof_file_id,transaction_date,voided_at,void_reason,reversal_of_transaction_id,correction_reason')
      .eq('cash_account_id', accountId).gte('transaction_date', start).lt('transaction_date', end)
      .is('deleted_at', null).order('transaction_date', { ascending: false }).order('created_at', { ascending: false });
    if (error) throw error; return (data ?? []) as CashTransaction[];
  });
}

export async function getCashMonthlySummary(classId: string, month: string): Promise<CashMonthlySummary> {
  const normalized = normalizeCashMonth(month);

  const { data, error } = await requireSupabase().rpc('get_cash_month_summary', { p_class_id: classId, p_month: `${normalized}-01` });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return (row ?? { opening_balance: 0, total_income: 0, total_expense: 0, net_change: 0, closing_balance: 0, transaction_count: 0, month_start: `${normalized}-01` }) as CashMonthlySummary;
}
export async function listCashDues(classId: string): Promise<CashDue[]> {  return cachedList(`cash-dues:${classId}`, async () => { const { data, error } = await requireSupabase().from('cash_dues').select('id,class_id,title,amount,due_date,created_by').eq('class_id', classId).is('deleted_at', null).order('due_date', { ascending: false }); if (error) throw error; return (data ?? []) as CashDue[]; }); }
export async function listCashDuesWithPayments(classId: string, month?: string): Promise<Array<CashDue & { payments: CashPayment[] }>> {
  const normalized = month ? normalizeCashMonth(month) : null;

  const key = normalized ? `cash-dues-payments:${classId}:${normalized}` : `cash-dues-payments:${classId}`;
  return cachedList(key, async () => {
    let query = requireSupabase().from('cash_dues')
      .select('id,class_id,title,amount,due_date,created_by,cash_payments(id,due_id,user_id,amount,status,proof_file_id,paid_at,verified_by,verified_at,rejection_reason,cash_transaction_id)')
      .eq('class_id', classId).is('deleted_at', null).order('due_date', { ascending: false });
    if (normalized) {
      const [year, rawMonth] = normalized.split('-').map(Number);
      const start = `${normalized}-01`;
      const end = new Date(Date.UTC(year, rawMonth, 1)).toISOString().slice(0, 10);
      query = query.gte('due_date', start).lt('due_date', end);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((row: any) => ({ ...row, payments: (row.cash_payments ?? []) as CashPayment[] } as CashDue & { payments: CashPayment[] }));
  });
}

export async function listCashPayments(dueId: string): Promise<CashPayment[]> {  const { data, error } = await requireSupabase().from('cash_payments').select('id,due_id,user_id,amount,status,proof_file_id,paid_at,verified_by,verified_at,rejection_reason,cash_transaction_id').eq('due_id', dueId).is('deleted_at', null); if (error) throw error; return (data ?? []) as CashPayment[]; }
export async function createCashTransaction(classId: string, payload: { type: 'income' | 'expense'; amount: number; category: string; description?: string; date?: string; proofFileId?: string | null }) { const account = await getCashAccount(classId); const uid = await currentUserId(); if (!uid) throw new Error('UNAUTHENTICATED'); const row = { id: uuid(), cash_account_id: account.id, created_by: uid, transaction_type: payload.type, amount: payload.amount, category: payload.category.trim(), description: payload.description?.trim() || null, proof_file_id: payload.proofFileId ?? null, transaction_date: payload.date ?? localDateISO() };  return tryMutation(row, 'cash_transactions', 'insert', async () => { const { data, error } = await requireSupabase().from('cash_transactions').insert(row).select().single(); if (error) throw error; return data as CashTransaction; }); }
export async function createCashDue(classId: string, title: string, amount: number, dueDate: string | null) { const uid = await currentUserId(); if (!uid) throw new Error('UNAUTHENTICATED'); const row = { id: uuid(), class_id: classId, title: title.trim(), amount, due_date: dueDate, created_by: uid };  return tryMutation(row, 'cash_dues', 'insert', async () => { const { data, error } = await requireSupabase().from('cash_dues').insert(row).select().single(); if (error) throw error; return data as CashDue; }); }
export async function createCashPayment(dueId: string, amount: number) {
  const uid = await currentUserId(); if (!uid) throw new Error('UNAUTHENTICATED');

  const existing = await requireSupabase().from('cash_payments').select('id,status').eq('due_id',dueId).eq('user_id',uid).is('deleted_at',null).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data?.status === 'paid') throw new Error('CASH_PAYMENT_ALREADY_PAID');
  if (existing.data) {
    const row = { id: existing.data.id as string, amount, status: 'pending' as const, paid_at: null, proof_file_id: null, rejection_reason: null };
    return tryMutation(row,'cash_payments','update',async()=>{ const { data, error } = await requireSupabase().from('cash_payments').update({ amount, status:'pending', paid_at:null, proof_file_id:null, rejection_reason:null, verified_by:null, verified_at:null, cash_transaction_id:null }).eq('id',row.id).eq('user_id',uid).select().single(); if(error) throw error; return data as CashPayment; });
  }
  const row = { id: uuid(), due_id: dueId, user_id: uid, amount, status: 'pending' as const, proof_file_id: null, paid_at: null };
  return tryMutation(row,'cash_payments','insert',async()=>{ const { data, error } = await requireSupabase().from('cash_payments').insert(row).select().single(); if(error) throw error; return data as CashPayment; });
}

export async function verifyCashPayment(paymentId: string, status: 'paid' | 'rejected' | 'partial', rejectionReason?: string) {

  const { error } = await requireSupabase().rpc('verify_cash_payment', { p_payment_id: paymentId, p_status: status, p_rejection_reason: rejectionReason ?? null });
  if (error) throw error;
  await invalidateCachesForTable('cash_payments');
}
export async function attachCashPaymentProof(paymentId: string, classId: string, file: File) { const record = await uploadPrivateFile(classId, file, 'cash-proofs', `${classId}/${await currentUserId()}/${paymentId}`); const row = { id: paymentId, proof_file_id: record.id }; try { await tryMutation(row, 'cash_payments', 'update', async () => { const { error } = await requireSupabase().from('cash_payments').update({ proof_file_id: record.id }).eq('id', paymentId); if (error) throw error; return undefined; }); return record; } catch (error) { try { const uid = await currentUserId(); if (uid) await requireSupabase().storage.from('cash-proofs').remove([record.storage_path]); } catch {} throw error; } }
export async function voidCashTransaction(id: string, reason: string) {  const { error } = await requireSupabase().rpc('void_cash_transaction', { p_transaction_id: id, p_reason: reason }); if (error) throw error; await invalidateCachesForTable('cash_transactions'); }
export async function correctCashTransaction(id: string, payload: { type: 'income' | 'expense'; amount: number; category: string; description?: string; date: string; reason: string }) {  const { data, error } = await requireSupabase().rpc('correct_cash_transaction', { p_transaction_id: id, p_type: payload.type, p_amount: payload.amount, p_category: payload.category, p_description: payload.description ?? null, p_transaction_date: payload.date, p_reason: payload.reason }); if (error) throw error; await invalidateCachesForTable('cash_transactions'); return data as CashTransaction; }

async function fileDigest(file: File) { const buffer = await file.arrayBuffer(); const digest = await crypto.subtle.digest('SHA-256', buffer); return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join(''); }
function sanitizeFileName(name: string) { return name.replace(/[^a-zA-Z0-9._-]/g, '_'); }
async function uploadPrivateFile(classId: string, file: File, bucket: string, prefix: string): Promise<FileRecord> {
  if (!navigator.onLine) throw new Error('FILE_UPLOAD_REQUIRES_ONLINE');
  if (file.size > 50 * 1024 * 1024) throw new Error('FILE_TOO_LARGE');
  const uid = await currentUserId(); if (!uid) throw new Error('UNAUTHENTICATED');
  const checksum = await fileDigest(file); const path = `${prefix}/${uuid()}-${sanitizeFileName(file.name)}`;
  const c = requireSupabase(); const { error: ue } = await c.storage.from(bucket).upload(path, file, { upsert: false, contentType: file.type || undefined }); if (ue) throw ue;
  const row = { id: uuid(), uploaded_by: uid, owner_scope: 'class' as const, class_id: classId, bucket, storage_path: path, file_name: file.name, mime_type: file.type || 'application/octet-stream', file_size: file.size, checksum, metadata: {} };
  const { data, error } = await c.from('files').insert(row).select().single(); if (error) { await c.storage.from(bucket).remove([path]); throw error; }
  await localFileSet({ key: row.id, blob: file, fileName: file.name, mimeType: row.mime_type, size: file.size, updatedAt: Date.now() });
  return data as FileRecord;
}
export async function getFileById(fileId: string): Promise<FileRecord | null> {

  const { data, error } = await requireSupabase().from('files').select('id,uploaded_by,owner_scope,class_id,bucket,storage_path,file_name,mime_type,file_size,checksum,metadata,created_at,deleted_at').eq('id', fileId).is('deleted_at', null).maybeSingle();
  if (error) throw error;
  return (data as FileRecord | null) ?? null;
}
export async function listFiles(classId: string): Promise<FileRecord[]> {  return cachedList(`files:${classId}`, async () => { const { data, error } = await requireSupabase().from('files').select('id,uploaded_by,owner_scope,class_id,bucket,storage_path,file_name,mime_type,file_size,checksum,metadata,created_at,deleted_at').eq('class_id', classId).eq('owner_scope', 'class').is('deleted_at', null).order('created_at', { ascending: false }); if (error) throw error; return (data ?? []) as FileRecord[]; }); }
export async function uploadClassFile(classId: string, file: File) {  return uploadPrivateFile(classId, file, 'class-files', `${classId}/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}`); }
export async function cacheFileOffline(file: FileRecord) { const local = await localFileGet(file.id); if (local) return; if (!navigator.onLine) return; const url = await getFileUrl(file, true); if (!url) return; const response = await fetch(url); if (!response.ok) throw new Error('FILE_CACHE_FAILED'); const blob = await response.blob(); await localFileSet({ key: file.id, blob, fileName: file.file_name, mimeType: file.mime_type, size: file.file_size, updatedAt: Date.now() }); }
export async function removeOfflineFile(fileId: string) { await localFileRemove(fileId); }
export async function getFileUrl(file: FileRecord, allowNetwork = true) { const local = await localFileGet(file.id); if (local) return URL.createObjectURL(local.blob); if (!allowNetwork || !navigator.onLine) return null; const { data, error } = await requireSupabase().storage.from(file.bucket).createSignedUrl(file.storage_path, 600); if (error) throw error; return data.signedUrl; }

export async function listAlbums(classId: string): Promise<Album[]> {  return cachedList(`albums:${classId}`, async () => { const { data, error } = await requireSupabase().from('albums').select('id,class_id,created_by,title,description,created_at,updated_at').eq('class_id', classId).is('deleted_at', null).order('created_at', { ascending: false }); if (error) throw error; return (data ?? []) as Album[]; }); }
export async function createAlbum(classId: string, title: string, description?: string) { const uid = await currentUserId(); if (!uid) throw new Error('UNAUTHENTICATED'); const row = { id: uuid(), class_id: classId, created_by: uid, title: title.trim(), description: description?.trim() || null };  return tryMutation(row, 'albums', 'insert', async () => { const { data, error } = await requireSupabase().from('albums').insert(row).select().single(); if (error) throw error; return data as Album; }); }
export async function updateAlbum(id: string, payload: Pick<Partial<Album>, 'title' | 'description'>) {  const row = { id, ...payload }; return tryMutation(row, 'albums', 'update', async () => { const { data, error } = await requireSupabase().from('albums').update(payload).eq('id', id).select().single(); if (error) throw error; return data as Album; }); }
export async function deleteAlbum(id: string) {  const row = { id, deleted_at: now() }; await tryMutation(row, 'albums', 'update', async () => { const { error } = await requireSupabase().from('albums').update({ deleted_at: row.deleted_at }).eq('id', id); if (error) throw error; return undefined; }); }
export async function listPhotos(albumId: string): Promise<Photo[]> {  const { data, error } = await requireSupabase().from('photos').select('id,album_id,file_id,uploaded_by,caption,created_at').eq('album_id', albumId).is('deleted_at', null).order('created_at', { ascending: false }); if (error) throw error; return (data ?? []) as Photo[]; }
export async function updatePhoto(id: string, caption: string) {  const row = { id, caption: caption.trim() }; return tryMutation(row, 'photos', 'update', async () => { const { data, error } = await requireSupabase().from('photos').update({ caption: row.caption }).eq('id', id).select().single(); if (error) throw error; return data as Photo; }); }
export async function deletePhoto(id: string) {  const row = { id, deleted_at: now() }; await tryMutation(row, 'photos', 'update', async () => { const { error } = await requireSupabase().from('photos').update({ deleted_at: row.deleted_at }).eq('id', id); if (error) throw error; return undefined; }); }
export async function uploadPhoto(classId: string, albumId: string, file: File, caption?: string) {  const record = await uploadPrivateFile(classId, file, 'class-photos', `${classId}/${albumId}`); const uid = await currentUserId(); const { data, error } = await requireSupabase().from('photos').insert({ id: uuid(), album_id: albumId, file_id: record.id, uploaded_by: uid, caption: caption ?? null }).select().single(); if (error) { await requireSupabase().storage.from('class-photos').remove([record.storage_path]); throw error; } return data as Photo; }

export async function listSharedNotes(classId: string): Promise<SharedNote[]> {  return cachedList(`shared-notes:${classId}`, async () => { const { data, error } = await requireSupabase().from('shared_notes').select('id,class_id,created_by,title,content,version,updated_at').eq('class_id', classId).is('deleted_at', null).order('updated_at', { ascending: false }); if (error) throw error; return (data ?? []) as SharedNote[]; }); }
export async function createSharedNote(classId: string, title: string, content: string) { const uid = await currentUserId(); if (!uid) throw new Error('UNAUTHENTICATED'); const row = { id: uuid(), class_id: classId, created_by: uid, title: title.trim(), content, version: 1 };  return tryMutation(row, 'shared_notes', 'insert', async () => { const { data, error } = await requireSupabase().from('shared_notes').insert(row).select().single(); if (error) throw error; return data as SharedNote; }); }
export async function updateSharedNote(note: SharedNote, title: string, content: string) {  const args = { p_note_id: note.id, p_expected_version: note.version, p_title: title.trim(), p_content: content }; try { const { data, error } = await requireSupabase().rpc('update_shared_note_with_version', args); if (error) throw error; await invalidateCachesForTable('shared_notes'); return data as SharedNote; } catch (error) { if (!isRetryableNetworkError(error)) throw error; await queueWrite('__rpc__', note.id, { name: 'update_shared_note_with_version', args }, 'update', error); await invalidateCachesForTable('shared_notes'); return { ...note, title: args.p_title, content, version: note.version + 1, updated_at: now() }; } }

export async function listAdminNotes(classId: string): Promise<AdminNote[]> {  return cachedList(`admin-notes:${classId}`, async () => { const { data, error } = await requireSupabase().from('class_admin_notes').select('id,class_id,created_by,title,category,note_date,content,pinned,created_at,updated_at').eq('class_id', classId).is('deleted_at', null).order('pinned', { ascending: false }).order('note_date', { ascending: false }); if (error) throw error; return (data ?? []) as AdminNote[]; }); }
export async function createAdminNote(classId: string, payload: Pick<AdminNote, 'title' | 'category' | 'note_date' | 'content' | 'pinned'>) { const uid = await currentUserId(); if (!uid) throw new Error('UNAUTHENTICATED'); const row = { id: uuid(), class_id: classId, created_by: uid, ...payload };  return tryMutation(row, 'class_admin_notes', 'insert', async () => { const { data, error } = await requireSupabase().from('class_admin_notes').insert(row).select().single(); if (error) throw error; return data as AdminNote; }); }
export async function updateAdminNote(id: string, payload: Partial<Pick<AdminNote, 'title' | 'category' | 'note_date' | 'content' | 'pinned'>>) {  const row = { id, ...payload, updated_at: now() }; return tryMutation(row, 'class_admin_notes', 'update', async () => { const { data, error } = await requireSupabase().from('class_admin_notes').update(payload).eq('id', id).select().single(); if (error) throw error; return data as AdminNote; }); }
export async function deleteAdminNote(id: string) {  const row = { id, deleted_at: now() }; await tryMutation(row, 'class_admin_notes', 'update', async () => { const { error } = await requireSupabase().from('class_admin_notes').update({ deleted_at: row.deleted_at }).eq('id', id); if (error) throw error; return undefined; }); }

export async function saveRandomizerResult(classId: string, mode: RandomizerHistoryRecord['mode'], title: string, entries: string[]): Promise<RandomizerHistoryRecord> {
  const uid = await currentUserId(); if (!uid) throw new Error('UNAUTHENTICATED');
  const row = { id: uuid(), class_id: classId, created_by: uid, mode, title: title.trim(), entries, created_at: now() };

  return tryMutation(row, 'randomizer_results', 'insert', async () => {
    const { data, error } = await requireSupabase().from('randomizer_results').insert(row).select().single();
    if (error) throw error; return data as RandomizerHistoryRecord;
  });
}
export async function listRandomizerHistory(classId: string): Promise<RandomizerHistoryRecord[]> {

  return cachedList(`randomizer-history:${classId}`, async () => {
    const { data, error } = await requireSupabase().from('randomizer_results').select('id,class_id,created_by,mode,title,entries,created_at').eq('class_id', classId).order('created_at', { ascending:false }).limit(30);
    if (error) throw error; return (data ?? []) as RandomizerHistoryRecord[];
  });
}

export async function listNotifications(): Promise<Notification[]> {  const uid = await currentUserId(); if (!uid) return []; return cachedList(`notifications:${uid}`, async () => { const { data, error } = await requireSupabase().from('notifications').select('id,user_id,notification_type,title,body,data,is_read,created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(100); if (error) throw error; return (data ?? []) as Notification[]; }); }

export async function listActivityLogs(classId: string, limit = 25): Promise<ActivityLog[]> {

  const { data, error } = await requireSupabase().from('activity_logs').select('id,user_id,class_id,action,entity_type,entity_id,metadata,created_at').eq('class_id', classId).order('created_at',{ascending:false}).limit(limit);
  if (error) throw error;
  return (data ?? []) as ActivityLog[];
}

export async function markNotificationRead(id: string) {  const row = { id, is_read: true }; await tryMutation(row, 'notifications', 'update', async () => { const { error } = await requireSupabase().from('notifications').update({ is_read: true }).eq('id', id); if (error) throw error; return undefined; }, async () => { const uid = await currentUserId(); if (uid) { const cached = (await cacheGet<Notification[]>(`notifications:${uid}`)) ?? []; await cacheSet(`notifications:${uid}`, cached.map(n => n.id === id ? { ...n, is_read: true } : n)); } }); }

export async function listNotes(classId?: string): Promise<PersonalNote[]> {  const uid = await currentUserId(); if (!uid) return []; return cachedList(`notes:${uid}:${classId ?? 'all'}`, async () => { let q = requireSupabase().from('personal_notes').select('id,user_id,class_id,title,content,pinned,updated_at').eq('user_id', uid).is('deleted_at', null).order('pinned', { ascending: false }).order('updated_at', { ascending: false }); if (classId) q = q.eq('class_id', classId); const { data, error } = await q; if (error) throw error; return (data ?? []) as PersonalNote[]; }); }
export async function saveNote(note: { id?: string; classId?: string | null; title: string; content: string; pinned?: boolean }) { const uid = await currentUserId(); if (!uid) throw new Error('UNAUTHENTICATED'); const id = note.id ?? uuid(); const row = { id, user_id: uid, class_id: note.classId ?? null, title: note.title.trim(), content: note.content, pinned: note.pinned ?? false, updated_at: now() };  return tryMutation(row, 'personal_notes', 'upsert', async () => { const { data, error } = await requireSupabase().from('personal_notes').upsert(row).select().single(); if (error) throw error; return data as PersonalNote; }, async () => { await mergeCachedList(`notes:${uid}:all`, row as PersonalNote); if (row.class_id) await mergeCachedList(`notes:${uid}:${row.class_id}`, row as PersonalNote); }); }
export async function deleteNote(id: string) {  const uid = await currentUserId(); if (!uid) throw new Error('UNAUTHENTICATED'); const row = { id, deleted_at: now() }; await tryMutation(row, 'personal_notes', 'update', async () => { const { error } = await requireSupabase().from('personal_notes').update({ deleted_at: row.deleted_at }).eq('id', id); if (error) throw error; return undefined; }, async () => { await removeCachedListItem(`notes:${uid}:all`, id); }); }



export async function listBugReports(): Promise<BugReport[]> {
  const uid = await currentUserId();
  if (!uid) return [];

  return cachedList(`bug-reports:${uid}`, async () => {
    const { data, error } = await requireSupabase().from('bug_reports')
      .select('id,user_id,title,category,severity,description,steps,expected_behavior,actual_behavior,page_path,user_agent,status,created_at,updated_at')
      .eq('user_id', uid).order('created_at', { ascending: false }).limit(50);
    if (error) throw error;
    return (data ?? []) as BugReport[];
  });
}

export async function createBugReport(payload: {
  title: string;
  category: BugReportCategory;
  severity: BugSeverity;
  description: string;
  steps?: string | null;
  expectedBehavior?: string | null;
  actualBehavior?: string | null;
  pagePath?: string | null;
}): Promise<BugReport> {
  const uid = await currentUserId();
  if (!uid) throw new Error('UNAUTHENTICATED');
  const row = {
    id: uuid(), user_id: uid, title: payload.title.trim(), category: payload.category, severity: payload.severity,
    description: payload.description.trim(), steps: payload.steps?.trim() || null,
    expected_behavior: payload.expectedBehavior?.trim() || null, actual_behavior: payload.actualBehavior?.trim() || null,
    page_path: payload.pagePath?.trim() || location.hash || '/', user_agent: navigator.userAgent,
    status: 'open' as const, created_at: now(), updated_at: now(),
  };

  return tryMutation(row, 'bug_reports', 'insert', async () => {
    const { data, error } = await requireSupabase().from('bug_reports').insert(row).select().single();
    if (error) throw error;
    return data as BugReport;
  }, async () => {
    await mergeCachedList(`bug-reports:${uid}`, row as BugReport);
  });
}

export async function globalSearch(query: string): Promise<SearchResult[]> {
  const q = query.trim().replace(/[\r\n]/g, ' '); if (q.length < 2) return [];
  const searchText = q.replace(/[%,_.*()\\]/g, ' ').replace(/\s+/g, ' ').trim(); if (searchText.length < 2) return [];

  const term = `%${searchText}%`; const c = requireSupabase();
  const [classes, tasks, materials, announcements, topics, notes] = await Promise.all([
    c.from('classes').select('id,name,class_code').ilike('name', term).is('deleted_at', null).limit(10),
    c.from('assignments').select('id,title,description,class_id,classes(name)').or(`title.ilike.${term},description.ilike.${term}`).is('deleted_at', null).limit(10),
    c.from('materials').select('id,title,description,class_id,classes(name)').or(`title.ilike.${term},description.ilike.${term}`).is('deleted_at', null).limit(10),
    c.from('announcements').select('id,title,content,class_id,classes(name)').or(`title.ilike.${term},content.ilike.${term}`).is('deleted_at', null).limit(10),
    c.from('forum_topics').select('id,title,category,class_id,classes(name)').or(`title.ilike.${term},category.ilike.${term}`).is('deleted_at', null).limit(10),
    c.from('shared_notes').select('id,title,content,class_id,classes(name)').or(`title.ilike.${term},content.ilike.${term}`).is('deleted_at', null).limit(10),
  ]);
  [classes, tasks, materials, announcements, topics, notes].forEach(r => { if (r.error) throw r.error; });
  const out: SearchResult[] = [];
  (classes.data ?? []).forEach((x: any) => out.push({ id: x.id, title: x.name, excerpt: x.class_code, type: 'class', href: `#/classes/${x.id}` }));
  (tasks.data ?? []).forEach((x: any) => out.push({ id: x.id, title: x.title, excerpt: x.description ?? '', type: 'task', classId: x.class_id, className: x.classes?.name, href: `#/classes/${x.class_id}?tab=tasks&item=${encodeURIComponent(x.id)}` }));
  (materials.data ?? []).forEach((x: any) => out.push({ id: x.id, title: x.title, excerpt: x.description ?? '', type: 'material', classId: x.class_id, className: x.classes?.name, href: `#/classes/${x.class_id}?tab=materials&item=${encodeURIComponent(x.id)}` }));
  (announcements.data ?? []).forEach((x: any) => out.push({ id: x.id, title: x.title, excerpt: x.content.slice(0, 160), type: 'announcement', classId: x.class_id, className: x.classes?.name, href: `#/classes/${x.class_id}?tab=announcements&item=${encodeURIComponent(x.id)}` }));
  (topics.data ?? []).forEach((x: any) => out.push({ id: x.id, title: x.title, excerpt: x.category, type: 'forum', classId: x.class_id, className: x.classes?.name, href: `#/classes/${x.class_id}?tab=forum&item=${encodeURIComponent(x.id)}` }));
  (notes.data ?? []).forEach((x: any) => out.push({ id: x.id, title: x.title, excerpt: x.content.slice(0, 160), type: 'note', classId: x.class_id, className: x.classes?.name, href: x.class_id ? `#/classes/${x.class_id}?tab=shared-notes&item=${encodeURIComponent(x.id)}` : '#/notes' }));
  return out.slice(0, 50);
}

export async function queueState() {
  const userId = await currentUserId();
  if (!userId) return { total: 0, pending: 0, failed: 0, conflict: 0 };
  const items = await queueAll(userId);
  return { total: items.length, pending: items.filter(x => x.status === 'pending').length, failed: items.filter(x => x.status === 'failed').length, conflict: items.filter(x => x.status === 'conflict').length };
}
async function invokeQueuedRpc(payload: Record<string, unknown>) {
  const name = String(payload.name ?? ''); const args = payload.args;
  if (name !== 'update_shared_note_with_version' && name !== 'set_group_leader') throw new Error('RPC_NOT_ALLOWLISTED');
  const { error } = await requireSupabase().rpc(name as any, args as any); if (error) throw error;
}
function retryDelayMs(attempts: number) { return Math.min(60000, Math.max(1000, (2 ** Math.min(attempts, 6)) * 1000)) + Math.floor(Math.random() * 600); }
function isConflictError(error: unknown) { const value = error as { code?: string; status?: number; message?: string } | null; const message = String(value?.message ?? error ?? ''); return value?.status === 409 || String(value?.code ?? '') === '409' || /conflict|stale|version mismatch|duplicate key|unique constraint/i.test(message); }

let syncPromise: Promise<{ pending: number; failed: number; conflict: number }> | null = null;
async function runSyncLocked() {

  const userId = await currentUserId();
  if (!userId) return { pending: 0, failed: 0, conflict: 0 };
  if (!navigator.onLine) { const items = await queueAll(userId); return { pending: items.filter(x => x.status === 'pending').length, failed: items.filter(x => x.status === 'failed').length, conflict: items.filter(x => x.status === 'conflict').length }; }
  const items = await queueAll(userId); let pending = 0, failed = 0, conflict = 0;
  for (const item of items) {
    if (item.status === 'conflict') { conflict++; continue; }
    if (item.status === 'failed' && item.attempts >= 6) { failed++; continue; }
    if (item.status === 'failed' && item.updatedAt > Date.now() - retryDelayMs(item.attempts)) { failed++; continue; }
    try {
      const c = requireSupabase(); const p = item.payload as Record<string, unknown>;
      if (item.table === '__rpc__') await invokeQueuedRpc(p);
      else { const { match, dbPayload } = splitQueuedPayload(p); const base = c.from(item.table); if (item.operation === 'insert') { const { error } = await base.insert(dbPayload); if (error) throw error; }
        else if (item.operation === 'upsert') { const { error } = await base.upsert(dbPayload); if (error) throw error; }
        else if (item.operation === 'update') { const { error } = await applyQueuedMatch(base.update(dbPayload), match, item.entityId); if (error) throw error; }
        else if (item.operation === 'delete') { const { error } = await applyQueuedMatch(base.delete(), match, item.entityId); if (error) throw error; }
      }
      await queueRemove(item.operationId);
      if (item.table === '__rpc__') {
        const rpcName = String((item.payload as any)?.name ?? '');
        if (rpcName === 'update_shared_note_with_version') await invalidateCachesForTable('shared_notes');
        if (rpcName === 'set_group_leader') await invalidateCachesForTable('groups');
      } else {
        await invalidateCachesForTable(item.table);
      }
    } catch (error) {
      const next: SyncQueueItem = { ...item, status: (isConflictError(error) ? 'conflict' : 'failed'), attempts: item.attempts + 1, lastError: error instanceof Error ? error.message : String(error), updatedAt: Date.now() };
      await queuePush(next); if (next.status === 'conflict') conflict++; else { failed++; pending++; }
    }
  }
  try {
    const cursor = Number((await metaGet<number>('syncCursor')) ?? 0);
    const { data, error } = await requireSupabase().rpc('pull_sync_events', { p_cursor: cursor, p_limit: 200 });
    if (!error && Array.isArray(data) && data.length) { const events = (data as Array<SyncEvent & { next_cursor?: number }>).map(r => ({ ...r, cursor: Number(r.cursor ?? r.next_cursor ?? 0) })).sort((a,b)=>a.cursor-b.cursor); const validEvents = events.filter(e => e.cursor > 0); if (validEvents.length) { for (const event of validEvents) await invalidateCachesForTable(event.table_name); await metaSet('syncCursor', validEvents[validEvents.length - 1].cursor); await metaSet('syncLastEvents', validEvents.slice(-20)); } }
  } catch { /* older database without the cursor function remains usable */ }
  await metaSet('lastSyncAt', now()); broadcastSyncEvent(); return { pending, failed, conflict };
}
export async function syncNow() {
  if (syncPromise) return syncPromise;
  syncPromise = (async () => {
    const locks = (navigator as Navigator & { locks?: { request: <T>(name: string, callback: () => Promise<T>) => Promise<T> } }).locks;
    if (locks) return locks.request('inside-code-sync', runSyncLocked);
    const lockKey = 'syncLock'; const current = await metaGet<number>(lockKey); if (current && current > Date.now() - 15000) return queueState(); await metaSet(lockKey, Date.now()); try { return await runSyncLocked(); } finally { await metaSet(lockKey, 0); }
  })().finally(() => { syncPromise = null; });
  return syncPromise;
}
export async function lastSyncAt() { return metaGet<string>('lastSyncAt'); }
export function subscribeNotificationPopups(onNotification: (notification: Notification) => void) {
  const client = supabase;
  if (!client) return () => {};
  const channel = client.channel(`inside-code-notification-popups-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event:'INSERT', schema:'public', table:'notifications' }, (payload) => {
      const row = payload.new as Notification;
      void currentUserId().then(uid => { if (uid && row.user_id === uid) onNotification(row); });
    }).subscribe();
  return () => { void client.removeChannel(channel); };
}

export function subscribeRealtime(onChange: () => void) {
  const client = supabase;
  if (!client) return () => {};
  const channel = client.channel('inside-code-events').on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, onChange).subscribe();
  return () => { void client.removeChannel(channel); };
}
