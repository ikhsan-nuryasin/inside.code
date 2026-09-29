import { DEMO_MODE, requireSupabase, supabase } from './supabase';
import {
  cacheGet, cacheSet, cacheRemoveByPrefixes, metaGet, metaSet, queueAll, queuePush, queueRemove,
  localFileGet, localFileSet, localFileRemove, broadcastSyncEvent,
} from './offline';
import { semester3ScheduleTemplate } from './schedule-template';
import {
  demoAlbums, demoAnnouncements, demoAssignments, demoCashAccount, demoCashDues, demoCashPayments,
  demoCashTx, demoClasses, demoChecklist, demoFiles, demoGroupMembers, demoGroupTasks, demoGroups,
  demoMaterials, demoMembers, demoNotes, demoNotifications, demoPhotos, demoPollOptions, demoPolls,
  demoPosts, demoProfile, demoSchedules, demoSharedNotes, demoSubjects, demoTopics, demoClassPositions, demoBugReports,
  demoClassEvents, demoActivityLogs, demoAdminNotes, demoRandomizerHistory, demoAssignmentFiles, demoMaterialFiles, demoForumReports, demoPollVotes,
} from './demo';
import type {
  AdminNote, Album, Announcement, Assignment, CashAccount, CashDue, CashPayment, CashSummary,
  CashTransaction, ChecklistItem, ChecklistProgress, ClassMember, ClassRecord, ClassPosition, ClassPositionRecord,
  AssignmentFile, FileRecord, ForumPost, ForumReport, ForumTopic, GroupMember, GroupRecord, GroupTask, Material, MaterialFile,
  Notification, PersonalNote, Photo, Poll, PollOption, Profile, Schedule, SearchResult, SharedNote, Subject,
  SyncEvent, SyncQueueItem, RandomizerHistoryRecord, ClassEvent, ClassEventType, ActivityLog, BugReport, BugReportCategory, BugSeverity,
} from '../types/models';

const now = () => new Date().toISOString();
const localDateISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
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

