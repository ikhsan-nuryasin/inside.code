import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(new URL('..',import.meta.url).pathname);
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const read=(f)=>fs.readFileSync(path.join(root,f),'utf8');
const checks=[
 ['active-class context helper',/ACTIVE_CLASS_KEY[\s\S]*openClassModule/],
 ['global header removed',/AppShell[\s\S]*page-content/],
 ['mobile local chrome',/mobile-page-head|mobile-class-page-head|dashboard-mobile-reference/],
 ['class quick links',/class-detail-utility-row[\s\S]*openClassModule\(classId/],
 ['tasks class context filter',/classFilter[\s\S]*listClasses/],
 ['calendar cross links',/openClassModule\(activeClass,\s*'\/randomizer'/],
 ['notification center mark all',/readAll[\s\S]*Tandai semua dibaca/],
 ['notification popup',/notification-popup/],
 ['realtime popup subscription',/subscribeNotificationPopups/],
 ['toast host',/ToastHost[\s\S]*student-hub-toast/],
 ['help + bug report route',/help|HelpPage|Laporkan bug/],
 ['quick message route',/quick-messages|QuickMessagesPage|wa.me/],
 ['support cross-link',/nav\('\/quick-messages'\)[\s\S]*nav\('\/help'\)/],
 ['pwa cache version',read('public/sw.js').includes(`student-hub-v${pkg.version}-security-push`)],
 ['security center route',/security|SecurityPage/.test(read('src/App.tsx'))],
 ['captcha login',/TurnstileCaptcha|captchaToken/.test(read('src/pages/AuthPage.tsx'))],
];
const sources=[read('src/lib/router.ts'),read('src/components/AppShell.tsx'),read('src/pages/ClassPage.tsx'),read('src/pages/TasksPage.tsx'),read('src/pages/CalendarPage.tsx'),read('src/pages/NotificationsPage.tsx'),read('src/pages/HelpPage.tsx'),read('src/pages/QuickMessagesPage.tsx'),read('src/components/NotificationPopup.tsx'),read('src/components/ToastHost.tsx')].join('\n');
const missing=checks.filter(([name,test])=>typeof test==='boolean'?!test:!test.test(sources));
if(missing.length){console.error('CONNECTED UX AUDIT FAILED:',missing.map(x=>x[0]).join(', '));process.exit(1)}
console.log(`CONNECTED UX AUDIT PASS — ${checks.length} connected UX checks.`);
