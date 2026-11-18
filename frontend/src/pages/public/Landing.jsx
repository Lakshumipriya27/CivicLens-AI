import { Link } from 'react-router-dom';
import { ArrowRight, Camera, GitMerge, Gauge, MapPinned, ScanSearch, ShieldCheck } from 'lucide-react';
import { useAuth, homeFor } from '../../context/AuthContext';

function ConvergenceDiagram() {
  // Three separate citizen reports -> AI duplicate suggestion -> one reviewed incident.
  const reports = [
    { y: 34, code: 'CL-…A41', txt: 'Deep pothole near school gate' },
    { y: 104, code: 'CL-…B07', txt: 'Large pothole, school entrance' },
    { y: 174, code: 'CL-…C93', txt: 'Big pothole at the school entrance' },
  ];
  return (
    <svg viewBox="0 0 560 220" className="h-auto w-full" role="img" aria-label="Three reports grouped into one incident">
      {reports.map((r) => (
        <g key={r.code}>
          <rect x="4" y={r.y - 22} width="196" height="44" rx="6" fill="#fff" stroke="#cbd5e1" />
          <circle cx="22" cy={r.y} r="5" fill="#475569" />
          <text x="36" y={r.y - 4} fontSize="11" fill="#64748b" fontFamily="inherit">{r.code}</text>
          <text x="36" y={r.y + 11} fontSize="12" fill="#111c2d" fontFamily="inherit">{r.txt}</text>
          <path d={`M200 ${r.y} C 250 ${r.y}, 250 104, 290 104`} fill="none" stroke="#94a3b8" strokeDasharray="4 4" />
        </g>
      ))}
      <rect x="290" y="80" width="96" height="48" rx="6" fill="#f8fafc" stroke="#cbd5e1" />
      <text x="338" y="100" fontSize="11" textAnchor="middle" fill="#475569" fontFamily="inherit">Match 0.81</text>
      <text x="338" y="116" fontSize="11" textAnchor="middle" fill="#475569" fontFamily="inherit">25 m · same type</text>
      <path d="M386 104 L 410 104" stroke="#1a5e55" strokeWidth="2" />
      <text x="398" y="96" fontSize="9" textAnchor="middle" fill="#1a5e55" fontFamily="inherit">✓</text>
      <rect x="410" y="62" width="146" height="84" rx="8" fill="#effaf7" stroke="#2a9180" />
      <text x="424" y="84" fontSize="11" fill="#1a5e55" fontFamily="inherit" fontWeight="600">INCIDENT · 3 reports</text>
      <text x="424" y="104" fontSize="12" fill="#111c2d" fontFamily="inherit">School Lane pothole</text>
      <rect x="424" y="116" width="62" height="18" rx="4" fill="#c4570a" />
      <text x="455" y="129" fontSize="11" textAnchor="middle" fill="#fff" fontFamily="inherit" fontWeight="600">High 68</text>
    </svg>
  );
}

const FEATURES = [
  {
    icon: ScanSearch,
    title: 'Photo analysis that explains itself',
    body: 'A vision model suggests the issue category, a severity level and a short description of what is visibly in the photo. Citizens review and edit it before submitting.',
  },
  {
    icon: GitMerge,
    title: 'Duplicate detection across reports',
    body: 'Distance, category, wording, timing and image similarity are combined into a match score. An administrator confirms every grouping — nothing is merged automatically.',
  },
  {
    icon: Gauge,
    title: 'Transparent priority score',
    body: 'Severity, corroborating reports, public exposure and waiting time feed a configurable formula. Every score shows how much each factor contributed.',
  },
  {
    icon: MapPinned,
    title: 'One map of incidents, not complaints',
    body: 'Administrators see grouped incidents sized by the number of linked reports and coloured by priority, alongside reports still awaiting review.',
  },
];

