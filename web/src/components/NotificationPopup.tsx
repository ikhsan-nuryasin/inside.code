import { useEffect, useRef, useState } from 'react';
import { nav } from '../lib/router';
import { listAllAssignments, listNotifications, markNotificationRead, subscribeNotificationPopups } from '../lib/repository';
import type { Notification } from '../types/models';

const PREF_KEY='student-hub-notification-preferences';
const defaultPreferences:Record<string,boolean>={assignment:true,schedule:true,forum:true,material:true,announcement:true,cash:true,group:true,poll:true,documentation:true,system:true};
function getPreferences(){ try { return {...defaultPreferences,...JSON.parse(localStorage.getItem(PREF_KEY)||'{}')} as Record<string,boolean>; } catch { return defaultPreferences; } }
function isEnabled(type:string){ return getPreferences()[type] !== false; }

function reminderFromTask(task:{id:string;title:string;deadline:string|null;progress_status?:string;class_name?:string}): Notification {
  return { id:`local-reminder-${task.id}`, user_id:'local', notification_type:'assignment', title:`Deadline dekat: ${task.title}`, body:`${task.class_name||'Tugas kelas'} · ${task.deadline?new Date(task.deadline).toLocaleString('id-ID'):''}`, data:{local:true,taskId:task.id,classId:(task as {class_id?:string}).class_id}, is_read:false, created_at:new Date().toISOString() };
}

export function NotificationPopup(){
  const [notification,setNotification]=useState<Notification|null>(null);
  const notificationRef=useRef<Notification|null>(null);
  const timer=useRef<number|undefined>(undefined);
  const show=(n:Notification)=>{notificationRef.current=n;setNotification(n); if(timer.current) window.clearTimeout(timer.current); timer.current=window.setTimeout(()=>{notificationRef.current=null;setNotification(null)},6500)};
  const checkReminders=async()=>{
    try{
      const tasks=await listAllAssignments();
      const serverNotifications=await listNotifications().catch(()=>[] as Notification[]);
      const now=Date.now();
      const candidate=tasks.filter(t=>t.progress_status!=='completed'&&t.deadline).map(t=>({...t,diff:new Date(t.deadline!).getTime()-now})).filter(t=>t.diff>0&&t.diff<=24*60*60*1000).sort((a,b)=>a.diff-b.diff)[0];
      if(!candidate||!isEnabled('assignment')||notificationRef.current)return;
      const serverReminderAlreadyCreated=serverNotifications.some(n=>{
        if(n.notification_type!=='assignment')return false;
        const data=(n.data??{}) as Record<string,unknown>;
        const id=typeof data.assignment_id==='string'?data.assignment_id:typeof data.taskId==='string'?data.taskId:'';
        return id===candidate.id && new Date(n.created_at).getTime()>Date.now()-26*60*60*1000;
      });
      if(serverReminderAlreadyCreated)return;
      const key=`student-hub-reminder-shown:${candidate.id}:${new Date().toISOString().slice(0,10)}`;
      if(localStorage.getItem(key))return;
      localStorage.setItem(key,String(Date.now()));
      show(reminderFromTask(candidate));
    }catch{/* offline cache can be incomplete; no popup in that case */}
  };
  useEffect(()=>{
    let mounted=true;
    void listNotifications().then(items=>{if(mounted){const latest=items.find(n=>!n.is_read&&isEnabled(n.notification_type));const lastShown=latest?sessionStorage.getItem('student-hub-last-popup-id'):null;if(latest&&latest.id!==lastShown){sessionStorage.setItem('student-hub-last-popup-id',latest.id);show(latest)}}}).catch(()=>{});
    void checkReminders();
    const reminderTimer=window.setInterval(()=>void checkReminders(),60_000);
    const unsub=subscribeNotificationPopups(n=>{if(n.is_read===false&&isEnabled(n.notification_type)&&!notificationRef.current){sessionStorage.setItem('student-hub-last-popup-id',n.id);show(n)}});
    return ()=>{mounted=false;unsub();window.clearInterval(reminderTimer);if(timer.current)window.clearTimeout(timer.current)};
  },[]);
  if(!notification)return null;
  const isLocal=notification.id.startsWith('local-reminder-');
  const targetHref=()=>{const data=(notification.data??{}) as Record<string,unknown>;const pick=(...keys:string[])=>{for(const key of keys){const value=data[key];if(typeof value==='string'&&value)return value}return ''};const classId=pick('classId','class_id');const taskId=pick('taskId','assignmentId','assignment_id');const materialId=pick('materialId','material_id');const announcementId=pick('announcementId','announcement_id');const topicId=pick('topicId','topic_id');const pollId=pick('pollId','poll_id');const eventId=pick('eventId','event_id');const type=notification.notification_type;if(classId&&taskId&&type==='assignment')return `#/classes/${classId}?tab=tasks&item=${encodeURIComponent(taskId)}`;if(classId&&materialId&&type==='material')return `#/classes/${classId}?tab=materials&item=${encodeURIComponent(materialId)}`;if(classId&&announcementId&&type==='announcement')return `#/classes/${classId}?tab=announcements&item=${encodeURIComponent(announcementId)}`;if(classId&&topicId&&type==='forum')return `#/classes/${classId}?tab=forum&item=${encodeURIComponent(topicId)}`;if(classId&&pollId&&type==='poll')return `#/classes/${classId}?tab=polling&item=${encodeURIComponent(pollId)}`;if(type==='cash')return '#/cash';if(type==='schedule')return classId&&eventId?`#/classes/${classId}?tab=calendar&item=${encodeURIComponent(eventId)}`:'#/calendar';return '#/notifications'};const open=async()=>{if(!isLocal){try{await markNotificationRead(notification.id)}catch{}}notificationRef.current=null;setNotification(null);nav(targetHref())};
  const close=()=>{notificationRef.current=null;setNotification(null)};
  return <aside className="notification-popup" role="status" aria-live="polite">
    <button className="notification-popup-close" onClick={close} aria-label="Tutup notifikasi">×</button>
    <button className="notification-popup-main" onClick={()=>void open()}>
      <span className={`notification-popup-icon type-${notification.notification_type}`}>●</span>
      <span className="notification-popup-copy"><small>{isLocal?'Pengingat tugas':'Notifikasi baru'}</small><strong>{notification.title}</strong><span>{notification.body}</span></span>
      <span className="chevron">›</span>
    </button>
  </aside>;
}
