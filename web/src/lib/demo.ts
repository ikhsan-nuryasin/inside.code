import type { ActivityLog, AdminNote, Announcement, Assignment, AssignmentFile, Album, BugReport, CashAccount, CashDue, CashPayment, CashTransaction, ClassMember, ClassPositionRecord, ClassRecord, ClassEvent, FileRecord, ForumPost, ForumReport, ForumTopic, GroupMember, GroupRecord, GroupTask, Material, MaterialFile, Notification, PersonalNote, Poll, PollOption, PollVote, Profile, RandomizerHistoryRecord, Schedule, Subject, SharedNote, Photo } from '../types/models';

export const demoProfile: Profile = { id: 'demo-user', full_name: 'Muhammad Ikhsan', nim: 'DEMO001', major: 'Sistem Informasi', semester: 3, avatar_path: null };
export const demoClasses: ClassRecord[] = [
  { id:'class-1', name:'Sistem Informasi — Semester 3', class_code:'SI3B14K7X9', delivery_mode:'offline', study_program:'Sistem Informasi', semester:3, academic_year:'2026/2027', description:'Kelas utama dengan jadwal semester 3 sesuai jadwal kuliah.', cover_path:null, role:'admin', member_count:24 },
  { id:'class-2', name:'Kelas Online Cadangan', class_code:'ONL3H2K8M1', delivery_mode:'online', study_program:'Sistem Informasi', semester:3, academic_year:'2026/2027', description:'Contoh kelas online untuk pengujian mode pembelajaran.', cover_path:null, role:'member', member_count:19 },
];
export const demoSubjects: Subject[] = [
  { id:'sub-1', class_id:'class-1', name:'SISTEM INFORMASI MANAJEMEN', code:'240', lecturer_code:'TRT', lecturer_code_secondary:null, credits:3, practical_group:null },
  { id:'sub-2', class_id:'class-1', name:'KEAMANAN BASIS DATA', code:'0405', lecturer_code:'ECR', lecturer_code_secondary:null, credits:3, practical_group:null },
  { id:'sub-3', class_id:'class-1', name:'METODOLOGI PENELITIAN', code:'0367', lecturer_code:'WYR', lecturer_code_secondary:null, credits:3, practical_group:null },
  { id:'sub-4', class_id:'class-1', name:'WEB PROGRAMMING II', code:'0407', lecturer_code:'FZR', lecturer_code_secondary:null, credits:3, practical_group:'WPP.19.3B.14A' },
  { id:'sub-5', class_id:'class-1', name:'BAHASA INDONESIA', code:'253', lecturer_code:'RBP', lecturer_code_secondary:null, credits:2, practical_group:null },
  { id:'sub-6', class_id:'class-1', name:'CHARACTER BUILDING', code:'154', lecturer_code:'CYG', lecturer_code_secondary:null, credits:3, practical_group:null },
  { id:'sub-7', class_id:'class-1', name:'FUNDAMENTAL DATA ANALYST', code:'0406', lecturer_code:'IMK', lecturer_code_secondary:null, credits:3, practical_group:null },
  { id:'sub-8', class_id:'class-1', name:'STATISTIKA DAN PROBABILITAS', code:'0624', lecturer_code:'ERH', lecturer_code_secondary:null, credits:3, practical_group:null },
];
export const demoSchedules: Schedule[] = [
  { id:'sch-1', subject_id:'sub-1', day_of_week:1, starts_at:'17:30:00', ends_at:'19:30:00', room:'301-E5', location:null, meeting_url:null, notes:null, subject:demoSubjects[0] },
  { id:'sch-2', subject_id:'sub-2', day_of_week:1, starts_at:'19:30:00', ends_at:'21:30:00', room:'301-E5', location:null, meeting_url:null, notes:null, subject:demoSubjects[1] },
  { id:'sch-3', subject_id:'sub-3', day_of_week:2, starts_at:'17:30:00', ends_at:'19:30:00', room:'301-E5', location:null, meeting_url:null, notes:null, subject:demoSubjects[2] },
  { id:'sch-4', subject_id:'sub-4', day_of_week:2, starts_at:'19:30:00', ends_at:'21:30:00', room:'301-E5', location:null, meeting_url:null, notes:null, subject:demoSubjects[3] },
  { id:'sch-5', subject_id:'sub-5', day_of_week:3, starts_at:'18:10:00', ends_at:'19:30:00', room:'E1.3-E5', location:null, meeting_url:null, notes:null, subject:demoSubjects[4] },
  { id:'sch-6', subject_id:'sub-6', day_of_week:3, starts_at:'19:30:00', ends_at:'21:30:00', room:'E1.3-E5', location:null, meeting_url:null, notes:null, subject:demoSubjects[5] },
  { id:'sch-7', subject_id:'sub-7', day_of_week:4, starts_at:'17:30:00', ends_at:'19:30:00', room:'301-E5', location:null, meeting_url:null, notes:null, subject:demoSubjects[6] },
  { id:'sch-8', subject_id:'sub-8', day_of_week:4, starts_at:'19:30:00', ends_at:'21:30:00', room:'301-E5', location:null, meeting_url:null, notes:null, subject:demoSubjects[7] },
];