const STEPS = [
  ['Report', 'Citizen uploads a photo and confirms the location on the map.'],
  ['Analyse', 'AI suggests category, severity and a description of visible evidence.'],
  ['Match', 'Similar nearby reports are flagged as possible duplicates.'],
  ['Group', 'An administrator confirms matches; reports link to one incident.'],
  ['Prioritise', 'The incident gets an explainable 0–100 priority score.'],
  ['Resolve', 'Status changes and resolution evidence reach every linked citizen.'],
];

export default function Landing() {
  const { user } = useAuth();
  const primary = user ? homeFor(user) : '/register';
  return (
    <>
      <section className="border-b border-ink-200">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:py-24">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-md border border-ink-200 px-2.5 py-1 text-[12px] font-medium text-ink-600">
              <ShieldCheck className="h-3.5 w-3.5 text-brand-600" /> AI assists. People decide.
            </p>
            <h1 className="text-[36px] font-semibold leading-[1.12] sm:text-[44px]">
              Turn scattered civic complaints into incidents a city can act on.
            </h1>
            <p className="mt-5 max-w-xl text-[16px] text-ink-600">
              CivicLens AI analyses citizen photos, spots reports that describe the same problem, and ranks
              the resulting incidents with a priority score anyone can audit.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={primary} className="inline-flex h-11 items-center gap-2 rounded-md bg-brand-700 px-5 font-medium text-white hover:bg-brand-800">
                {user ? 'Open your dashboard' : 'Report an issue'} <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/how-it-works" className="inline-flex h-11 items-center rounded-md border border-ink-300 px-5 font-medium text-ink-800 hover:bg-ink-50">
                How it works
              </Link>
            </div>
          </div>
          <div className="card p-5">
            <p className="mb-3 text-[12px] font-medium uppercase tracking-wide text-ink-500">Example · illustrative</p>
            <ConvergenceDiagram />
          </div>
        </div>
      </section>

      <section className="bg-ink-50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="grid gap-10 md:grid-cols-[1fr_1.4fr]">
            <div>
              <h2 className="text-[26px] font-semibold leading-tight">The problem is not a lack of reports.</h2>
            </div>
            <div className="space-y-4 text-[15px] text-ink-700">
              <p>
                Potholes, overflowing bins, blocked drains and dark streets get reported through many channels,
                often by several people about the same spot. Each report lands as a separate ticket.
              </p>
              <p>
                Authorities are left counting complaints instead of incidents: it is hard to tell how many real
                problems exist, which ones are most severe, and which have been waiting longest.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-[26px] font-semibold">What CivicLens adds</h2>
          <p className="mt-2 max-w-2xl text-ink-600">Four capabilities that sit between the citizen&apos;s photo and the work order.</p>
          <div className="mt-10 grid gap-px overflow-hidden rounded-lg border border-ink-200 bg-ink-200 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="bg-white p-6">
                <Icon className="h-5 w-5 text-brand-700" />
                <h3 className="mt-4 text-[16px] font-semibold">{title}</h3>
                <p className="mt-2 text-[14px] text-ink-600">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-ink-200 bg-ink-50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-[26px] font-semibold">From report to resolved incident</h2>
          <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-6">
            {STEPS.map(([t, d], i) => (
              <li key={t} className="relative">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-brand-300 bg-white text-[12px] font-semibold text-brand-700">{i + 1}</span>
                  <span className="font-semibold">{t}</span>
                </div>
                <p className="mt-2 text-[13px] text-ink-600">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section>
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-16 sm:px-6 md:flex-row md:items-center">
          <div>
            <h2 className="text-[24px] font-semibold">See a problem on your street?</h2>
            <p className="mt-1 text-ink-600">Take a photo, confirm the location, and track it until it is fixed.</p>
          </div>
          <div className="flex gap-3">
            <Link to={primary} className="inline-flex h-11 items-center gap-2 rounded-md bg-brand-700 px-5 font-medium text-white hover:bg-brand-800">
              <Camera className="h-4 w-4" /> {user ? 'Go to dashboard' : 'Create a free account'}
            </Link>
            {!user && (
              <Link to="/login" className="inline-flex h-11 items-center rounded-md border border-ink-300 px-5 font-medium text-ink-800 hover:bg-ink-50">Log in</Link>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
