import { useEffect, useState, type ReactNode } from 'react';
import { AppShell } from './components/AppShell';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { ClassesPage } from './pages/ClassesPage';
import { TasksPage } from './pages/TasksPage';
import { CalendarPage } from './pages/CalendarPage';
import { NotesPage } from './pages/NotesPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { SettingsPage } from './pages/SettingsPage';
import { ClassPage } from './pages/ClassPage';
import { CashPage } from './pages/CashPage';
import { DocumentationPage } from './pages/DocumentationPage';
import { PositionsPage } from './pages/PositionsPage';
import { SearchPage } from './pages/SearchPage';
import { SUPABASE_CONFIGURED, supabase } from './lib/supabase';
import { UpdatePasswordPage } from './pages/UpdatePasswordPage';
import { RandomizerPage } from './pages/RandomizerPage';
import { HelpPage } from './pages/HelpPage';
import { QuickMessagesPage } from './pages/QuickMessagesPage';
import { SecurityPage } from './pages/SecurityPage';
import { MfaChallengePage } from './pages/MfaChallengePage';
import { nav, useRoute, type Route } from './lib/router';
import { NotificationPopup } from './components/NotificationPopup';
import { clearLocalData } from './lib/offline';
import { AdminSettingsPage } from './pages/AdminSettingsPage';

function renderPage(route: Route): ReactNode {
  switch (route.name) {
    case 'dashboard': return <DashboardPage />;
    case 'classes': return <ClassesPage />;
    case 'tasks': return <TasksPage />;
    case 'calendar': return <CalendarPage />;
    case 'notes': return <NotesPage />;
    case 'notifications': return <NotificationsPage />;
    case 'cash': return <CashPage />;
    case 'documentation': return <DocumentationPage />;
    case 'positions': return <PositionsPage />;
    case 'randomizer': return <RandomizerPage />;
    case 'search': return <SearchPage />;
    case 'help': return <HelpPage />;
    case 'quick-messages': return <QuickMessagesPage />;
    case 'settings': return <SettingsPage />;
    case 'security': return <SecurityPage />;
    case 'admin': return <AdminSettingsPage />;
    case 'class': return <ClassPage classId={route.classId} initialTab={route.tab} itemId={route.itemId} />;
    case 'update-password': return <UpdatePasswordPage onDone={() => { nav('/dashboard'); location.reload(); }} />;
    default: return <DashboardPage />;
  }
}

async function logoutEverywhere(setSignedIn?: (value: boolean) => void) {
  if (supabase) {
    try { await supabase.auth.signOut({ scope: 'global' }); } catch { /* best effort; local cleanup still matters */ }
  }
  await clearLocalData();
  setSignedIn?.(false);
  nav('/dashboard');
}

function MfaGateApp({ route, setSignedIn }: { route: Route; setSignedIn: (value: boolean) => void }) {
  const [checking, setChecking] = useState(true);
  const [required, setRequired] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [securityError, setSecurityError] = useState('');

  useEffect(() => {
    if (!supabase) { setChecking(false); return; }
    let mounted = true;
    (async () => {
      setChecking(true);
      setSecurityError('');
      try {
        const [aalResult, factorResult] = await Promise.all([
          supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
          supabase.auth.mfa.listFactors(),
        ]);
        if (aalResult.error || factorResult.error) throw aalResult.error || factorResult.error;
        const verified = [...factorResult.data.totp, ...factorResult.data.phone].some(f => f.status === 'verified');
        const current = aalResult.data.currentLevel || 'aal1';
        const next = aalResult.data.nextLevel || current;
        if (mounted) setRequired(verified && current !== 'aal2' && next === 'aal2');
      } catch (error) {
        if (mounted) {
          setRequired(false);
          setSecurityError(error instanceof Error ? error.message : 'Status keamanan akun tidak dapat diverifikasi.');
        }
      } finally {
        if (mounted) setChecking(false);
      }
    })();
    return () => { mounted = false; };
  }, [retryKey]);

  if (checking) return <div className="loading-screen"><div className="spinner" /><strong>Memeriksa keamanan akun…</strong></div>;
  if (securityError) return <div className="loading-screen"><div className="card security-gate-error"><strong>Verifikasi keamanan gagal</strong><p className="muted">Inside Code tidak dapat memastikan status MFA akun ini. Demi keamanan, akses ditahan sampai status berhasil diperiksa.</p><p className="muted">{securityError}</p><div className="button-row"><button className="btn btn-primary" type="button" onClick={() => setRetryKey(v => v + 1)}>Coba lagi</button><button className="btn btn-ghost" type="button" onClick={() => void logoutEverywhere(setSignedIn)}>Keluar</button></div></div></div>;
  if (required) return <MfaChallengePage onVerified={() => setRetryKey(v => v + 1)} onLogout={() => logoutEverywhere(setSignedIn)} />;
  return <AppShell>{renderPage(route)}<NotificationPopup /></AppShell>;
}

export default function App() {
  const route = useRoute();
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    if (!SUPABASE_CONFIGURED || !supabase) { setReady(true); return; }
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) { setSignedIn(Boolean(data.session)); setReady(true); }
    }).catch(() => { if (mounted) setReady(true); });
    const sub = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(Boolean(s)));
    return () => { mounted = false; sub.data.subscription.unsubscribe(); };
  }, []);

  if (!ready) return <div className="loading-screen"><div className="spinner" /><strong>Menyiapkan Inside Code…</strong></div>;
  if (!SUPABASE_CONFIGURED) return <div className="loading-screen"><div className="card" style={{ maxWidth: 520 }}><strong>Konfigurasi Supabase belum lengkap.</strong><p className="muted">Isi VITE_SUPABASE_URL dan VITE_SUPABASE_PUBLISHABLE_KEY di web/.env.local, lalu restart server.</p></div></div>;
  if (route.name === 'update-password') return <UpdatePasswordPage onDone={() => { nav('/dashboard'); location.reload(); }} />;
  if (!signedIn) return <AuthPage onDone={() => setSignedIn(true)} />;
  if (supabase) return <MfaGateApp route={route} setSignedIn={setSignedIn} />;
  return <div className="loading-screen"><div className="card"><strong>Supabase belum tersedia.</strong><p className="muted">Periksa konfigurasi environment lalu muat ulang aplikasi.</p></div></div>;
}