export const demoAssignments: Assignment[] = [
  { id:'task-1', class_id:'class-1', subject_id:'sub-2', title:'CRUD PHP', description:'Buat CRUD sederhana dengan validasi.', deadline:new Date(Date.now()+86400000*2).toISOString(), priority:'high', created_by:'demo-user', progress_status:'in_progress' },
  { id:'task-2', class_id:'class-1', subject_id:'sub-1', title:'Normalisasi Database', description:'Kerjakan normalisasi sampai 3NF.', deadline:new Date(Date.now()+86400000*4).toISOString(), priority:'normal', created_by:'demo-user', progress_status:'not_started' },
];
export const demoChecklist = [
  { id:'check-1', assignment_id:'task-1', title:'Buat database', sort_order:1 },
  { id:'check-2', assignment_id:'task-1', title:'Buat CRUD', sort_order:2 },
  { id:'check-3', assignment_id:'task-1', title:'Testing', sort_order:3 },
];
export const demoAssignmentFiles: AssignmentFile[] = [];
export const demoMaterialFiles: MaterialFile[] = [];
export const demoMaterials: Material[] = [
  { id:'mat-1', class_id:'class-1', subject_id:'sub-1', title:'Materi Normalisasi', description:'Ringkasan 1NF–3NF.', material_type:'document', external_url:null, created_at:new Date().toISOString() },
  { id:'mat-2', class_id:'class-1', subject_id:'sub-2', title:'Video CRUD', description:'Video pembelajaran.', material_type:'video', external_url:'https://example.com', created_at:new Date().toISOString() },
];
export const demoNotes: PersonalNote[] = [{ id:'note-1', user_id:'demo-user', class_id:'class-1', title:'Catatan Basis Data', content:'JOIN menggabungkan data dari tabel berdasarkan relasi.', pinned:true, updated_at:new Date().toISOString() }];
export const demoSharedNotes: SharedNote[] = [{ id:'shared-1', class_id:'class-1', created_by:'demo-user', title:'Ringkasan Pertemuan 5', content:'Normalisasi: 1NF → 2NF → 3NF.', version:1, updated_at:new Date().toISOString() }];
export const demoAnnouncements: Announcement[] = [{ id:'ann-1', class_id:'class-1', created_by:'demo-user', title:'Perubahan ruang kelas', content:'Besok gunakan Lab 2.', priority:3, published_at:new Date().toISOString() }];
export const demoMembers: ClassMember[] = [
  {id:'cm-1', class_id:'class-1', user_id:'demo-user', role:'admin', status:'active', joined_at:new Date().toISOString(), full_name:'Muhammad Ikhsan', nim:'DEMO001'},
  {id:'cm-2', class_id:'class-1', user_id:'u2', role:'member', status:'active', joined_at:new Date().toISOString(), full_name:'Andi Pratama', nim:'DEMO002'},
  {id:'cm-3', class_id:'class-1', user_id:'u3', role:'member', status:'active', joined_at:new Date().toISOString(), full_name:'Citra Lestari', nim:'DEMO003'},
{id:'cm-4', class_id:'class-1', user_id:'u4', role:'member', status:'active', joined_at:new Date().toISOString(), full_name:'Dimas Saputra', nim:'DEMO004'},
{id:'cm-5', class_id:'class-1', user_id:'u5', role:'member', status:'active', joined_at:new Date().toISOString(), full_name:'Nanda Putri', nim:'DEMO005'},
];
export const demoClassPositions: ClassPositionRecord[] = [
  {id:'pos-1',class_id:'class-1',user_id:'demo-user',position:'ketua',assigned_by:'demo-user',created_at:new Date().toISOString(),updated_at:new Date().toISOString(),full_name:'Muhammad Ikhsan',nim:'DEMO001'},
  {id:'pos-2',class_id:'class-1',user_id:'u2',position:'sekretaris',assigned_by:'demo-user',created_at:new Date().toISOString(),updated_at:new Date().toISOString(),full_name:'Andi Pratama',nim:'DEMO002'},
  {id:'pos-3',class_id:'class-1',user_id:'u3',position:'bendahara',assigned_by:'demo-user',created_at:new Date().toISOString(),updated_at:new Date().toISOString(),full_name:'Citra Lestari',nim:'DEMO003'},
  {id:'pos-4',class_id:'class-1',user_id:'u4',position:'wakil_ketua',assigned_by:'demo-user',created_at:new Date().toISOString(),updated_at:new Date().toISOString(),full_name:'Dimas Saputra',nim:'DEMO004'},
];
export const demoTopics: ForumTopic[] = [{id:'topic-1',class_id:'class-1',created_by:'u2',title:'Besok ruang kelas apa?',category:'general',pinned:true,created_at:new Date().toISOString(),creator_name:'Andi Pratama',post_count:2}];
export const demoPosts: ForumPost[] = [
  {id:'post-1',topic_id:'topic-1',user_id:'u2',parent_id:null,content:'Ada perubahan ruang?',created_at:new Date().toISOString(),author_name:'Andi Pratama'},
  {id:'post-2',topic_id:'topic-1',user_id:'demo-user',parent_id:'post-1',content:'Iya, besok Lab 2.',created_at:new Date().toISOString(),author_name:'Muhammad Ikhsan'},
];
export const demoGroups: GroupRecord[] = [{id:'group-1',class_id:'class-1',name:'Kelompok 1',description:'Frontend + dokumentasi',created_by:'demo-user',leader_user_id:'demo-user',leader_name:'Muhammad Ikhsan',created_at:new Date().toISOString()}];
export const demoGroupMembers: GroupMember[] = [{id:'gm-1',group_id:'group-1',user_id:'demo-user',full_name:'Muhammad Ikhsan',nim:'DEMO001'},{id:'gm-2',group_id:'group-1',user_id:'u2',full_name:'Andi Pratama',nim:'DEMO002'}];
export const demoGroupTasks: GroupTask[] = [{id:'gt-1',group_id:'group-1',title:'Buat wireframe',description:'Wireframe homepage',assigned_to:'demo-user',completed:false,deadline:new Date(Date.now()+86400000*3).toISOString()}];
export const demoPolls: Poll[] = [{id:'poll-1',class_id:'class-1',created_by:'demo-user',title:'Besok makan di mana?',description:'Pilih tempat.',closes_at:new Date(Date.now()+86400000).toISOString(),is_anonymous:false,is_decision:false,closed:false,created_at:new Date().toISOString()},{id:'poll-2',class_id:'class-1',created_by:'demo-user',title:'Keputusan: jadwal presentasi',description:'Pilih jadwal yang akan ditetapkan kelas.',closes_at:new Date(Date.now()+86400000*2).toISOString(),is_anonymous:false,is_decision:true,closed:false,created_at:new Date().toISOString()}];
export const demoPollOptions: PollOption[] = [{id:'po-1',poll_id:'poll-1',label:'Kantin',sort_order:1,votes:7},{id:'po-2',poll_id:'poll-1',label:'KFC',sort_order:2,votes:3},{id:'po-3',poll_id:'poll-1',label:'Pulang',sort_order:3,votes:4},{id:'po-4',poll_id:'poll-2',label:'Senin',sort_order:1,votes:8},{id:'po-5',poll_id:'poll-2',label:'Selasa',sort_order:2,votes:12},{id:'po-6',poll_id:'poll-2',label:'Kamis',sort_order:3,votes:5}];
export const demoCashAccount: CashAccount = {id:'cash-1',class_id:'class-1'};
export const demoCashTx: CashTransaction[] = [{id:'ctx-1',cash_account_id:'cash-1',created_by:'demo-user',transaction_type:'income',amount:500000,category:'Iuran',description:'September',transaction_date:'2026-09-01'}];
export const demoCashDues: CashDue[] = [{id:'due-1',class_id:'class-1',title:'Iuran September',amount:20000,due_date:'2026-09-30',created_by:'demo-user'}];
export const demoCashPayments: CashPayment[] = [{id:'pay-1',due_id:'due-1',user_id:'demo-user',amount:20000,status:'paid',proof_file_id:null,paid_at:new Date().toISOString(),cash_transaction_id:null}];
export const demoFiles: FileRecord[] = [];
export const demoAlbums: Album[] = [{id:'album-1',class_id:'class-1',created_by:'demo-user',title:'Kegiatan September',description:'Dokumentasi kelas.',created_at:new Date().toISOString()}];
export const demoPhotos: Photo[] = [];
export const demoNotifications: Notification[] = [{id:'notif-1',user_id:'demo-user',notification_type:'announcement',title:'Pengumuman baru',body:'Perubahan ruang kelas.',is_read:false,created_at:new Date().toISOString()}];
export const demoAdminNotes: AdminNote[] = [
  { id:'admin-note-1', class_id:'class-1', created_by:'demo-user', title:'Notulen rapat kelas', category:'notulen', note_date:'2026-09-29', content:'Pembahasan persiapan UTS dan pembagian tugas.', pinned:true, created_at:new Date().toISOString(), updated_at:new Date().toISOString() },
  { id:'admin-note-2', class_id:'class-1', created_by:'demo-user', title:'Agenda minggu ini', category:'agenda', note_date:'2026-09-30', content:'Presentasi kelompok dan pengumpulan laporan.', pinned:false, created_at:new Date().toISOString(), updated_at:new Date().toISOString() },
];
export const demoForumReports: ForumReport[] = [];
export const demoRandomizerHistory: RandomizerHistoryRecord[] = [];
export const demoPollVotes: PollVote[] = [];