function queueWrite(table: string, entityId: string, payload: Record<string, unknown>, operation: SyncQueueItem['operation'] = 'upsert', error?: unknown) {
  return queuePush({
    operationId: uuid(), table, entityId, operation, payload, status: 'pending', attempts: 0,
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
  if (DEMO_MODE) return demoProfile.id;
  const { data } = await requireSupabase().auth.getSession();
  return data.session?.user.id ?? null;
}

export async function getProfile(): Promise<Profile | null> {
  if (DEMO_MODE) return demoProfile;
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
  if (DEMO_MODE) { Object.assign(demoProfile, row); return demoProfile; }
  return tryMutation(row, 'profiles', 'update', async () => {
    const { data, error } = await requireSupabase().from('profiles').update({ full_name: row.full_name, nim: row.nim, major: row.major, semester: row.semester }).eq('id', uid).select().single();
    if (error) throw error;
    await cacheSet(`profile:${uid}`, data as Profile);
    return data as Profile;
  }, async () => { await cacheSet(`profile:${uid}`, { ...row, avatar_path: null } as Profile); });
}

export async function getClassPosition(classId: string): Promise<ClassPositionRecord | null> {
  if (DEMO_MODE) return demoClassPositions.find(p => p.class_id === classId && p.user_id === demoProfile.id) ?? null;
  const uid = await currentUserId(); if (!uid) return null;
  const { data, error } = await requireSupabase().from('class_positions').select('id,class_id,user_id,position,assigned_by,created_at,updated_at').eq('class_id', classId).eq('user_id', uid).maybeSingle();
  if (error) throw error;
  return data as ClassPositionRecord | null;
}

export async function listClassPositions(classId: string): Promise<ClassPositionRecord[]> {
  if (DEMO_MODE) return demoClassPositions.filter(p => p.class_id === classId).map(p => ({ ...p }));
  const key = `positions:${classId}`;
  return cachedList(key, async () => {
    const { data, error } = await requireSupabase().from('class_positions').select('id,class_id,user_id,position,assigned_by,created_at,updated_at,profiles!inner(full_name,nim)').eq('class_id', classId).order('position');
    if (error) throw error;
    return (data ?? []).map((r: any) => ({ ...r, full_name: r.profiles?.full_name, nim: r.profiles?.nim })) as ClassPositionRecord[];
  });
}

export async function listMyClassPositions(): Promise<ClassPositionRecord[]> {
  if (DEMO_MODE) return demoClassPositions.filter(p => p.user_id === demoProfile.id).map(p => ({ ...p }));
  const uid = await currentUserId();
  if (!uid) return [];
  return cachedList(`positions:self:${uid}`, async () => {
    const { data, error } = await requireSupabase().from('class_positions').select('id,class_id,user_id,position,assigned_by,created_at,updated_at').eq('user_id', uid).order('updated_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as ClassPositionRecord[];
  });
}

export async function assignClassPosition(classId: string, userId: string, position: ClassPosition) {
  if (DEMO_MODE) {
    const existing = demoClassPositions.find(p => p.class_id === classId && p.position === position);
    if (existing) throw new Error('POSITION_ALREADY_ASSIGNED');
    const old = demoClassPositions.findIndex(p => p.class_id === classId && p.user_id === userId); if (old >= 0) demoClassPositions.splice(old, 1);
    const member = demoMembers.find(m => m.class_id === classId && m.user_id === userId);
    const row: ClassPositionRecord = { id: uuid(), class_id: classId, user_id: userId, position, assigned_by: demoProfile.id, created_at: now(), updated_at: now(), full_name: member?.full_name, nim: member?.nim ?? null };
    demoClassPositions.push(row); return row;
  }
  const { data, error } = await requireSupabase().rpc('assign_class_position', { p_class_id: classId, p_user_id: userId, p_position: position });
  if (error) throw error; await invalidateCachesForTable('class_positions'); return data as ClassPositionRecord;
}
export async function removeClassPosition(classId: string, userId: string) {
  if (DEMO_MODE) { const i = demoClassPositions.findIndex(p => p.class_id === classId && p.user_id === userId); if (i >= 0) demoClassPositions.splice(i, 1); return; }
  const { error } = await requireSupabase().rpc('remove_class_position', { p_class_id: classId, p_user_id: userId }); if (error) throw error; await invalidateCachesForTable('class_positions');
}

export async function listClasses(): Promise<ClassRecord[]> {
  if (DEMO_MODE) return [...demoClasses];
  const uid = await currentUserId(); if (!uid) return [];
  return cachedList(`classes:${uid}`, async () => {
    const { data, error } = await requireSupabase().from('class_members').select('class_id,role,classes!inner(id,name,class_code,delivery_mode,study_program,semester,academic_year,description,cover_path,deleted_at)').eq('user_id', uid).eq('status', 'active').is('classes.deleted_at', null);
    if (error) throw error;
    return (data ?? []).map((r: any) => ({ ...r.classes, role: r.role })) as ClassRecord[];
  });
}

export async function updateClass(classId: string, payload: { name: string; deliveryMode: 'offline' | 'online'; studyProgram?: string | null; semester?: number | null; academicYear?: string | null; description?: string | null }) {
  if (DEMO_MODE) { const c = demoClasses.find(x => x.id === classId); if (!c) throw new Error('CLASS_NOT_FOUND'); Object.assign(c, { name: payload.name.trim(), delivery_mode: payload.deliveryMode, study_program: payload.studyProgram ?? null, semester: payload.semester ?? null, academic_year: payload.academicYear ?? null, description: payload.description ?? null }); return c; }
  const row = { id: classId, name: payload.name.trim(), delivery_mode: payload.deliveryMode, study_program: payload.studyProgram ?? null, semester: payload.semester ?? null, academic_year: payload.academicYear ?? null, description: payload.description ?? null };
  return tryMutation(row, 'classes', 'update', async () => { const { data, error } = await requireSupabase().from('classes').update({ name: row.name, delivery_mode: row.delivery_mode, study_program: row.study_program, semester: row.semester, academic_year: row.academic_year, description: row.description }).eq('id', classId).select().single(); if (error) throw error; return data as ClassRecord; }, async () => { const uid = await currentUserId(); if (uid) await mergeCachedList(`classes:${uid}`, { ...(demoClasses.find(x=>x.id===classId) ?? row), id: classId } as ClassRecord); });
}

export async function listClassMembers(classId: string): Promise<ClassMember[]> {
  if (DEMO_MODE) return demoMembers.filter(x => x.class_id === classId && x.status === 'active');
  return cachedList(`members:${classId}`, async () => {
    const { data, error } = await requireSupabase().from('class_members').select('id,class_id,user_id,role,status,joined_at,profiles!inner(full_name,nim)').eq('class_id', classId).eq('status', 'active').order('joined_at');
    if (error) throw error;
    return (data ?? []).map((r: any) => ({ ...r, full_name: r.profiles?.full_name, nim: r.profiles?.nim })) as ClassMember[];
  });
}
export async function updateMemberRole(classId: string, userId: string, role: 'admin' | 'member') {
  if (DEMO_MODE) { const m = demoMembers.find(x => x.class_id === classId && x.user_id === userId); if (m) m.role = role; return; }
  const row = { id: uuid(), class_id: classId, user_id: userId, role, __match: { class_id: classId, user_id: userId } };
  await tryMutation(row, 'class_members', 'update', async () => { const { error } = await requireSupabase().from('class_members').update({ role }).eq('class_id', classId).eq('user_id', userId); if (error) throw error; return undefined; });
}
export async function removeMember(classId: string, userId: string) {
  if (DEMO_MODE) { const m = demoMembers.find(x => x.class_id === classId && x.user_id === userId); if (m) m.status = 'removed'; return; }
  const row = { id: uuid(), class_id: classId, user_id: userId, status: 'removed', __match: { class_id: classId, user_id: userId } };
  await tryMutation(row, 'class_members', 'update', async () => { const { error } = await requireSupabase().from('class_members').update({ status: 'removed' }).eq('class_id', classId).eq('user_id', userId); if (error) throw error; return undefined; });
}

export async function listSubjects(classId: string): Promise<Subject[]> {
  if (DEMO_MODE) return demoSubjects.filter(x => x.class_id === classId);
  return cachedList(`subjects:${classId}`, async () => {
    const { data, error } = await requireSupabase().from('subjects').select('id,class_id,name,code,lecturer_code,lecturer_code_secondary,credits,practical_group,description').eq('class_id', classId).is('deleted_at', null).order('name');
    if (error) throw error; return (data ?? []) as Subject[];
  });
}
export async function insertSubject(classId: string, name: string, code?: string | null, details?: { lecturerCode?: string | null; lecturerCodeSecondary?: string | null; credits?: number | null; practicalGroup?: string | null }) {
  const uid = await currentUserId(); if (!uid) throw new Error('UNAUTHENTICATED');
  const row = { id: uuid(), class_id: classId, name: name.trim(), code: code?.trim() || null, lecturer_code: details?.lecturerCode ?? null, lecturer_code_secondary: details?.lecturerCodeSecondary ?? null, credits: details?.credits ?? null, practical_group: details?.practicalGroup ?? null };
  if (DEMO_MODE) { const item = row as Subject; demoSubjects.push(item); return item; }
  return tryMutation(row, 'subjects', 'insert', async () => { const { data, error } = await requireSupabase().from('subjects').insert(row).select().single(); if (error) throw error; return data as Subject; });
}
export async function updateSubject(id: string, payload: Partial<Pick<Subject, 'name' | 'code' | 'lecturer_code' | 'lecturer_code_secondary' | 'credits' | 'practical_group' | 'description'>>) {
  const row = { id, ...payload, ...(payload.name !== undefined ? { name: payload.name.trim() } : {}), ...(payload.code !== undefined ? { code: payload.code?.trim() || null } : {}) };
  if (DEMO_MODE) { const s = demoSubjects.find(x => x.id === id); if (!s) throw new Error('SUBJECT_NOT_FOUND'); Object.assign(s, row); return s; }
  return tryMutation(row, 'subjects', 'update', async () => { const { data, error } = await requireSupabase().from('subjects').update(payload).eq('id', id).select().single(); if (error) throw error; return data as Subject; });
}
export async function deleteSubject(id: string) {
  if (DEMO_MODE) { const s = demoSubjects.find(x => x.id === id); if (s) (s as any).deleted_at = now(); return; }
  const row = { id, deleted_at: now() };
  await tryMutation(row, 'subjects', 'update', async () => { const { error } = await requireSupabase().from('subjects').update({ deleted_at: row.deleted_at }).eq('id', id); if (error) throw error; return undefined; });
}
export async function listSchedules(classId: string): Promise<Schedule[]> {
  if (DEMO_MODE) return demoSchedules.filter(x => demoSubjects.some(s => s.id === x.subject_id && s.class_id === classId));
  const subjects = await listSubjects(classId); if (!subjects.length) return [];
  return cachedList(`schedules:${classId}`, async () => {
    const { data, error } = await requireSupabase().from('schedules').select('id,subject_id,day_of_week,starts_at,ends_at,room,location,meeting_url,notes').in('subject_id', subjects.map(s => s.id)).is('deleted_at', null).order('day_of_week').order('starts_at');
    if (error) throw error;
    return (data ?? []).map((r: any) => ({ ...r, subject: subjects.find(s => s.id === r.subject_id) })) as Schedule[];
  });
}
export async function listCrossClassSchedules(): Promise<Schedule[]> {
  if (DEMO_MODE) return demoSchedules.filter(s => !((s as Schedule & {deleted_at?:string}).deleted_at)).map(s => { const subject=demoSubjects.find(x=>x.id===s.subject_id); return { ...s, class_id: subject?.class_id, class_name: demoClasses.find(c=>c.id===subject?.class_id)?.name, subject }; });
  return cachedList('schedule:all', async () => {
    const { data, error } = await requireSupabase().from('schedules').select('id,subject_id,day_of_week,starts_at,ends_at,room,location,meeting_url,notes,subjects!inner(id,class_id,name,code,classes!inner(id,name))').is('deleted_at', null).order('day_of_week').order('starts_at');
    if (error) throw error;
    return (data ?? []).map((r: any) => ({ ...r, subject: r.subjects, class_id: r.subjects?.class_id, class_name: r.subjects?.classes?.name })) as Schedule[];
  });
}
export async function insertSchedule(subjectId: string, payload: { day: number; start: string; end: string; room?: string; location?: string; meetingUrl?: string; notes?: string }) {
  const row = { id: uuid(), subject_id: subjectId, day_of_week: payload.day, starts_at: payload.start, ends_at: payload.end, room: payload.room || null, location: payload.location || null, meeting_url: payload.meetingUrl || null, notes: payload.notes || null };
  if (DEMO_MODE) { const value = { ...row, subject: demoSubjects.find(s => s.id === subjectId) }; demoSchedules.push(value as Schedule); return value as Schedule; }
  return tryMutation(row, 'schedules', 'insert', async () => { const { data, error } = await requireSupabase().from('schedules').insert(row).select().single(); if (error) throw error; return data as Schedule; });
}
export async function updateSchedule(id: string, payload: Partial<{ subject_id: string; day_of_week: number; starts_at: string; ends_at: string; room: string | null; location: string | null; meeting_url: string | null; notes: string | null }>) {
  const row = { id, ...payload };
  if (DEMO_MODE) { const s = demoSchedules.find(x => x.id === id); if (!s) throw new Error('SCHEDULE_NOT_FOUND'); Object.assign(s, payload); s.subject = demoSubjects.find(x => x.id === s.subject_id); return s; }
  return tryMutation(row, 'schedules', 'update', async () => { const { data, error } = await requireSupabase().from('schedules').update(payload).eq('id', id).select().single(); if (error) throw error; return data as Schedule; });
}
export async function deleteSchedule(id: string) {
  if (DEMO_MODE) { const s = demoSchedules.find(x => x.id === id); if (s) (s as any).deleted_at = now(); return; }
  const row = { id, deleted_at: now() };
  await tryMutation(row, 'schedules', 'update', async () => { const { error } = await requireSupabase().from('schedules').update({ deleted_at: row.deleted_at }).eq('id', id); if (error) throw error; return undefined; });
}

export async function listClassEvents(classId: string): Promise<ClassEvent[]> {
  if (DEMO_MODE) return demoClassEvents.filter((e: ClassEvent) => e.class_id === classId && !('deleted_at' in e)).slice().sort((a: ClassEvent,b: ClassEvent)=>new Date(a.starts_at).getTime()-new Date(b.starts_at).getTime());
  return cachedList(`class-events:${classId}`, async () => {
    const { data, error } = await requireSupabase().from('class_events').select('id,class_id,created_by,event_type,title,description,starts_at,ends_at,location,meeting_url,pinned,created_at,updated_at').eq('class_id', classId).is('deleted_at', null).order('pinned',{ascending:false}).order('starts_at');
    if (error) throw error;
    return (data ?? []) as ClassEvent[];
  });
}


export async function listAllClassEvents(): Promise<ClassEvent[]> {
  if (DEMO_MODE) return demoClassEvents.filter((e: ClassEvent) => !('deleted_at' in e)).slice().sort((a: ClassEvent,b: ClassEvent)=>new Date(a.starts_at).getTime()-new Date(b.starts_at).getTime()).map((e: ClassEvent)=>({...e,class_name:demoClasses.find(c=>c.id===e.class_id)?.name}));
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
  if (DEMO_MODE) { const e = { ...row, created_at: now(), updated_at: now() } as ClassEvent; demoClassEvents.unshift(e); demoActivityLogs.unshift({ id: uuid(), user_id: uid, class_id: classId, action:'INSERT class event', entity_type:'class_events', entity_id:e.id, metadata:{title:e.title}, created_at:now() }); return e; }
  return tryMutation(row, 'class_events', 'insert', async () => { const { data, error } = await requireSupabase().from('class_events').insert(row).select().single(); if (error) throw error; return data as ClassEvent; });
}
export async function updateClassEvent(id: string, payload: Partial<Pick<ClassEvent,'event_type'|'title'|'description'|'starts_at'|'ends_at'|'location'|'meeting_url'|'pinned'>>) {
  const row = { id, ...payload, updated_at: now() };
  if (DEMO_MODE) { const e = demoClassEvents.find(x=>x.id===id); if(!e) throw new Error('EVENT_NOT_FOUND'); Object.assign(e,payload); return e; }
  return tryMutation(row, 'class_events', 'update', async () => { const { data, error } = await requireSupabase().from('class_events').update(payload).eq('id', id).select().single(); if (error) throw error; return data as ClassEvent; });
}
export async function deleteClassEvent(id: string) {
  const row = { id, deleted_at: now() };
  if (DEMO_MODE) { const e = demoClassEvents.find(x=>x.id===id); if(e)(e as any).deleted_at=row.deleted_at; return; }
  await tryMutation(row, 'class_events', 'update', async () => { const { error } = await requireSupabase().from('class_events').update({ deleted_at: row.deleted_at }).eq('id', id); if (error) throw error; return undefined; });
}

export async function applyScheduleTemplate(classId: string): Promise<number> {
  if (DEMO_MODE) {
    const existingSubjectIds = new Set(demoSubjects.filter(s => s.class_id === classId).map(s => s.id));
    if (demoSchedules.some(s => existingSubjectIds.has(s.subject_id))) return demoSchedules.filter(s => existingSubjectIds.has(s.subject_id)).length;
    const mode = demoClasses.find(c => c.id === classId)?.delivery_mode ?? 'offline';
    semester3ScheduleTemplate.forEach(row => {
      const subjectId = uuid(); const subject: Subject = { id: subjectId, class_id: classId, name: row.subject_name, code: row.course_code, lecturer_code: row.lecturer_code, lecturer_code_secondary: row.lecturer_code_secondary, credits: row.credits, practical_group: row.practical_group };
      demoSubjects.push(subject); demoSchedules.push({ id: uuid(), subject_id: subjectId, day_of_week: row.day_of_week, starts_at: row.starts_at, ends_at: row.ends_at, room: mode === 'offline' ? row.room : null, location: null, meeting_url: null, notes: null, subject });
    }); return semester3ScheduleTemplate.length;
  }
  const { data, error } = await requireSupabase().rpc('apply_schedule_template', { p_class_id: classId }); if (error) throw error; return Number(data ?? 0);
}

export async function listAssignments(classId: string): Promise<Assignment[]> {
  if (DEMO_MODE) return demoAssignments.filter(x => x.class_id === classId);
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
  if (DEMO_MODE) return demoAssignments.map(x => ({ ...x, class_name: demoClasses.find(c => c.id === x.class_id)?.name, subject_name: demoSubjects.find(s => s.id === x.subject_id)?.name }));
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
  if (DEMO_MODE) { const a = { ...row, progress_status: 'not_started' as const }; demoAssignments.unshift(a); return a as Assignment; }
  return tryMutation(row, 'assignments', 'insert', async () => { const { data, error } = await requireSupabase().from('assignments').insert(row).select().single(); if (error) throw error; return data as Assignment; });
}
export async function updateAssignment(id: string, payload: Partial<Pick<Assignment, 'title' | 'description' | 'deadline' | 'priority' | 'subject_id'>>) {
  const row = { id, ...payload, updated_at: now() };
  if (DEMO_MODE) { const a = demoAssignments.find(x => x.id === id); if (!a) throw new Error('TASK_NOT_FOUND'); Object.assign(a, payload); return a; }
  return tryMutation(row, 'assignments', 'update', async () => { const { data, error } = await requireSupabase().from('assignments').update(payload).eq('id', id).select().single(); if (error) throw error; return data as Assignment; });
}
export async function deleteAssignment(id: string) {
  if (DEMO_MODE) { const a = demoAssignments.find(x => x.id === id); if (a) (a as any).deleted_at = now(); return; }
  const row = { id, deleted_at: now() };
  await tryMutation(row, 'assignments', 'update', async () => { const { error } = await requireSupabase().from('assignments').update({ deleted_at: row.deleted_at }).eq('id', id); if (error) throw error; return undefined; });
}
export async function listChecklistItems(assignmentId: string): Promise<ChecklistItem[]> {
  if (DEMO_MODE) return demoChecklist.filter(x => x.assignment_id === assignmentId);
  return cachedList(`checklist:${assignmentId}`, async () => { const { data, error } = await requireSupabase().from('assignment_checklist_items').select('id,assignment_id,title,sort_order').eq('assignment_id', assignmentId).is('deleted_at', null).order('sort_order'); if (error) throw error; return (data ?? []) as ChecklistItem[]; });
}
export async function saveChecklistItem(assignmentId: string, title: string, sortOrder: number, id?: string) {
  const row = { id: id ?? uuid(), assignment_id: assignmentId, title: title.trim(), sort_order: sortOrder };
  if (DEMO_MODE) { const existing = demoChecklist.find(x => x.id === row.id); if (existing) Object.assign(existing, row); else demoChecklist.push(row); return row as ChecklistItem; }
  return tryMutation(row, 'assignment_checklist_items', id ? 'update' : 'insert', async () => {
    const q = requireSupabase().from('assignment_checklist_items'); const result = id ? await q.update({ title: row.title, sort_order: row.sort_order }).eq('id', id).select().single() : await q.insert(row).select().single(); if (result.error) throw result.error; return result.data as ChecklistItem;
  });
}
export async function deleteChecklistItem(id: string) {
  if (DEMO_MODE) { const i = demoChecklist.findIndex(x => x.id === id); if (i >= 0) demoChecklist.splice(i, 1); return; }
  const row = { id, deleted_at: now() }; await tryMutation(row, 'assignment_checklist_items', 'update', async () => { const { error } = await requireSupabase().from('assignment_checklist_items').update({ deleted_at: row.deleted_at }).eq('id', id); if (error) throw error; return undefined; });
}
export async function listChecklistProgress(assignmentId: string): Promise<ChecklistProgress[]> {
  const uid = await currentUserId(); if (!uid) return [];
  if (DEMO_MODE) return demoChecklist.filter(x => x.assignment_id === assignmentId).map(x => ({ checklist_item_id: x.id, user_id: uid, completed: x.id === 'check-1', updated_at: now() }));
  const items = await listChecklistItems(assignmentId); if (!items.length) return [];
  const { data, error } = await requireSupabase().from('checklist_progress').select('checklist_item_id,user_id,completed,updated_at').eq('user_id', uid).in('checklist_item_id', items.map(x => x.id)); if (error) throw error; return (data ?? []) as ChecklistProgress[];
}
export async function setChecklistProgress(itemId: string, completed: boolean) {
  const uid = await currentUserId(); if (!uid) throw new Error('UNAUTHENTICATED');
  const row = { id: uuid(), checklist_item_id: itemId, user_id: uid, completed, updated_at: now() };
  if (DEMO_MODE) return;
  await tryMutation(row, 'checklist_progress', 'upsert', async () => { const { error } = await requireSupabase().from('checklist_progress').upsert(row, { onConflict: 'checklist_item_id,user_id' }); if (error) throw error; return undefined; });
}
export async function setAssignmentProgress(assignmentId: string, status: NonNullable<Assignment['progress_status']>) {
  const uid = await currentUserId(); if (!uid) throw new Error('UNAUTHENTICATED');
  if (DEMO_MODE) { const x = demoAssignments.find(a => a.id === assignmentId); if (x) x.progress_status = status; return; }
  const row = { id: uuid(), assignment_id: assignmentId, user_id: uid, status, updated_at: now() };
  await tryMutation(row, 'assignment_progress', 'upsert', async () => { const { error } = await requireSupabase().from('assignment_progress').upsert(row, { onConflict: 'assignment_id,user_id' }); if (error) throw error; return undefined; });
}

export async function listAssignmentFiles(assignmentId: string): Promise<AssignmentFile[]> {
  if (DEMO_MODE) return demoAssignmentFiles.filter(x => x.assignment_id === assignmentId && demoFiles.some(f=>f.id===x.file_id && !f.deleted_at)).map(x=>({...x,file:demoFiles.find(f=>f.id===x.file_id)}));
  const { data, error } = await requireSupabase().from('assignment_files').select('assignment_id,file_id,sort_order,files(id,uploaded_by,owner_scope,class_id,bucket,storage_path,file_name,mime_type,file_size,checksum,metadata,created_at)').eq('assignment_id', assignmentId).order('sort_order');
  if (error) throw error; return (data ?? []).map((r: any) => ({ assignment_id: r.assignment_id, file_id: r.file_id, sort_order: r.sort_order, file: r.files })) as AssignmentFile[];
}
export async function attachAssignmentFile(assignmentId: string, fileId: string, sortOrder = 0) {
  const row = { assignment_id: assignmentId, file_id: fileId, sort_order: sortOrder };
  if (DEMO_MODE) { const i=demoAssignmentFiles.findIndex(x=>x.assignment_id===assignmentId && x.file_id===fileId); if(i>=0) demoAssignmentFiles[i]=row; else demoAssignmentFiles.push(row); return row; }
  const queuedRow = { ...row, __match: { assignment_id: assignmentId, file_id: fileId } }; return tryMutation(queuedRow, 'assignment_files', 'upsert', async () => { const { error } = await requireSupabase().from('assignment_files').upsert(row); if (error) throw error; return row; });
}
export async function detachAssignmentFile(assignmentId: string, fileId: string) {
  if (DEMO_MODE) { const i=demoAssignmentFiles.findIndex(x=>x.assignment_id===assignmentId && x.file_id===fileId); if(i>=0) demoAssignmentFiles.splice(i,1); return; }
  const row = { __match: { assignment_id: assignmentId, file_id: fileId } }; await tryMutation({ id: `${assignmentId}:${fileId}`, ...row }, 'assignment_files', 'delete', async () => { const { error } = await requireSupabase().from('assignment_files').delete().eq('assignment_id', assignmentId).eq('file_id', fileId); if (error) throw error; return undefined; });
}

export async function listMaterials(classId: string): Promise<Material[]> {
  if (DEMO_MODE) return demoMaterials.filter(x => x.class_id === classId);
  return cachedList(`materials:${classId}`, async () => { const { data, error } = await requireSupabase().from('materials').select('id,class_id,subject_id,title,description,material_type,external_url,created_at,updated_at').eq('class_id', classId).is('deleted_at', null).order('created_at', { ascending: false }); if (error) throw error; return (data ?? []) as Material[]; });
}
export async function createMaterial(classId: string, payload: { title: string; description?: string; type: string; subjectId?: string | null; externalUrl?: string | null }) {
  const uid = await currentUserId(); if (!uid) throw new Error('UNAUTHENTICATED');
  const row = { id: uuid(), class_id: classId, subject_id: payload.subjectId ?? null, created_by: uid, title: payload.title.trim(), description: payload.description?.trim() || null, material_type: payload.type, external_url: payload.externalUrl || null };
  if (DEMO_MODE) { const m = { ...row, created_at: now() } as Material; demoMaterials.unshift(m); return m; }
  return tryMutation(row, 'materials', 'insert', async () => { const { data, error } = await requireSupabase().from('materials').insert(row).select().single(); if (error) throw error; return data as Material; });
}
export async function updateMaterial(id: string, payload: Partial<Pick<Material, 'title' | 'description' | 'material_type' | 'external_url' | 'subject_id'>>) {
  if (DEMO_MODE) { const m = demoMaterials.find(x => x.id === id); if (!m) throw new Error('MATERIAL_NOT_FOUND'); Object.assign(m, payload); return m; }
  const row = { id, ...payload }; return tryMutation(row, 'materials', 'update', async () => { const { data, error } = await requireSupabase().from('materials').update(payload).eq('id', id).select().single(); if (error) throw error; return data as Material; });
}
export async function deleteMaterial(id: string) {
  if (DEMO_MODE) { const m = demoMaterials.find(x => x.id === id); if (m) (m as any).deleted_at = now(); return; }
  const row = { id, deleted_at: now() }; await tryMutation(row, 'materials', 'update', async () => { const { error } = await requireSupabase().from('materials').update({ deleted_at: row.deleted_at }).eq('id', id); if (error) throw error; return undefined; });
}
export async function listMaterialFiles(materialId: string): Promise<MaterialFile[]> {
  if (DEMO_MODE) return demoMaterialFiles.filter(x => x.material_id === materialId && demoFiles.some(f=>f.id===x.file_id && !f.deleted_at)).map(x=>({...x,file:demoFiles.find(f=>f.id===x.file_id)}));
  const { data, error } = await requireSupabase().from('material_files').select('material_id,file_id,sort_order,files(id,uploaded_by,owner_scope,class_id,bucket,storage_path,file_name,mime_type,file_size,checksum,metadata,created_at)').eq('material_id', materialId).order('sort_order');
  if (error) throw error; return (data ?? []).map((r: any) => ({ material_id: r.material_id, file_id: r.file_id, sort_order: r.sort_order, file: r.files })) as MaterialFile[];
}
export async function attachMaterialFile(materialId: string, fileId: string, sortOrder = 0) { const row={ material_id: materialId, file_id: fileId, sort_order: sortOrder }; if (DEMO_MODE) { const i=demoMaterialFiles.findIndex(x=>x.material_id===materialId && x.file_id===fileId); if(i>=0) demoMaterialFiles[i]=row; else demoMaterialFiles.push(row); return row; } return tryMutation({ ...row, id: `${materialId}:${fileId}`, __match: { material_id: materialId, file_id: fileId } }, 'material_files', 'upsert', async () => { const { error } = await requireSupabase().from('material_files').upsert(row); if (error) throw error; return row; }); }
export async function detachMaterialFile(materialId: string, fileId: string) { if (DEMO_MODE) { const i=demoMaterialFiles.findIndex(x=>x.material_id===materialId && x.file_id===fileId); if(i>=0) demoMaterialFiles.splice(i,1); return; } const row = { id: `${materialId}:${fileId}`, __match: { material_id: materialId, file_id: fileId } }; await tryMutation(row, 'material_files', 'delete', async () => { const { error } = await requireSupabase().from('material_files').delete().eq('material_id', materialId).eq('file_id', fileId); if (error) throw error; return undefined; }); }

export async function listAnnouncements(classId: string): Promise<Announcement[]> {
  if (DEMO_MODE) return demoAnnouncements.filter(x => x.class_id === classId).map(x => ({ ...x, is_read: x.id === 'ann-1' }));
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
  if (DEMO_MODE) { demoAnnouncements.unshift(row as Announcement); return row as Announcement; }
  return tryMutation(row, 'announcements', 'insert', async () => { const { data, error } = await requireSupabase().from('announcements').insert(row).select().single(); if (error) throw error; return data as Announcement; });
}
export async function updateAnnouncement(id: string, payload: Partial<Pick<Announcement, 'title' | 'content' | 'priority' | 'pinned'>>) { if (DEMO_MODE) { const a = demoAnnouncements.find(x => x.id === id); if (!a) throw new Error('ANNOUNCEMENT_NOT_FOUND'); Object.assign(a, payload); return a; } const row = { id, ...payload }; return tryMutation(row, 'announcements', 'update', async () => { const { data, error } = await requireSupabase().from('announcements').update(payload).eq('id', id).select().single(); if (error) throw error; return data as Announcement; }); }
export async function archiveAnnouncement(id: string) { const archivedAt = now(); if (DEMO_MODE) { const a = demoAnnouncements.find(x => x.id === id); if (a) (a as any).archived_at = archivedAt; return; } const row = { id, archived_at: archivedAt }; await tryMutation(row, 'announcements', 'update', async () => { const { error } = await requireSupabase().from('announcements').update({ archived_at: archivedAt }).eq('id', id); if (error) throw error; return undefined; }); }
export async function markAnnouncementRead(announcementId: string) {
  const uid = await currentUserId(); if (!uid) return;
  const row = { id: uuid(), announcement_id: announcementId, user_id: uid, read_at: now() };
  if (DEMO_MODE) return;
  await tryMutation(row, 'announcement_reads', 'upsert', async () => { const { error } = await requireSupabase().from('announcement_reads').upsert(row, { onConflict: 'announcement_id,user_id' }); if (error) throw error; return undefined; });
}

export async function listForumTopics(classId: string): Promise<ForumTopic[]> {
  if (DEMO_MODE) return demoTopics.filter(x => x.class_id === classId);
  return cachedList(`forum:topics:${classId}`, async () => {
    const { data, error } = await requireSupabase().from('forum_topics').select('id,class_id,created_by,title,category,pinned,created_at,updated_at,profiles!inner(full_name),forum_posts(count)').eq('class_id', classId).is('deleted_at', null).order('pinned', { ascending: false }).order('updated_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((x: any) => ({ ...x, creator_name: x.profiles?.full_name, post_count: x.forum_posts?.[0]?.count ?? 0 })) as ForumTopic[];
  });
}
export async function createForumTopic(classId: string, title: string, category: string) { const uid = await currentUserId(); if (!uid) throw new Error('UNAUTHENTICATED'); const row = { id: uuid(), class_id: classId, created_by: uid, title: title.trim(), category, pinned: false }; if (DEMO_MODE) { const t = { ...row, created_at: now(), updated_at: now(), creator_name: demoProfile.full_name, post_count: 0 }; demoTopics.unshift(t); return t; } return tryMutation(row, 'forum_topics', 'insert', async () => { const { data, error } = await requireSupabase().from('forum_topics').insert(row).select().single(); if (error) throw error; return data as ForumTopic; }); }
export async function updateForumTopic(id: string, payload: Partial<Pick<ForumTopic, 'title' | 'category' | 'pinned'>>) { if (DEMO_MODE) { const t = demoTopics.find(x => x.id === id); if (!t) throw new Error('TOPIC_NOT_FOUND'); Object.assign(t, payload); return t; } const row = { id, ...payload }; return tryMutation(row, 'forum_topics', 'update', async () => { const { data, error } = await requireSupabase().from('forum_topics').update(payload).eq('id', id).select().single(); if (error) throw error; return data as ForumTopic; }); }
export async function deleteForumTopic(id: string) { if (DEMO_MODE) { const t = demoTopics.findIndex(x => x.id === id); if (t >= 0) demoTopics.splice(t, 1); return; } const row = { id, deleted_at: now() }; await tryMutation(row, 'forum_topics', 'update', async () => { const { error } = await requireSupabase().from('forum_topics').update({ deleted_at: row.deleted_at }).eq('id', id); if (error) throw error; return undefined; }); }
export async function listForumPosts(topicId: string): Promise<ForumPost[]> { if (DEMO_MODE) return demoPosts.filter(x => x.topic_id === topicId); const { data, error } = await requireSupabase().from('forum_posts').select('id,topic_id,user_id,parent_id,content,created_at,updated_at,profiles!inner(full_name)').eq('topic_id', topicId).is('deleted_at', null).order('created_at'); if (error) throw error; return (data ?? []).map((x: any) => ({ ...x, author_name: x.profiles?.full_name })) as ForumPost[]; }
export async function createForumPost(topicId: string, content: string, parentId?: string | null) { const uid = await currentUserId(); if (!uid) throw new Error('UNAUTHENTICATED'); const row = { id: uuid(), topic_id: topicId, user_id: uid, parent_id: parentId ?? null, content: content.trim() }; if (DEMO_MODE) { const p = { ...row, created_at: now(), updated_at: now(), author_name: demoProfile.full_name }; demoPosts.push(p); return p; } return tryMutation(row, 'forum_posts', 'insert', async () => { const { data, error } = await requireSupabase().from('forum_posts').insert(row).select().single(); if (error) throw error; return data as ForumPost; }); }
export async function updateForumPost(id: string, content: string) { const row = { id, content: content.trim(), updated_at: now() }; if (DEMO_MODE) { const p = demoPosts.find(x => x.id === id); if (!p) throw new Error('POST_NOT_FOUND'); Object.assign(p, row); return p; } return tryMutation(row, 'forum_posts', 'update', async () => { const { data, error } = await requireSupabase().from('forum_posts').update({ content: row.content }).eq('id', id).select().single(); if (error) throw error; return data as ForumPost; }); }
export async function deleteForumPost(id: string) { if (DEMO_MODE) { const i = demoPosts.findIndex(x => x.id === id); if (i >= 0) demoPosts.splice(i, 1); return; } const row = { id, deleted_at: now() }; await tryMutation(row, 'forum_posts', 'update', async () => { const { error } = await requireSupabase().from('forum_posts').update({ deleted_at: row.deleted_at }).eq('id', id); if (error) throw error; return undefined; }); }
export async function reportForum(topicId: string, postId: string | null, reason: string) { const uid = await currentUserId(); if (!uid) throw new Error('UNAUTHENTICATED'); const row = { id: uuid(), topic_id: topicId, post_id: postId, reporter_id: uid, reason: reason.trim(), status: 'open' as const, review_note: null, reviewed_by: null, reviewed_at: null }; if (DEMO_MODE) { demoForumReports.unshift(row as ForumReport); return row as ForumReport; } return tryMutation(row, 'forum_reports', 'insert', async () => { const { data, error } = await requireSupabase().from('forum_reports').insert(row).select().single(); if (error) throw error; return data as ForumReport; }); }
export async function listForumReports(classId: string): Promise<ForumReport[]> { if (DEMO_MODE) { const topicIds=new Set(demoTopics.filter(t=>t.class_id===classId).map(t=>t.id)); return demoForumReports.filter(r=>topicIds.has(r.topic_id)); } const { data, error } = await requireSupabase().from('forum_reports').select('id,topic_id,post_id,reporter_id,reason,status,review_note,reviewed_by,reviewed_at,created_at').in('topic_id', (await listForumTopics(classId)).map(t => t.id)).order('created_at', { ascending: false }); if (error) throw error; return (data ?? []) as ForumReport[]; }
export async function reviewForumReport(id: string, status: ForumReport['status'], reviewNote?: string) { const uid = await currentUserId(); if (!uid) throw new Error('UNAUTHENTICATED'); if (DEMO_MODE) { const r=demoForumReports.find(x=>x.id===id); if(!r) throw new Error('REPORT_NOT_FOUND'); Object.assign(r,{status,review_note:reviewNote?.trim()||null,reviewed_by:uid,reviewed_at:now()}); return r; } const { error } = await requireSupabase().from('forum_reports').update({ status, review_note: reviewNote?.trim() || null, reviewed_by: uid, reviewed_at: now() }).eq('id', id); if (error) throw error; }

export async function listGroups(classId: string): Promise<GroupRecord[]> { if (DEMO_MODE) return demoGroups.filter(x => x.class_id === classId).map(x => ({ ...x })); return cachedList(`groups:${classId}`, async () => { const { data, error } = await requireSupabase().from('groups').select('id,class_id,name,description,created_by,leader_user_id,created_at').eq('class_id', classId).is('deleted_at', null).order('created_at'); if (error) throw error; return (data ?? []) as GroupRecord[]; }); }
export async function setGroupLeader(groupId: string, userId: string | null) {
  if (DEMO_MODE) { const g = demoGroups.find(x => x.id === groupId); if (g) { g.leader_user_id = userId; g.leader_name = demoGroupMembers.find(m => m.group_id === groupId && m.user_id === userId)?.full_name ?? null; } return g ?? null; }
  const { data, error } = await requireSupabase().rpc('set_group_leader', { p_group_id: groupId, p_user_id: userId }); if (error) throw error; await invalidateCachesForTable('groups'); return data as GroupRecord;
}
export async function createGroup(classId: string, name: string, description?: string) { const uid = await currentUserId(); if (!uid) throw new Error('UNAUTHENTICATED'); const row = { id: uuid(), class_id: classId, name: name.trim(), description: description?.trim() || null, created_by: uid }; if (DEMO_MODE) { const g = { ...row, created_at: now() }; demoGroups.push(g); return g as GroupRecord; } return tryMutation(row, 'groups', 'insert', async () => { const { data, error } = await requireSupabase().from('groups').insert(row).select().single(); if (error) throw error; return data as GroupRecord; }); }
export async function updateGroup(id: string, payload: Pick<Partial<GroupRecord>, 'name' | 'description'>) { if (DEMO_MODE) { const g = demoGroups.find(x => x.id === id); if (!g) throw new Error('GROUP_NOT_FOUND'); Object.assign(g, payload); return g; } const { data, error } = await requireSupabase().from('groups').update(payload).eq('id', id).select().single(); if (error) throw error; return data as GroupRecord; }
export async function deleteGroup(id: string) { if (DEMO_MODE) { const g = demoGroups.find(x => x.id === id); if (g) (g as any).deleted_at = now(); return; } const { error } = await requireSupabase().from('groups').update({ deleted_at: now() }).eq('id', id); if (error) throw error; }
export async function listGroupMembers(groupId: string): Promise<GroupMember[]> { if (DEMO_MODE) return demoGroupMembers.filter(x => x.group_id === groupId); return cachedList(`group-members:${groupId}`, async () => { const { data, error } = await requireSupabase().from('group_members').select('id,group_id,user_id,profiles!inner(full_name,nim)').eq('group_id', groupId).order('joined_at'); if (error) throw error; return (data ?? []).map((x: any) => ({ ...x, full_name: x.profiles?.full_name, nim: x.profiles?.nim })) as GroupMember[]; }); }
export async function addGroupMember(groupId: string, userId: string) { if (DEMO_MODE) { if (!demoGroupMembers.some(x => x.group_id === groupId && x.user_id === userId)) demoGroupMembers.push({ id: uuid(), group_id: groupId, user_id: userId, full_name: demoMembers.find(m => m.user_id === userId)?.full_name, nim: demoMembers.find(m => m.user_id === userId)?.nim }); return; } const row = { id: uuid(), group_id: groupId, user_id: userId }; await tryMutation(row, 'group_members', 'insert', async () => { const { error } = await requireSupabase().from('group_members').insert({ group_id: groupId, user_id: userId }); if (error) throw error; return undefined; }); }
export async function removeGroupMember(groupId: string, userId: string) { if (DEMO_MODE) { const i = demoGroupMembers.findIndex(x => x.group_id === groupId && x.user_id === userId); if (i >= 0) demoGroupMembers.splice(i, 1); return; } const row = { id: `${groupId}:${userId}`, group_id: groupId, user_id: userId, __match: { group_id: groupId, user_id: userId } }; await tryMutation(row, 'group_members', 'delete', async () => { const { error } = await requireSupabase().from('group_members').delete().eq('group_id', groupId).eq('user_id', userId); if (error) throw error; return undefined; }); }
export async function listGroupTasks(groupId: string): Promise<GroupTask[]> { if (DEMO_MODE) return demoGroupTasks.filter(x => x.group_id === groupId); return cachedList(`group-tasks:${groupId}`, async () => { const { data, error } = await requireSupabase().from('group_tasks').select('id,group_id,title,description,assigned_to,completed,deadline').eq('group_id', groupId).is('deleted_at', null).order('deadline'); if (error) throw error; return (data ?? []) as GroupTask[]; }); }
export async function createGroupTask(groupId: string, payload: { title: string; description?: string; assignedTo?: string | null; deadline?: string | null }) { const row = { id: uuid(), group_id: groupId, title: payload.title.trim(), description: payload.description?.trim() || null, assigned_to: payload.assignedTo ?? null, completed: false, deadline: payload.deadline ?? null }; if (DEMO_MODE) { const t = row as GroupTask; demoGroupTasks.push(t); return t; } return tryMutation(row, 'group_tasks', 'insert', async () => { const { data, error } = await requireSupabase().from('group_tasks').insert(row).select().single(); if (error) throw error; return data as GroupTask; }); }
export async function updateGroupTask(id: string, payload: Partial<Pick<GroupTask, 'title' | 'description' | 'assigned_to' | 'deadline' | 'completed'>>) { if (DEMO_MODE) { const t = demoGroupTasks.find(x => x.id === id); if (!t) throw new Error('GROUP_TASK_NOT_FOUND'); Object.assign(t, payload); return t; } const row = { id, ...payload }; return tryMutation(row, 'group_tasks', 'update', async () => { const { data, error } = await requireSupabase().from('group_tasks').update(payload).eq('id', id).select().single(); if (error) throw error; return data as GroupTask; }); }
export async function deleteGroupTask(id: string) { if (DEMO_MODE) { const i = demoGroupTasks.findIndex(x => x.id === id); if (i >= 0) demoGroupTasks.splice(i, 1); return; } const row = { id, deleted_at: now() }; await tryMutation(row, 'group_tasks', 'update', async () => { const { error } = await requireSupabase().from('group_tasks').update({ deleted_at: row.deleted_at }).eq('id', id); if (error) throw error; return undefined; }); }
export async function toggleGroupTask(task: GroupTask) { return updateGroupTask(task.id, { completed: !task.completed }); }

export async function listPolls(classId: string): Promise<Poll[]> { if (DEMO_MODE) return demoPolls.filter(x => x.class_id === classId); return cachedList(`polls:${classId}`, async () => { const { data, error } = await requireSupabase().from('polls').select('id,class_id,created_by,title,description,closes_at,is_anonymous,is_decision,closed,created_at').eq('class_id', classId).is('deleted_at', null).order('created_at', { ascending: false }); if (error) throw error; return (data ?? []) as Poll[]; }); }
export async function listPollOptions(pollId: string): Promise<PollOption[]> { if (DEMO_MODE) return demoPollOptions.filter(x => x.poll_id === pollId); const { data, error } = await requireSupabase().from('poll_options').select('id,poll_id,label,sort_order,poll_votes(count)').eq('poll_id', pollId).order('sort_order'); if (error) throw error; return (data ?? []).map((o: any) => ({ ...o, votes: o.poll_votes?.[0]?.count ?? 0 })) as PollOption[]; }
export async function listPollOptionsBatch(pollIds: string[]): Promise<Record<string, PollOption[]>> {
  if (!pollIds.length) return {};
  if (DEMO_MODE) {
    return Object.fromEntries(pollIds.map(id => [id, demoPollOptions.filter(x => x.poll_id === id).slice().sort((a,b)=>a.sort_order-b.sort_order)]));
  }
  const { data, error } = await requireSupabase().from('poll_options').select('id,poll_id,label,sort_order,poll_votes(count)').in('poll_id', pollIds).order('sort_order');
  if (error) throw error;
  const grouped: Record<string, PollOption[]> = {};
  for (const row of (data ?? []) as any[]) {
    const item = { ...row, votes: row.poll_votes?.[0]?.count ?? 0 } as PollOption;
    (grouped[item.poll_id] ??= []).push(item);
  }
  return grouped;
}
export async function listMyPollVote(pollId: string): Promise<PollVoteLike | null> { const uid = await currentUserId(); if (!uid || DEMO_MODE) return null; const { data, error } = await requireSupabase().from('poll_votes').select('id,poll_id,poll_option_id,user_id,created_at').eq('poll_id', pollId).eq('user_id', uid).maybeSingle(); if (error) throw error; return data as PollVoteLike | null; }
export async function listMyPollVotes(pollIds: string[]): Promise<Record<string, PollVoteLike | null>> {
  const uid = await currentUserId();
  if (!uid || !pollIds.length) return {};
  if (DEMO_MODE) return Object.fromEntries(pollIds.map(id => { const vote=demoPollVotes.find(v=>v.poll_id===id&&v.user_id===uid); return [id, vote ?? null]; }));
  const { data, error } = await requireSupabase().from('poll_votes').select('id,poll_id,poll_option_id,user_id,created_at').eq('user_id', uid).in('poll_id', pollIds);
  if (error) throw error;
  return Object.fromEntries(pollIds.map(id => [id, (data ?? []).find((v:any)=>v.poll_id===id) as PollVoteLike | undefined ?? null]));
}
type PollVoteLike = { id: string; poll_id: string; poll_option_id: string; user_id: string; created_at: string };
export async function createPoll(classId: string, title: string, description: string, closesAt: string | null, anonymous: boolean, options: string[], isDecision = false) { const uid = await currentUserId(); if (!uid) throw new Error('UNAUTHENTICATED'); const clean = [...new Set(options.map(x => x.trim()).filter(Boolean))]; if (clean.length < 2) throw new Error('MIN_TWO_POLL_OPTIONS'); const id = uuid(); const row = { id, class_id: classId, created_by: uid, title: title.trim(), description: description.trim() || null, closes_at: closesAt, is_anonymous: anonymous, is_decision: isDecision, closed: false }; if (DEMO_MODE) { const poll = { ...row, created_at: now() }; demoPolls.unshift(poll); clean.forEach((label, i) => demoPollOptions.push({ id: uuid(), poll_id: id, label, sort_order: i + 1, votes: 0 })); return poll as Poll; } const { data, error } = await requireSupabase().from('polls').insert(row).select().single(); if (error) throw error; const { error: oe } = await requireSupabase().from('poll_options').insert(clean.map((label, i) => ({ id: uuid(), poll_id: id, label, sort_order: i + 1 }))); if (oe) throw oe; return data as Poll; }
export async function votePoll(pollId: string, optionId: string) { const uid = await currentUserId(); if (!uid) throw new Error('UNAUTHENTICATED'); if (DEMO_MODE) { if (demoPollVotes.some(v=>v.poll_id===pollId&&v.user_id===uid)) throw new Error('POLL_ALREADY_VOTED'); const o = demoPollOptions.find(x => x.id === optionId); if (o) { o.votes = (o.votes ?? 0) + 1; demoPollVotes.push({id:uuid(),poll_id:pollId,poll_option_id:optionId,user_id:uid,created_at:now()}); } return; } const row = { id: uuid(), poll_id: pollId, poll_option_id: optionId, user_id: uid }; await tryMutation(row, 'poll_votes', 'insert', async () => { const { error } = await requireSupabase().from('poll_votes').insert(row); if (error) throw error; return undefined; }); }
export async function closePoll(id: string) { if (DEMO_MODE) { const p = demoPolls.find(x => x.id === id); if (p) p.closed = true; return; } const row = { id, closed: true }; await tryMutation(row, 'polls', 'update', async () => { const { error } = await requireSupabase().from('polls').update({ closed: true }).eq('id', id); if (error) throw error; return undefined; }); }

export async function getCashAccount(classId: string): Promise<CashAccount> { if (DEMO_MODE) return demoCashAccount; const { data, error } = await requireSupabase().from('cash_accounts').select('id,class_id').eq('class_id', classId).single(); if (error) throw error; return data as CashAccount; }
export async function getCashSummary(classId: string): Promise<CashSummary> { if (DEMO_MODE) { const total_income = demoCashTx.filter(x => x.transaction_type === 'income').reduce((a, b) => a + Number(b.amount), 0); const total_expense = demoCashTx.filter(x => x.transaction_type === 'expense').reduce((a, b) => a + Number(b.amount), 0); return { total_income, total_expense, balance: total_income - total_expense }; } const { data, error } = await requireSupabase().rpc('get_cash_summary', { p_class_id: classId }); if (error) throw error; return (Array.isArray(data) ? data[0] : data) as CashSummary; }
export async function listCashTransactions(accountId: string): Promise<CashTransaction[]> { if (DEMO_MODE) return [...demoCashTx]; return cachedList(`cash-tx:${accountId}`, async () => { const { data, error } = await requireSupabase().from('cash_transactions').select('id,cash_account_id,created_by,transaction_type,amount,category,description,proof_file_id,transaction_date,voided_at,void_reason,reversal_of_transaction_id,correction_reason').eq('cash_account_id', accountId).is('deleted_at', null).order('transaction_date', { ascending: false }).order('created_at', { ascending: false }); if (error) throw error; return (data ?? []) as CashTransaction[]; }); }

function normalizeCashMonth(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('INVALID_CASH_MONTH');
  const [year, rawMonth] = month.split('-').map(Number);
  if (!Number.isInteger(year) || rawMonth < 1 || rawMonth > 12) throw new Error('INVALID_CASH_MONTH');
  return month;
}

export async function listCashTransactionsByMonth(accountId: string, month: string): Promise<CashTransaction[]> {
  const normalized = normalizeCashMonth(month);
  if (DEMO_MODE) return demoCashTx.filter((x) => x.cash_account_id === accountId && x.transaction_date.slice(0, 7) === normalized).slice().sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));
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
  if (DEMO_MODE) {
    const start = `${normalized}-01`;
    const [year, rawMonth] = normalized.split('-').map(Number);
    const end = new Date(Date.UTC(year, rawMonth, 1)).toISOString().slice(0, 10);
    const isLive = (x: CashTransaction) => !x.voided_at;
    const demoAccountId = demoCashAccount.class_id === classId ? demoCashAccount.id : '';
    const classTx = demoCashTx.filter(x => x.cash_account_id === demoAccountId);
    const opening = classTx.filter(isLive).filter(x => x.transaction_date < start).reduce((sum, x) => sum + (x.transaction_type === 'income' ? Number(x.amount) : -Number(x.amount)), 0);
    const inMonth = classTx.filter(isLive).filter(x => x.transaction_date >= start && x.transaction_date < end);
    const total_income = inMonth.filter(x => x.transaction_type === 'income').reduce((sum, x) => sum + Number(x.amount), 0);
    const total_expense = inMonth.filter(x => x.transaction_type === 'expense').reduce((sum, x) => sum + Number(x.amount), 0);
    const net_change = total_income - total_expense;
    return { opening_balance: opening, total_income, total_expense, net_change, closing_balance: opening + net_change, transaction_count: inMonth.length, month_start: start };
  }
  const { data, error } = await requireSupabase().rpc('get_cash_month_summary', { p_class_id: classId, p_month: `${normalized}-01` });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return (row ?? { opening_balance: 0, total_income: 0, total_expense: 0, net_change: 0, closing_balance: 0, transaction_count: 0, month_start: `${normalized}-01` }) as CashMonthlySummary;
}
export async function listCashDues(classId: string): Promise<CashDue[]> { if (DEMO_MODE) return demoCashDues.filter(x => x.class_id === classId); return cachedList(`cash-dues:${classId}`, async () => { const { data, error } = await requireSupabase().from('cash_dues').select('id,class_id,title,amount,due_date,created_by').eq('class_id', classId).is('deleted_at', null).order('due_date', { ascending: false }); if (error) throw error; return (data ?? []) as CashDue[]; }); }
export async function listCashDuesWithPayments(classId: string, month?: string): Promise<Array<CashDue & { payments: CashPayment[] }>> {
  const normalized = month ? normalizeCashMonth(month) : null;
  if (DEMO_MODE) return demoCashDues.filter(x => x.class_id === classId && (!normalized || !!x.due_date && x.due_date.slice(0, 7) === normalized)).map(d => ({ ...d, payments: demoCashPayments.filter(p => p.due_id === d.id) }));
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

export async function listCashPayments(dueId: string): Promise<CashPayment[]> { if (DEMO_MODE) return demoCashPayments.filter(x => x.due_id === dueId); const { data, error } = await requireSupabase().from('cash_payments').select('id,due_id,user_id,amount,status,proof_file_id,paid_at,verified_by,verified_at,rejection_reason,cash_transaction_id').eq('due_id', dueId).is('deleted_at', null); if (error) throw error; return (data ?? []) as CashPayment[]; }
export async function createCashTransaction(classId: string, payload: { type: 'income' | 'expense'; amount: number; category: string; description?: string; date?: string; proofFileId?: string | null }) { const account = await getCashAccount(classId); const uid = await currentUserId(); if (!uid) throw new Error('UNAUTHENTICATED'); const row = { id: uuid(), cash_account_id: account.id, created_by: uid, transaction_type: payload.type, amount: payload.amount, category: payload.category.trim(), description: payload.description?.trim() || null, proof_file_id: payload.proofFileId ?? null, transaction_date: payload.date ?? localDateISO() }; if (DEMO_MODE) { demoCashTx.unshift(row); return row as CashTransaction; } return tryMutation(row, 'cash_transactions', 'insert', async () => { const { data, error } = await requireSupabase().from('cash_transactions').insert(row).select().single(); if (error) throw error; return data as CashTransaction; }); }
export async function createCashDue(classId: string, title: string, amount: number, dueDate: string | null) { const uid = await currentUserId(); if (!uid) throw new Error('UNAUTHENTICATED'); const row = { id: uuid(), class_id: classId, title: title.trim(), amount, due_date: dueDate, created_by: uid }; if (DEMO_MODE) { demoCashDues.unshift(row); return row; } return tryMutation(row, 'cash_dues', 'insert', async () => { const { data, error } = await requireSupabase().from('cash_dues').insert(row).select().single(); if (error) throw error; return data as CashDue; }); }
export async function createCashPayment(dueId: string, amount: number) {
  const uid = await currentUserId(); if (!uid) throw new Error('UNAUTHENTICATED');
  if (DEMO_MODE) {
    const existing = demoCashPayments.find(p => p.due_id === dueId && p.user_id === uid);
    if (existing && existing.status === 'paid') throw new Error('CASH_PAYMENT_ALREADY_PAID');
    if (existing) { existing.amount = amount; existing.status = 'pending'; existing.paid_at = null; existing.proof_file_id = null; existing.rejection_reason = null; existing.cash_transaction_id = null; return existing; }
    const row = { id: uuid(), due_id: dueId, user_id: uid, amount, status: 'pending' as const, proof_file_id: null, paid_at: null, cash_transaction_id: null }; demoCashPayments.unshift(row); return row;
  }
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
  if (DEMO_MODE) {
    const p = demoCashPayments.find(x => x.id === paymentId);
    if (!p) throw new Error('CASH_PAYMENT_NOT_FOUND');
    if (p.status === 'paid' && status !== 'paid') throw new Error('CASH_PAYMENT_PAID_IMMUTABLE');
    if (status === 'rejected' && (rejectionReason?.trim().length ?? 0) < 3) throw new Error('REJECTION_REASON_REQUIRED');
    p.status = status;
    p.paid_at = status === 'paid' ? (p.paid_at || now()) : null;
    p.verified_by = demoProfile.id;
    p.verified_at = now();
    p.rejection_reason = status === 'rejected' ? (rejectionReason?.trim() || null) : null;
    if (status === 'paid' && !p.cash_transaction_id) {
      const due = demoCashDues.find(d => d.id === p.due_id);
      if (!due) throw new Error('CASH_DUE_NOT_FOUND');
      const tx: CashTransaction = { id: uuid(), cash_account_id: demoCashAccount.id, created_by: demoProfile.id, transaction_type: 'income', amount: Number(p.amount), category: 'Iuran Kelas', description: due.title, proof_file_id: p.proof_file_id, transaction_date: (p.paid_at || now()).slice(0, 10) };
      demoCashTx.unshift(tx);
      p.cash_transaction_id = tx.id;
    }
    return p;
  }
  const { error } = await requireSupabase().rpc('verify_cash_payment', { p_payment_id: paymentId, p_status: status, p_rejection_reason: rejectionReason ?? null });
  if (error) throw error;
  await invalidateCachesForTable('cash_payments');
}
export async function attachCashPaymentProof(paymentId: string, classId: string, file: File) { const record = await uploadPrivateFile(classId, file, 'cash-proofs', `${classId}/${await currentUserId()}/${paymentId}`); const row = { id: paymentId, proof_file_id: record.id }; try { await tryMutation(row, 'cash_payments', 'update', async () => { const { error } = await requireSupabase().from('cash_payments').update({ proof_file_id: record.id }).eq('id', paymentId); if (error) throw error; return undefined; }); return record; } catch (error) { try { const uid = await currentUserId(); if (uid) await requireSupabase().storage.from('cash-proofs').remove([record.storage_path]); } catch {} throw error; } }
export async function voidCashTransaction(id: string, reason: string) { if (DEMO_MODE) { const t = demoCashTx.find(x => x.id === id); if (t) t.voided_at = now(), t.void_reason = reason; return; } const { error } = await requireSupabase().rpc('void_cash_transaction', { p_transaction_id: id, p_reason: reason }); if (error) throw error; await invalidateCachesForTable('cash_transactions'); }
export async function correctCashTransaction(id: string, payload: { type: 'income' | 'expense'; amount: number; category: string; description?: string; date: string; reason: string }) { if (DEMO_MODE) return createCashTransaction(demoClasses[0].id, payload); const { data, error } = await requireSupabase().rpc('correct_cash_transaction', { p_transaction_id: id, p_type: payload.type, p_amount: payload.amount, p_category: payload.category, p_description: payload.description ?? null, p_transaction_date: payload.date, p_reason: payload.reason }); if (error) throw error; await invalidateCachesForTable('cash_transactions'); return data as CashTransaction; }

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
  if (DEMO_MODE) return demoFiles.find(x => x.id === fileId && !x.deleted_at) ?? null;
  const { data, error } = await requireSupabase().from('files').select('id,uploaded_by,owner_scope,class_id,bucket,storage_path,file_name,mime_type,file_size,checksum,metadata,created_at,deleted_at').eq('id', fileId).is('deleted_at', null).maybeSingle();
  if (error) throw error;
  return (data as FileRecord | null) ?? null;
}
export async function listFiles(classId: string): Promise<FileRecord[]> { if (DEMO_MODE) return demoFiles.filter(x => x.class_id === classId && !x.deleted_at); return cachedList(`files:${classId}`, async () => { const { data, error } = await requireSupabase().from('files').select('id,uploaded_by,owner_scope,class_id,bucket,storage_path,file_name,mime_type,file_size,checksum,metadata,created_at,deleted_at').eq('class_id', classId).eq('owner_scope', 'class').is('deleted_at', null).order('created_at', { ascending: false }); if (error) throw error; return (data ?? []) as FileRecord[]; }); }
export async function uploadClassFile(classId: string, file: File) { if (DEMO_MODE) { const record: FileRecord = { id: uuid(), uploaded_by: demoProfile.id, owner_scope: 'class', class_id: classId, bucket: 'class-files', storage_path: `${classId}/demo/${file.name}`, file_name: file.name, mime_type: file.type || 'application/octet-stream', file_size: file.size, checksum: null, metadata: { demo: true }, created_at: now() }; demoFiles.unshift(record); await localFileSet({ key: record.id, blob: file, fileName: file.name, mimeType: record.mime_type, size: file.size, updatedAt: Date.now() }); return record; } return uploadPrivateFile(classId, file, 'class-files', `${classId}/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}`); }
export async function cacheFileOffline(file: FileRecord) { const local = await localFileGet(file.id); if (local) return; const url = await getFileUrl(file, false); if (!url) return; const response = await fetch(url); if (!response.ok) throw new Error('FILE_CACHE_FAILED'); const blob = await response.blob(); await localFileSet({ key: file.id, blob, fileName: file.file_name, mimeType: file.mime_type, size: file.file_size, updatedAt: Date.now() }); }
export async function removeOfflineFile(fileId: string) { await localFileRemove(fileId); }
export async function getFileUrl(file: FileRecord, allowNetwork = true) { const local = await localFileGet(file.id); if (local) return URL.createObjectURL(local.blob); if (!allowNetwork || !navigator.onLine || DEMO_MODE) return null; const { data, error } = await requireSupabase().storage.from(file.bucket).createSignedUrl(file.storage_path, 600); if (error) throw error; return data.signedUrl; }

export async function listAlbums(classId: string): Promise<Album[]> { if (DEMO_MODE) return demoAlbums.filter(x => x.class_id === classId); return cachedList(`albums:${classId}`, async () => { const { data, error } = await requireSupabase().from('albums').select('id,class_id,created_by,title,description,created_at,updated_at').eq('class_id', classId).is('deleted_at', null).order('created_at', { ascending: false }); if (error) throw error; return (data ?? []) as Album[]; }); }
export async function createAlbum(classId: string, title: string, description?: string) { const uid = await currentUserId(); if (!uid) throw new Error('UNAUTHENTICATED'); const row = { id: uuid(), class_id: classId, created_by: uid, title: title.trim(), description: description?.trim() || null }; if (DEMO_MODE) { const a = { ...row, created_at: now(), updated_at: now() }; demoAlbums.unshift(a); return a; } return tryMutation(row, 'albums', 'insert', async () => { const { data, error } = await requireSupabase().from('albums').insert(row).select().single(); if (error) throw error; return data as Album; }); }
export async function updateAlbum(id: string, payload: Pick<Partial<Album>, 'title' | 'description'>) { if (DEMO_MODE) { const a = demoAlbums.find(x => x.id === id); if (!a) throw new Error('ALBUM_NOT_FOUND'); Object.assign(a, payload); return a; } const row = { id, ...payload }; return tryMutation(row, 'albums', 'update', async () => { const { data, error } = await requireSupabase().from('albums').update(payload).eq('id', id).select().single(); if (error) throw error; return data as Album; }); }
export async function deleteAlbum(id: string) { if (DEMO_MODE) { const a = demoAlbums.find(x => x.id === id); if (a) (a as any).deleted_at = now(); return; } const row = { id, deleted_at: now() }; await tryMutation(row, 'albums', 'update', async () => { const { error } = await requireSupabase().from('albums').update({ deleted_at: row.deleted_at }).eq('id', id); if (error) throw error; return undefined; }); }
export async function listPhotos(albumId: string): Promise<Photo[]> { if (DEMO_MODE) return demoPhotos.filter(x => x.album_id === albumId); const { data, error } = await requireSupabase().from('photos').select('id,album_id,file_id,uploaded_by,caption,created_at').eq('album_id', albumId).is('deleted_at', null).order('created_at', { ascending: false }); if (error) throw error; return (data ?? []) as Photo[]; }
export async function updatePhoto(id: string, caption: string) { if (DEMO_MODE) { const p = demoPhotos.find(x => x.id === id); if (!p) throw new Error('PHOTO_NOT_FOUND'); p.caption = caption; return p; } const row = { id, caption: caption.trim() }; return tryMutation(row, 'photos', 'update', async () => { const { data, error } = await requireSupabase().from('photos').update({ caption: row.caption }).eq('id', id).select().single(); if (error) throw error; return data as Photo; }); }
export async function deletePhoto(id: string) { if (DEMO_MODE) { const i = demoPhotos.findIndex(x => x.id === id); if (i >= 0) demoPhotos.splice(i, 1); return; } const row = { id, deleted_at: now() }; await tryMutation(row, 'photos', 'update', async () => { const { error } = await requireSupabase().from('photos').update({ deleted_at: row.deleted_at }).eq('id', id); if (error) throw error; return undefined; }); }
export async function uploadPhoto(classId: string, albumId: string, file: File, caption?: string) { if (DEMO_MODE) { const f: Photo = { id: uuid(), album_id: albumId, file_id: uuid(), uploaded_by: demoProfile.id, caption: caption ?? null, created_at: now() }; demoPhotos.unshift(f); return f; } const record = await uploadPrivateFile(classId, file, 'class-photos', `${classId}/${albumId}`); const uid = await currentUserId(); const { data, error } = await requireSupabase().from('photos').insert({ id: uuid(), album_id: albumId, file_id: record.id, uploaded_by: uid, caption: caption ?? null }).select().single(); if (error) { await requireSupabase().storage.from('class-photos').remove([record.storage_path]); throw error; } return data as Photo; }

export async function listSharedNotes(classId: string): Promise<SharedNote[]> { if (DEMO_MODE) return demoSharedNotes.filter(x => x.class_id === classId); return cachedList(`shared-notes:${classId}`, async () => { const { data, error } = await requireSupabase().from('shared_notes').select('id,class_id,created_by,title,content,version,updated_at').eq('class_id', classId).is('deleted_at', null).order('updated_at', { ascending: false }); if (error) throw error; return (data ?? []) as SharedNote[]; }); }
export async function createSharedNote(classId: string, title: string, content: string) { const uid = await currentUserId(); if (!uid) throw new Error('UNAUTHENTICATED'); const row = { id: uuid(), class_id: classId, created_by: uid, title: title.trim(), content, version: 1 }; if (DEMO_MODE) { const n = { ...row, updated_at: now() }; demoSharedNotes.unshift(n); return n; } return tryMutation(row, 'shared_notes', 'insert', async () => { const { data, error } = await requireSupabase().from('shared_notes').insert(row).select().single(); if (error) throw error; return data as SharedNote; }); }
export async function updateSharedNote(note: SharedNote, title: string, content: string) { if (DEMO_MODE) { note.title = title; note.content = content; note.version += 1; note.updated_at = now(); return note; } const args = { p_note_id: note.id, p_expected_version: note.version, p_title: title.trim(), p_content: content }; try { const { data, error } = await requireSupabase().rpc('update_shared_note_with_version', args); if (error) throw error; await invalidateCachesForTable('shared_notes'); return data as SharedNote; } catch (error) { if (!isRetryableNetworkError(error)) throw error; await queueWrite('__rpc__', note.id, { name: 'update_shared_note_with_version', args }, 'update', error); await invalidateCachesForTable('shared_notes'); return { ...note, title: args.p_title, content, version: note.version + 1, updated_at: now() }; } }

export async function listAdminNotes(classId: string): Promise<AdminNote[]> { if (DEMO_MODE) return demoAdminNotes.filter(n => n.class_id === classId).slice().sort((a,b)=>Number(b.pinned)-Number(a.pinned) || b.note_date.localeCompare(a.note_date)); return cachedList(`admin-notes:${classId}`, async () => { const { data, error } = await requireSupabase().from('class_admin_notes').select('id,class_id,created_by,title,category,note_date,content,pinned,created_at,updated_at').eq('class_id', classId).is('deleted_at', null).order('pinned', { ascending: false }).order('note_date', { ascending: false }); if (error) throw error; return (data ?? []) as AdminNote[]; }); }
export async function createAdminNote(classId: string, payload: Pick<AdminNote, 'title' | 'category' | 'note_date' | 'content' | 'pinned'>) { const uid = await currentUserId(); if (!uid) throw new Error('UNAUTHENTICATED'); const row = { id: uuid(), class_id: classId, created_by: uid, ...payload }; if (DEMO_MODE) { const n = row as AdminNote; demoAdminNotes.unshift(n); return n; } return tryMutation(row, 'class_admin_notes', 'insert', async () => { const { data, error } = await requireSupabase().from('class_admin_notes').insert(row).select().single(); if (error) throw error; return data as AdminNote; }); }
export async function updateAdminNote(id: string, payload: Partial<Pick<AdminNote, 'title' | 'category' | 'note_date' | 'content' | 'pinned'>>) { if (DEMO_MODE) { const n=demoAdminNotes.find(x=>x.id===id); if(!n) throw new Error('ADMIN_NOTE_NOT_FOUND'); Object.assign(n,payload,{updated_at:now()}); return n; } const row = { id, ...payload, updated_at: now() }; return tryMutation(row, 'class_admin_notes', 'update', async () => { const { data, error } = await requireSupabase().from('class_admin_notes').update(payload).eq('id', id).select().single(); if (error) throw error; return data as AdminNote; }); }
export async function deleteAdminNote(id: string) { if (DEMO_MODE) { const i=demoAdminNotes.findIndex(x=>x.id===id); if(i>=0) demoAdminNotes.splice(i,1); return; } const row = { id, deleted_at: now() }; await tryMutation(row, 'class_admin_notes', 'update', async () => { const { error } = await requireSupabase().from('class_admin_notes').update({ deleted_at: row.deleted_at }).eq('id', id); if (error) throw error; return undefined; }); }

export async function saveRandomizerResult(classId: string, mode: RandomizerHistoryRecord['mode'], title: string, entries: string[]): Promise<RandomizerHistoryRecord> {
  const uid = await currentUserId(); if (!uid) throw new Error('UNAUTHENTICATED');
  const row = { id: uuid(), class_id: classId, created_by: uid, mode, title: title.trim(), entries, created_at: now() };
  if (DEMO_MODE) { demoRandomizerHistory.unshift(row as RandomizerHistoryRecord); return row as RandomizerHistoryRecord; }
  return tryMutation(row, 'randomizer_results', 'insert', async () => {
    const { data, error } = await requireSupabase().from('randomizer_results').insert(row).select().single();
    if (error) throw error; return data as RandomizerHistoryRecord;
  });
}
export async function listRandomizerHistory(classId: string): Promise<RandomizerHistoryRecord[]> {
  if (DEMO_MODE) return demoRandomizerHistory.filter(x => x.class_id === classId).slice().sort((a,b)=>b.created_at.localeCompare(a.created_at));
  return cachedList(`randomizer-history:${classId}`, async () => {
    const { data, error } = await requireSupabase().from('randomizer_results').select('id,class_id,created_by,mode,title,entries,created_at').eq('class_id', classId).order('created_at', { ascending:false }).limit(30);
    if (error) throw error; return (data ?? []) as RandomizerHistoryRecord[];
  });
}

export async function listNotifications(): Promise<Notification[]> { if (DEMO_MODE) return [...demoNotifications]; const uid = await currentUserId(); if (!uid) return []; return cachedList(`notifications:${uid}`, async () => { const { data, error } = await requireSupabase().from('notifications').select('id,user_id,notification_type,title,body,data,is_read,created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(100); if (error) throw error; return (data ?? []) as Notification[]; }); }

export async function listActivityLogs(classId: string, limit = 25): Promise<ActivityLog[]> {
  if (DEMO_MODE) return demoActivityLogs.filter((x: ActivityLog) => x.class_id === classId).slice().sort((a: ActivityLog,b: ActivityLog)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime()).slice(0,limit);
  const { data, error } = await requireSupabase().from('activity_logs').select('id,user_id,class_id,action,entity_type,entity_id,metadata,created_at').eq('class_id', classId).order('created_at',{ascending:false}).limit(limit);
  if (error) throw error;
  return (data ?? []) as ActivityLog[];
}

export async function markNotificationRead(id: string) { if (DEMO_MODE) { const n = demoNotifications.find(x => x.id === id); if (n) n.is_read = true; return; } const row = { id, is_read: true }; await tryMutation(row, 'notifications', 'update', async () => { const { error } = await requireSupabase().from('notifications').update({ is_read: true }).eq('id', id); if (error) throw error; return undefined; }, async () => { const uid = await currentUserId(); if (uid) { const cached = (await cacheGet<Notification[]>(`notifications:${uid}`)) ?? []; await cacheSet(`notifications:${uid}`, cached.map(n => n.id === id ? { ...n, is_read: true } : n)); } }); }

export async function listNotes(classId?: string): Promise<PersonalNote[]> { if (DEMO_MODE) return demoNotes.filter(n => !classId || n.class_id === classId); const uid = await currentUserId(); if (!uid) return []; return cachedList(`notes:${uid}:${classId ?? 'all'}`, async () => { let q = requireSupabase().from('personal_notes').select('id,user_id,class_id,title,content,pinned,updated_at').eq('user_id', uid).is('deleted_at', null).order('pinned', { ascending: false }).order('updated_at', { ascending: false }); if (classId) q = q.eq('class_id', classId); const { data, error } = await q; if (error) throw error; return (data ?? []) as PersonalNote[]; }); }
export async function saveNote(note: { id?: string; classId?: string | null; title: string; content: string; pinned?: boolean }) { const uid = await currentUserId(); if (!uid) throw new Error('UNAUTHENTICATED'); const id = note.id ?? uuid(); const row = { id, user_id: uid, class_id: note.classId ?? null, title: note.title.trim(), content: note.content, pinned: note.pinned ?? false, updated_at: now() }; if (DEMO_MODE) { const idx = demoNotes.findIndex(n => n.id === id); const value = row as PersonalNote; if (idx >= 0) demoNotes[idx] = value; else demoNotes.unshift(value); return value; } return tryMutation(row, 'personal_notes', 'upsert', async () => { const { data, error } = await requireSupabase().from('personal_notes').upsert(row).select().single(); if (error) throw error; return data as PersonalNote; }, async () => { await mergeCachedList(`notes:${uid}:all`, row as PersonalNote); if (row.class_id) await mergeCachedList(`notes:${uid}:${row.class_id}`, row as PersonalNote); }); }
export async function deleteNote(id: string) { if (DEMO_MODE) { const i = demoNotes.findIndex(n => n.id === id); if (i >= 0) demoNotes.splice(i, 1); return; } const uid = await currentUserId(); if (!uid) throw new Error('UNAUTHENTICATED'); const row = { id, deleted_at: now() }; await tryMutation(row, 'personal_notes', 'update', async () => { const { error } = await requireSupabase().from('personal_notes').update({ deleted_at: row.deleted_at }).eq('id', id); if (error) throw error; return undefined; }, async () => { await removeCachedListItem(`notes:${uid}:all`, id); }); }



export async function listBugReports(): Promise<BugReport[]> {
  const uid = await currentUserId();
  if (!uid) return [];
  if (DEMO_MODE) {
    return demoBugReports.filter(x => x.user_id === uid).slice().sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
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
  if (DEMO_MODE) { demoBugReports.unshift(row as BugReport); return row as BugReport; }
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
  if (DEMO_MODE) {
    const hay = searchText.toLowerCase(); const results: SearchResult[] = [];
    demoClasses.filter(x => `${x.name} ${x.class_code}`.toLowerCase().includes(hay)).forEach(x => results.push({ id: x.id, title: x.name, excerpt: x.class_code, type: 'class', href: `#/classes/${x.id}` }));
    demoAssignments.filter(x => `${x.title} ${x.description ?? ''}`.toLowerCase().includes(hay)).forEach(x => results.push({ id: x.id, title: x.title, excerpt: x.description ?? '', type: 'task', classId: x.class_id, className: demoClasses.find(c => c.id === x.class_id)?.name, href: `#/classes/${x.class_id}?tab=tasks&item=${encodeURIComponent(x.id)}` }));
    return results.slice(0, 25);
  }
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

export async function queueState() { const items = await queueAll(); return { total: items.length, pending: items.filter(x => x.status === 'pending').length, failed: items.filter(x => x.status === 'failed').length, conflict: items.filter(x => x.status === 'conflict').length }; }
async function invokeQueuedRpc(payload: Record<string, unknown>) {
  const name = String(payload.name ?? ''); const args = payload.args;
  if (name !== 'update_shared_note_with_version' && name !== 'set_group_leader') throw new Error('RPC_NOT_ALLOWLISTED');
  const { error } = await requireSupabase().rpc(name as any, args as any); if (error) throw error;
}
function retryDelayMs(attempts: number) { return Math.min(60000, Math.max(1000, (2 ** Math.min(attempts, 6)) * 1000)) + Math.floor(Math.random() * 600); }
function isConflictError(error: unknown) { const value = error as { code?: string; status?: number; message?: string } | null; const message = String(value?.message ?? error ?? ''); return value?.status === 409 || String(value?.code ?? '') === '409' || /conflict|stale|version mismatch|duplicate key|unique constraint/i.test(message); }

let syncPromise: Promise<{ pending: number; failed: number; conflict: number }> | null = null;
async function runSyncLocked() {
  if (DEMO_MODE) { await metaSet('lastSyncAt', now()); return { pending: 0, failed: 0, conflict: 0 }; }
  if (!navigator.onLine) { const items = await queueAll(); return { pending: items.filter(x => x.status === 'pending').length, failed: items.filter(x => x.status === 'failed').length, conflict: items.filter(x => x.status === 'conflict').length }; }
  const items = await queueAll(); let pending = 0, failed = 0, conflict = 0;
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
    if (locks) return locks.request('student-hub-sync', runSyncLocked);
    const lockKey = 'syncLock'; const current = await metaGet<number>(lockKey); if (current && current > Date.now() - 15000) return queueState(); await metaSet(lockKey, Date.now()); try { return await runSyncLocked(); } finally { await metaSet(lockKey, 0); }
  })().finally(() => { syncPromise = null; });
  return syncPromise;
}
export async function lastSyncAt() { return metaGet<string>('lastSyncAt'); }
export function subscribeNotificationPopups(onNotification: (notification: Notification) => void) {
  const client = supabase;
  if (!client) return () => {};
  const channel = client.channel(`student-hub-notification-popups-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event:'INSERT', schema:'public', table:'notifications' }, (payload) => {
      const row = payload.new as Notification;
      void currentUserId().then(uid => { if (uid && row.user_id === uid) onNotification(row); });
    }).subscribe();
  return () => { void client.removeChannel(channel); };
}

export function subscribeRealtime(onChange: () => void) {
  const client = supabase;
  if (!client) return () => {};
  const channel = client.channel('student-hub-events').on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, onChange).subscribe();
  return () => { void client.removeChannel(channel); };
}
