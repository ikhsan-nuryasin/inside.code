import { useEffect, useState } from 'react';

export const ACTIVE_CLASS_KEY = 'inside-code-active-class';
const LEGACY_ACTIVE_CLASS_KEY = 'student-hub-active-class';
export function getActiveClassId(){ const value = localStorage.getItem(ACTIVE_CLASS_KEY) || localStorage.getItem(LEGACY_ACTIVE_CLASS_KEY) || ''; if(value && !localStorage.getItem(ACTIVE_CLASS_KEY)) { try { localStorage.setItem(ACTIVE_CLASS_KEY,value); } catch {} } return value; }
export function setActiveClassId(classId:string){ if(classId) localStorage.setItem(ACTIVE_CLASS_KEY,classId); }
export function clearActiveClassId(){ localStorage.removeItem(ACTIVE_CLASS_KEY); localStorage.removeItem(LEGACY_ACTIVE_CLASS_KEY); }
export function openClassModule(classId:string, path:string){ setActiveClassId(classId); nav(path); }

export type Route =
  | { name:'dashboard' } | { name:'classes' } | { name:'tasks' } | { name:'calendar' } | { name:'mybest' } | { name:'notes' }
  | { name:'notifications' } | { name:'cash' } | { name:'documentation' } | { name:'positions' } | { name:'security' } | { name:'admin' }
  | { name:'randomizer' } | { name:'search' } | { name:'help' } | { name:'quick-messages' } | { name:'settings' } | { name:'update-password' } | { name:'class'; classId:string; tab?:string; itemId?:string };

function parse(): Route {
  const raw = window.location.hash.replace(/^#/, '') || '/dashboard';
  const [path, queryString=''] = raw.split('?');
  const p = path.split('/').filter(Boolean);
  const query = new URLSearchParams(queryString);
  if (p[0] === 'classes' && p[1]) {
    const tab = query.get('tab') || undefined;
    const itemId = query.get('item') || undefined;
    return { name:'class', classId:p[1], tab, itemId };
  }
  if (p[0] === 'search') return { name:'search' };
  if (p[0] === 'update-password') return { name:'update-password' };
  const names: Route['name'][] = ['dashboard','classes','tasks','calendar','mybest','notes','notifications','cash','documentation','positions','randomizer','search','help','quick-messages','settings','security','admin'];
  if (names.includes(p[0] as Route['name'])) return { name:p[0] as Exclude<Route,{name:'class'}>['name'] };
  return { name:'dashboard' };
}
export function useRoute(){
  const [route,setRoute] = useState<Route>(parse());
  useEffect(()=>{ const on=()=>setRoute(parse()); window.addEventListener('hashchange',on); return()=>window.removeEventListener('hashchange',on); },[]);
  return route;
}
export const nav=(path:string)=>{ window.location.hash = path.startsWith('#') ? path : `#${path}`; };