export const demoClassEvents: ClassEvent[] = [
  { id:'event-1', class_id:'class-1', created_by:'demo-user', event_type:'presentation', title:'Presentasi Database', description:'Urutan presentasi dari Randomizer.', starts_at:new Date(Date.now()+86400000*3).toISOString(), ends_at:new Date(Date.now()+86400000*3+90*60000).toISOString(), location:'Ruang 301-E5', meeting_url:null, pinned:true, created_at:new Date().toISOString(), updated_at:new Date().toISOString() },
  { id:'event-2', class_id:'class-1', created_by:'demo-user', event_type:'meeting', title:'Rapat kelas mingguan', description:'Persiapan UTS dan project.', starts_at:new Date(Date.now()+86400000*4).toISOString(), ends_at:new Date(Date.now()+86400000*4+60*60000).toISOString(), location:null, meeting_url:'https://meet.google.com/demo-student-hub', pinned:false, created_at:new Date().toISOString(), updated_at:new Date().toISOString() }
];
export const demoActivityLogs: ActivityLog[] = [
  { id:'act-1', user_id:'u2', class_id:'class-1', action:'INSERT assignment', entity_type:'assignments', entity_id:'task-1', metadata:{title:'CRUD PHP'}, created_at:new Date(Date.now()-25*60000).toISOString() },
  { id:'act-2', user_id:'u3', class_id:'class-1', action:'INSERT poll', entity_type:'polls', entity_id:'poll-2', metadata:{title:'Keputusan: jadwal presentasi'}, created_at:new Date(Date.now()-60*60000).toISOString() },
  { id:'act-3', user_id:'u2', class_id:'class-1', action:'INSERT announcement', entity_type:'announcements', entity_id:'ann-1', metadata:{title:'Perubahan ruang kelas'}, created_at:new Date(Date.now()-120*60000).toISOString() }
];

export const demoBugReports: BugReport[] = [];
