import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3, ClipboardList, Copy, FilePlus2, Gauge, Layers, LogOut, Map as MapIcon, Menu, User, X,
} from 'lucide-react';
import { homeFor, useAuth } from '../../context/AuthContext';
import { MetaAPI } from '../../services/endpoints';
import { PageLoader } from '../common/ui';

export function Logo({ to = '/', light = false }) {
  return (
    <Link to={to} className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
        <rect width="32" height="32" rx="7" fill="#1a5e55" />
        <circle cx="14" cy="14" r="7" fill="none" stroke="#fff" strokeWidth="2.6" />
        <path d="M19.2 19.2 25 25" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="14" cy="14" r="2.4" fill="#afe2d5" />
      </svg>
      <span className={`text-[16px] font-semibold tracking-tight ${light ? 'text-white' : 'text-ink-950'}`}>
        CivicLens <span className="text-brand-600">AI</span>
      </span>
    </Link>
  );
}

/* ---------------- Public layout ---------------- */
export function PublicLayout() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  const navCls = ({ isActive }) => `text-[14px] ${isActive ? 'text-ink-950 font-medium' : 'text-ink-600 hover:text-ink-950'}`;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-[1000] border-b border-ink-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-7 md:flex">
            <NavLink to="/" end className={navCls}>Product</NavLink>
            <NavLink to="/how-it-works" className={navCls}>How it works</NavLink>
            {user ? (
              <Link to={homeFor(user)} className="rounded-md bg-brand-700 px-4 py-2 text-[14px] font-medium text-white hover:bg-brand-800">
                Open dashboard
              </Link>
            ) : (
              <>
                <NavLink to="/login" className={navCls}>Log in</NavLink>
                <Link to="/register" className="rounded-md bg-brand-700 px-4 py-2 text-[14px] font-medium text-white hover:bg-brand-800">
                  Report an issue
                </Link>
              </>
            )}
          </nav>
          <button className="md:hidden" onClick={() => setOpen((v) => !v)} aria-label="Menu">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {open && (
          <nav className="flex flex-col gap-3 border-t border-ink-100 px-4 py-4 md:hidden">
            <NavLink to="/" end className={navCls}>Product</NavLink>
            <NavLink to="/how-it-works" className={navCls}>How it works</NavLink>
            {user ? <Link to={homeFor(user)} className="font-medium text-brand-700">Open dashboard</Link> : (
              <>
                <NavLink to="/login" className={navCls}>Log in</NavLink>
                <Link to="/register" className="font-medium text-brand-700">Create an account</Link>
              </>
            )}
          </nav>
        )}
      </header>
      <main className="flex-1"><Outlet /></main>
      <footer className="border-t border-ink-200 bg-ink-50">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 md:grid-cols-4">
          <div className="md:col-span-2">
            <Logo />
            <p className="mt-3 max-w-sm text-[13px] text-ink-600">
              AI-assisted civic issue intelligence. A student hackathon project — AI output is always a suggestion
              that requires human review.
            </p>
          </div>
          <div>
            <p className="mb-3 text-[12px] font-medium uppercase tracking-wide text-ink-500">Product</p>
            <ul className="space-y-2 text-[14px] text-ink-700">
              <li><Link to="/" className="hover:text-ink-950">Overview</Link></li>
              <li><Link to="/how-it-works" className="hover:text-ink-950">How it works</Link></li>
              <li><Link to="/how-it-works#priority" className="hover:text-ink-950">Priority scoring</Link></li>
            </ul>
          </div>
          <div>
            <p className="mb-3 text-[12px] font-medium uppercase tracking-wide text-ink-500">Access</p>
            <ul className="space-y-2 text-[14px] text-ink-700">
              <li><Link to="/login" className="hover:text-ink-950">Log in</Link></li>
              <li><Link to="/register" className="hover:text-ink-950">Create citizen account</Link></li>
              <li><a href="/docs" onClick={(e) => { e.preventDefault(); window.open('http://127.0.0.1:8000/docs', '_blank', 'noopener'); }} className="hover:text-ink-950">API documentation</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-ink-200 py-4 text-center text-[12px] text-ink-500">
          CivicLens AI · Map data © OpenStreetMap contributors
        </div>
      </footer>
    </div>
  );
}

/* ---------------- Protected routes ---------------- */
export function ProtectedRoute({ role }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <PageLoader label="Checking your session…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (role && user.role !== role) return <Navigate to={homeFor(user)} replace />;
  return <Outlet />;
}

