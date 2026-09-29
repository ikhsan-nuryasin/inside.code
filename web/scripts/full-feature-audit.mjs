import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('../', import.meta.url).pathname);
const files = [
  'src/App.tsx','src/pages/AuthPage.tsx','src/pages/DashboardPage.tsx','src/pages/ClassesPage.tsx','src/pages/ClassPage.tsx',
  'src/pages/TasksPage.tsx','src/pages/CalendarPage.tsx','src/pages/NotesPage.tsx','src/pages/NotificationsPage.tsx',
  'src/pages/CashPage.tsx','src/pages/DocumentationPage.tsx','src/pages/PositionsPage.tsx','src/pages/SearchPage.tsx',
  'src/pages/SettingsPage.tsx','src/pages/RandomizerPage.tsx','src/pages/HelpPage.tsx','src/pages/QuickMessagesPage.tsx','src/components/NotificationPopup.tsx','src/lib/repository.ts','src/lib/offline.ts','src/components/AppShell.tsx',
];
const text = files.map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n');
const checks = [
  ['task CRUD + checklist', /insertClassTask[\s\S]*updateAssignment[\s\S]*deleteAssignment[\s\S]*saveChecklistItem/],
  ['schedule/subject CRUD', /insertSchedule[\s\S]*updateSchedule[\s\S]*deleteSchedule[\s\S]*updateSubject/],
  ['materials CRUD + attachments', /createMaterial[\s\S]*updateMaterial[\s\S]*deleteMaterial[\s\S]*attachMaterialFile/],
  ['forum CRUD + report', /createForumTopic[\s\S]*createForumPost[\s\S]*updateForumPost[\s\S]*deleteForumPost[\s\S]*reportForum/],
  ['groups + leader selection', /createGroup[\s\S]*updateGroup[\s\S]*deleteGroup[\s\S]*setGroupLeader/],
  ['group member + task management', /addGroupMember[\s\S]*removeGroupMember[\s\S]*createGroupTask[\s\S]*updateGroupTask/],
  ['poll lifecycle', /createPoll[\s\S]*votePoll[\s\S]*closePoll/],
  ['cash + proof + verification + audit', /createCashTransaction[\s\S]*createCashDue[\s\S]*createCashPayment[\s\S]*verifyCashPayment[\s\S]*voidCashTransaction[\s\S]*correctCashTransaction/],
  ['documentation', /createAlbum[\s\S]*updateAlbum[\s\S]*deleteAlbum[\s\S]*uploadPhoto[\s\S]*updatePhoto[\s\S]*deletePhoto/],
  ['secretary administration', /createAdminNote[\s\S]*updateAdminNote[\s\S]*deleteAdminNote/],
  ['notifications/search/settings', /listNotifications[\s\S]*globalSearch[\s\S]*SettingsPage/],
  ['randomizer + presentation order + history', /setGroupLeader[\s\S]*saveRandomizerResult[\s\S]*listRandomizerHistory[\s\S]*presentation_order/],
  ['notification popup', /subscribeNotificationPopups[\s\S]*NotificationPopup/],
  ['authenticated app gate', /!signedIn[\s\S]*AuthPage/],
  ['support center + authenticated bug reports', /HelpPage[\s\S]*listBugReports[\s\S]*createBugReport/],
  ['quick WhatsApp messages', /QuickMessagesPage[\s\S]*wa.me[\s\S]*Buka WhatsApp/],
  ['offline queue/sync', /queueWrite[\s\S]*runSyncLocked[\s\S]*pull_sync_events/],
];
const failed=checks.filter(([,re])=>!re.test(text));
const forbidden=[/\battendance\b/i,/\babsen(si)?\b/i,/\bpresensi\b/i,/create_class/i,/join_class_by_code/i,/createClass\s*\(/i,/joinClass\s*\(/i];
const hits=forbidden.filter(re=>re.test(text)).map(String);
if(failed.length||hits.length){
  console.error('FULL FEATURE AUDIT FAILED');
  if(failed.length) console.error('Missing:', failed.map(([n])=>n).join(', '));
  if(hits.length) console.error('Forbidden product rules detected:', hits.join(', '));
  process.exit(1);
}
console.log(`FULL FEATURE AUDIT PASS — ${checks.length} feature groups verified.`);

const productivityChecks = [
  ['presentation calendar integration', fs.readFileSync(path.join(root,'src/pages/RandomizerPage.tsx'),'utf8').includes('createClassEvent')],
  ['notification popup preferences', fs.readFileSync(path.join(root,'src/components/NotificationPopup.tsx'),'utf8').includes('student-hub-notification-preferences')],
  ['notification preferences UI', fs.readFileSync(path.join(root,'src/pages/SettingsPage.tsx'),'utf8').includes('Preferensi popup')],
  ['personal dues status', fs.readFileSync(path.join(root,'src/pages/CashPage.tsx'),'utf8').includes('Iuran saya')],
  ['class productivity migration', fs.existsSync(path.resolve(root,'../supabase/migrations/019_class_productivity_upgrade.sql'))],
  ['support migration', fs.existsSync(path.resolve(root,'../supabase/migrations/020_support_bug_reports.sql'))],
];
const productivityMissing=productivityChecks.filter(([,ok])=>!ok);
if(productivityMissing.length){
  console.error('PRODUCTIVITY UPGRADE CHECK FAILED:', productivityMissing.map(([n])=>n).join(', '));
  process.exit(1);
}
console.log(`PRODUCTIVITY UPGRADE CHECK PASS — ${productivityChecks.length} upgrades verified.`);
