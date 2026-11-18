import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { homeFor, useAuth } from '../../context/AuthContext';
import { errorMessage } from '../../services/api';
import { Button, Field, Input, Notice } from '../../components/common/ui';

function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-[calc(100vh-64px)] items-start justify-center bg-ink-50 px-4 py-12 sm:py-20">
      <div className="w-full max-w-[400px]">
        <h1 className="text-[24px] font-semibold">{title}</h1>
        <p className="mt-1 text-ink-600">{subtitle}</p>
        <div className="card mt-6 p-6">{children}</div>
        <div className="mt-4 text-center text-[13px] text-ink-600">{footer}</div>
      </div>
    </div>
  );
}

const DEMO_ACCOUNTS = [
  ['Administrator', 'admin@civiclens.demo', 'Admin@1234'],
  ['Citizen (Asha)', 'asha@civiclens.demo', 'Citizen@1234'],
  ['Citizen (Meera)', 'meera@civiclens.demo', 'Citizen@1234'],
];

export function Login() {
  const { login, user, sessionExpired } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={homeFor(user)} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const u = await login(form.email.trim(), form.password);
      const from = loc.state?.from;
      const ok = from && ((u.role === 'admin' && from.startsWith('/admin')) || (u.role !== 'admin' && from.startsWith('/app')));
      navigate(ok ? from : homeFor(u), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Log in"
      subtitle="Access your CivicLens AI account."
      footer={<>New here? <Link to="/register" className="font-medium text-brand-700">Create a citizen account</Link></>}
    >
      {sessionExpired && <div className="mb-4"><Notice tone="warn">Your session expired. Please log in again.</Notice></div>}
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Email" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" required value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input id="password" type="password" autoComplete="current-password" required value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        {error && <p className="flex items-center gap-2 text-[13px] text-red-700"><AlertCircle className="h-4 w-4" />{error}</p>}
        <Button type="submit" className="w-full" loading={busy} disabled={!form.email || !form.password}>Log in</Button>
      </form>
      <div className="mt-6 border-t border-ink-100 pt-4">
        <p className="text-[12px] font-medium uppercase tracking-wide text-ink-500">Demonstration accounts (fictional)</p>
        <div className="mt-2 space-y-1.5">
          {DEMO_ACCOUNTS.map(([role, email, pw]) => (
            <button key={email} type="button" onClick={() => setForm({ email, password: pw })}
              className="flex w-full items-center justify-between rounded-md border border-ink-200 px-3 py-2 text-left text-[13px] hover:bg-ink-50">
              <span className="font-medium text-ink-800">{role}</span>
              <span className="text-ink-500">{email}</span>
            </button>
          ))}
        </div>
        <p className="help">Click to fill the form. Available when demo data is seeded.</p>
      </div>
    </AuthShell>
  );
}

export function Register() {
  const { register, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={homeFor(user)} replace />;

  const validate = () => {
    const e = {};
    if (form.full_name.trim().length < 2) e.full_name = 'Enter your name.';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Enter a valid email address.';
    if (form.password.length < 8) e.password = 'Use at least 8 characters.';
    else if (!/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) e.password = 'Include at least one letter and one number.';
    if (form.confirm !== form.password) e.confirm = 'Passwords do not match.';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    setError('');
    if (!validate()) return;
    setBusy(true);
    try {
      await register({ full_name: form.full_name.trim(), email: form.email.trim(), password: form.password });
      navigate('/app/dashboard', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <AuthShell
      title="Create a citizen account"
      subtitle="Report civic issues and follow them to resolution."
      footer={<>Already registered? <Link to="/login" className="font-medium text-brand-700">Log in</Link></>}
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Full name" htmlFor="full_name" error={errors.full_name}>
          <Input id="full_name" autoComplete="name" value={form.full_name} onChange={set('full_name')} />
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email}>
          <Input id="email" type="email" autoComplete="email" value={form.email} onChange={set('email')} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password} help="At least 8 characters with a letter and a number.">
          <Input id="password" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} />
        </Field>
        <Field label="Confirm password" htmlFor="confirm" error={errors.confirm}>
          <Input id="confirm" type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} />
        </Field>
        {error && <p className="flex items-center gap-2 text-[13px] text-red-700"><AlertCircle className="h-4 w-4" />{error}</p>}
        <Button type="submit" className="w-full" loading={busy}>Create account</Button>
        <p className="text-[12px] text-ink-500">We store only your name, email and a hashed password.</p>
      </form>
    </AuthShell>
  );
}

export function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="text-[13px] font-medium text-ink-500">404</p>
      <h1 className="mt-2 text-[24px] font-semibold">Page not found</h1>
      <p className="mt-2 text-ink-600">The page you are looking for does not exist or was moved.</p>
      <Link to="/" className="mt-6 inline-flex h-10 items-center rounded-md border border-ink-300 px-4 font-medium hover:bg-ink-50">Back to home</Link>
    </div>
  );
}