/* ---------------- App (dashboard) layout ---------------- */
const CITIZEN_NAV = [
  { to: '/app/dashboard', label: 'Dashboard', icon: Gauge },
  { to: '/app/report/new', label: 'Report an issue', icon: FilePlus2 },
  { to: '/app/reports', label: 'My reports', icon: ClipboardList },
  { to: '/app/map', label: 'City map', icon: MapIcon },
  { to: '/app/profile', label: 'Profile', icon: User },
];

const ADMIN_NAV = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: Gauge },
  { to: '/admin/reports', label: 'All reports', icon: ClipboardList },
  { to: '/admin/duplicates', label: 'Duplicate review', icon: Copy, badge: 'dups' },
  { to: '/admin/incidents', label: 'Incidents', icon: Layers },
  { to: '/admin/map', label: 'City map', icon: MapIcon },
  { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/admin/profile', label: 'Profile', icon: User },
];

let aiStatusCache = null;
export function useAIStatus() {
  const [status, setStatus] = useState(aiStatusCache);
  useEffect(() => {
    if (aiStatusCache) return;
    MetaAPI.aiStatus().then((s) => { aiStatusCache = s; setStatus(s); }).catch(() => {});
  }, []);
  return status;
}

export function AIModeChip() {
  const s = useAIStatus();
  if (!s) return null;
  const simulated = s.is_simulated;
  const ok = s.configured;
  const color = simulated ? 'border-amber-300 bg-amber-50 text-amber-900' : ok ? 'border-brand-200 bg-brand-50 text-brand-800' : 'border-red-200 bg-red-50 text-red-800';
  return (
    <span title={s.message} className={`hidden items-center gap-1.5 rounded-md border px-2 py-1 text-[12px] font-medium sm:inline-flex ${color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${simulated ? 'bg-amber-500' : ok ? 'bg-brand-500' : 'bg-red-500'}`} />
      {simulated ? 'Demo mode · simulated AI' : ok ? `Live AI · ${s.model || s.provider}` : 'AI not configured'}
    </span>
  );
}

export function AppLayout({ variant }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const nav = variant === 'admin' ? ADMIN_NAV : CITIZEN_NAV;
  useEffect(() => setMobileOpen(false), [loc.pathname]);

  const doLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center border-b border-ink-100 px-5">
        <Logo to={variant === 'admin' ? '/admin/dashboard' : '/app/dashboard'} />
      </div>
      <div className="px-3 pt-4">
        <p className="px-2 pb-2 text-[11px] font-medium uppercase tracking-wider text-ink-400">
          {variant === 'admin' ? 'Administration' : 'Citizen portal'}
        </p>
        <nav className="flex flex-col gap-0.5">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[14px] transition ${
                isActive ? 'bg-brand-50 font-medium text-brand-800' : 'text-ink-700 hover:bg-ink-50 hover:text-ink-950'}`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="mt-auto border-t border-ink-100 p-3">
        <div className="flex items-center gap-3 rounded-md px-2 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-100 text-[13px] font-semibold text-ink-700">
            {user?.full_name?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-ink-900">{user?.full_name}</p>
            <p className="truncate text-[12px] text-ink-500">{user?.email}</p>
          </div>
          <button onClick={doLogout} title="Log out" aria-label="Log out" className="rounded p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-900">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-canvas">
      <aside className="fixed inset-y-0 left-0 z-[1100] hidden w-60 border-r border-ink-200 bg-white lg:block">{sidebar}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-[1200] lg:hidden">
          <div className="absolute inset-0 bg-ink-950/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-white shadow-pop">{sidebar}</aside>
        </div>
      )}
      <div className="lg:pl-60">
        <header className="sticky top-0 z-[1000] flex h-14 items-center justify-between gap-3 border-b border-ink-200 bg-white/95 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <button className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
            <span className="text-[13px] text-ink-500 lg:hidden"><Logo /></span>
          </div>
          <div className="flex items-center gap-3">
            <AIModeChip />
            {variant === 'citizen' && (
              <Link to="/app/report/new" className="hidden h-8 items-center gap-1.5 rounded-md bg-brand-700 px-3 text-[13px] font-medium text-white hover:bg-brand-800 sm:inline-flex">
                <FilePlus2 className="h-4 w-4" /> New report
              </Link>
            )}
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8"><Outlet /></main>
      </div>
    </div>
  );
}
