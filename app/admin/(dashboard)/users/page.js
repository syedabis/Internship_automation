'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import { ImagePlus, KeyRound, Pencil, Shuffle, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { INK, STATUS, SURFACE } from '../../_components/theme';

// Base path — must match `basePath` in next.config.mjs; fetch() does not auto-apply it.
const BASE_PATH = '';
const ROLE_OPTIONS = [
  { value: 'general', label: 'Viewer (read-only)' },
  { value: 'admin', label: 'Admin (full control)' },
];

function suggestUsername(email) {
  const local = (email.split('@')[0] || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return local || `user${Math.floor(1000 + Math.random() * 9000)}`;
}

// Cryptographically random, not Math.random() — this becomes someone's real
// login credential.
function generatePassword(length = 14) {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*';
  const values = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(values, (v) => charset[v % charset.length]).join('');
}

// A small square that uploads a file to POST /api/admin/users/logo (Supabase
// Storage under the hood — see lib/supabaseStorage.js) and reports back the
// resulting public URL. `value`/`onChange` carry that URL, same shape as the
// old plain-text field it replaced, so callers don't need to know it's now an
// upload.
function LogoUploadField({ value, onChange, size = 'default' }) {
  const inputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const boxSize = size === 'sm' ? 'h-9 w-9' : 'h-10 w-10';

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file next time
    if (!file) return;

    setIsUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const response = await fetch(`${BASE_PATH}/api/admin/users/logo`, { method: 'POST', body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to upload logo.');
      onChange(result.url);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={isUploading}
        className={`flex ${boxSize} shrink-0 items-center justify-center overflow-hidden rounded-lg border text-[rgba(var(--adm-ink-primary-rgb),0.4)] transition-colors hover:text-[var(--adm-ink-primary)] disabled:opacity-50 cursor-pointer`}
        style={{ background: SURFACE.cardAlt, borderColor: SURFACE.border }}
        title={value ? 'Replace logo' : 'Upload logo'}
        aria-label={value ? 'Replace logo' : 'Upload logo'}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage public URL
          <img src={value} alt="" className="h-full w-full object-contain" />
        ) : (
          <ImagePlus className="h-4 w-4" />
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={handleFile}
      />
      <span className="text-xs" style={{ color: INK.muted }}>
        {isUploading ? 'Uploading…' : value ? 'Logo set' : 'No logo'}
      </span>
      {value && !isUploading && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="text-xs underline cursor-pointer"
          style={{ color: INK.muted }}
        >
          Remove
        </button>
      )}
    </div>
  );
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [role, setRole] = useState('general');
  const [password, setPassword] = useState(generatePassword());
  const [isSaving, setIsSaving] = useState(false);
  const [deletingEmail, setDeletingEmail] = useState(null);
  const [resettingEmail, setResettingEmail] = useState(null);
  const [editingBrandingEmail, setEditingBrandingEmail] = useState(null);
  const [workshopOptions, setWorkshopOptions] = useState([]);
  const [selectedWorkshops, setSelectedWorkshops] = useState([]);
  const [orgName, setOrgName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  const loadUsers = async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const response = await fetch(`${BASE_PATH}/api/admin/users`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to load users.');
      setUsers(result.users || []);
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();

    fetch(`${BASE_PATH}/api/workshops`)
      .then((res) => (res.ok ? res.json() : { workshops: [] }))
      .then((data) => setWorkshopOptions(data.workshops || []))
      .catch(() => setWorkshopOptions([]));
  }, []);

  const toggleWorkshop = (workshop) => {
    setSelectedWorkshops((prev) =>
      prev.includes(workshop) ? prev.filter((w) => w !== workshop) : [...prev, workshop]
    );
  };

  const handleEmailChange = (value) => {
    setEmail(value);
    // Keep the username suggestion in sync with the email until the admin edits
    // it directly — after that, leave their choice alone.
    if (!usernameTouched) {
      setUsername(suggestUsername(value));
    }
  };

  const resetForm = () => {
    setEmail('');
    setUsername('');
    setUsernameTouched(false);
    setRole('general');
    setPassword(generatePassword());
    setSelectedWorkshops([]);
    setOrgName('');
    setLogoUrl('');
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    const trimmedUsername = username.trim();

    if (!trimmedEmail || !trimmedUsername || !password) {
      toast.error('Email, username, and password are all required.');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`${BASE_PATH}/api/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmedEmail,
          username: trimmedUsername,
          role,
          password,
          workshops: selectedWorkshops,
          orgName: orgName.trim(),
          logoUrl: logoUrl.trim(),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to create user.');

      setUsers((prev) => [...prev, result.user]);
      toast.success(`User created — share the password with ${trimmedEmail} now, it won't be shown again.`);
      resetForm();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (userEmail) => {
    setDeletingEmail(userEmail);
    try {
      const response = await fetch(`${BASE_PATH}/api/admin/users/${encodeURIComponent(userEmail)}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to delete user.');

      setUsers((prev) => prev.filter((u) => u.email !== userEmail));
      toast.success('User removed.');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setDeletingEmail(null);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1" style={{ color: INK.primary }}>
        Team Accounts & Permissions
      </h1>
      <p className="text-sm mb-6" style={{ color: INK.secondary }}>
        Viewers can see data; Admins can also manage it. Assign workshops to limit what an account sees,
        or leave it on "All" for full access.
      </p>

      <form
        onSubmit={handleCreate}
        className="mb-6 flex flex-col gap-3 rounded-xl border p-4"
        style={{ background: SURFACE.card, borderColor: SURFACE.border }}
      >
        <div className="flex flex-col gap-1.5 sm:flex-row">
          <Input
            type="email"
            value={email}
            onChange={(e) => handleEmailChange(e.target.value)}
            placeholder="Email"
            required
            className="h-10 rounded-lg text-[var(--adm-ink-primary)] placeholder:text-[rgba(var(--adm-ink-primary-rgb),0.3)] sm:flex-1"
            style={{ background: SURFACE.cardAlt, borderColor: SURFACE.border }}
          />
          <Input
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setUsernameTouched(true);
            }}
            placeholder="Username"
            required
            className="h-10 rounded-lg text-[var(--adm-ink-primary)] placeholder:text-[rgba(var(--adm-ink-primary-rgb),0.3)] sm:flex-1"
            style={{ background: SURFACE.cardAlt, borderColor: SURFACE.border }}
          />
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger
              className="h-10 rounded-lg text-[var(--adm-ink-primary)] sm:flex-1"
              style={{ background: SURFACE.cardAlt, borderColor: SURFACE.border }}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            className="h-10 rounded-lg font-mono text-[var(--adm-ink-primary)] placeholder:text-[rgba(var(--adm-ink-primary-rgb),0.3)] sm:flex-1"
            style={{ background: SURFACE.cardAlt, borderColor: SURFACE.border }}
          />
          <button
            type="button"
            onClick={() => setPassword(generatePassword())}
            className="flex h-10 w-10 shrink-0 items-center justify-center self-end rounded-lg border text-[rgba(var(--adm-ink-primary-rgb),0.5)] transition-colors hover:text-[var(--adm-ink-primary)] cursor-pointer sm:self-auto"
            style={{ background: SURFACE.cardAlt, borderColor: SURFACE.border }}
            title="Generate a password"
            aria-label="Generate a password"
          >
            <Shuffle className="h-4 w-4" />
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="h-10 shrink-0 rounded-lg bg-[var(--adm-btn-primary-bg)] px-4 text-sm font-semibold text-[var(--adm-btn-primary-fg)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? 'Creating…' : 'Create user'}
          </button>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium" style={{ color: INK.secondary }}>
            Workshops
          </p>
          <div
            className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto rounded-lg border p-2.5"
            style={{ background: SURFACE.cardAlt, borderColor: SURFACE.border }}
          >
            <button
              type="button"
              onClick={() => setSelectedWorkshops([])}
              className="rounded-full border px-3 py-1 text-xs font-medium transition-colors cursor-pointer"
              style={
                selectedWorkshops.length === 0
                  ? {
                      background: 'var(--adm-btn-primary-bg)',
                      color: 'var(--adm-btn-primary-fg)',
                      borderColor: 'var(--adm-btn-primary-bg)',
                    }
                  : { background: 'transparent', color: INK.secondary, borderColor: SURFACE.border }
              }
            >
              All
            </button>
            {workshopOptions.map((workshop) => {
              const isSelected = selectedWorkshops.includes(workshop);
              return (
                <button
                  key={workshop}
                  type="button"
                  onClick={() => toggleWorkshop(workshop)}
                  className="rounded-full border px-3 py-1 text-xs font-medium transition-colors cursor-pointer"
                  style={
                    isSelected
                      ? {
                      background: 'var(--adm-btn-primary-bg)',
                      color: 'var(--adm-btn-primary-fg)',
                      borderColor: 'var(--adm-btn-primary-bg)',
                    }
                      : { background: 'transparent', color: INK.secondary, borderColor: SURFACE.border }
                  }
                >
                  {workshop}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
          <Input
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="Organization name (optional — shown in their nav bar)"
            className="h-10 rounded-lg text-[var(--adm-ink-primary)] placeholder:text-[rgba(var(--adm-ink-primary-rgb),0.3)] sm:flex-1"
            style={{ background: SURFACE.cardAlt, borderColor: SURFACE.border }}
          />
          <LogoUploadField value={logoUrl} onChange={setLogoUrl} />
        </div>
      </form>

      {loadError && (
        <div
          className="mb-4 rounded-lg border px-4 py-3 text-sm"
          style={{ background: 'rgba(208,59,59,0.1)', borderColor: 'rgba(208,59,59,0.3)', color: STATUS.critical }}
        >
          {loadError}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border" style={{ background: SURFACE.card, borderColor: SURFACE.border }}>
        <table className="w-full text-sm">
          <thead>
            <tr
              className="border-b text-left text-xs font-semibold uppercase tracking-wide"
              style={{ borderColor: SURFACE.border, color: INK.muted, background: SURFACE.cardAlt }}
            >
              <th className="whitespace-nowrap px-4 py-3">Email</th>
              <th className="whitespace-nowrap px-4 py-3">Username</th>
              <th className="whitespace-nowrap px-4 py-3">Role</th>
              <th className="px-4 py-3">Workshops</th>
              <th className="px-4 py-3">Organization</th>
              <th className="whitespace-nowrap px-4 py-3">Created</th>
              <th className="whitespace-nowrap px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center" style={{ color: INK.muted }}>
                  Loading users…
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center" style={{ color: INK.muted }}>
                  No users yet — the master admin login still works regardless.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <Fragment key={user.email}>
                  <tr className="border-b last:border-0" style={{ borderColor: SURFACE.border }}>
                    <td className="whitespace-nowrap px-4 py-3" style={{ color: INK.primary }}>
                      {user.email}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3" style={{ color: INK.secondary }}>
                      {user.username}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
                        style={
                          user.role === 'admin'
                            ? { background: 'rgba(57,135,229,0.15)', color: '#3987e5' }
                            : { background: 'rgba(255,255,255,0.08)', color: INK.muted }
                        }
                      >
                        {user.role === 'admin' ? 'Admin' : 'Viewer'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {user.workshops && user.workshops.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {user.workshops.map((w) => (
                            <span
                              key={w}
                              className="rounded-full px-2 py-0.5 text-[11px]"
                              style={{ background: 'rgba(255,255,255,0.06)', color: INK.secondary }}
                            >
                              {w}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs" style={{ color: INK.muted }}>
                          All (unrestricted)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {user.orgName ? (
                        <div className="flex items-center gap-1.5">
                          {user.logoUrl && (
                            // eslint-disable-next-line @next/next/no-img-element -- external, admin-supplied URL
                            <img
                              src={user.logoUrl}
                              alt=""
                              className="h-4 w-4 shrink-0 rounded object-contain"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          )}
                          <span className="whitespace-nowrap" style={{ color: INK.secondary }}>
                            {user.orgName}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs" style={{ color: INK.muted }}>
                          Default
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3" style={{ color: INK.muted }}>
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            setEditingBrandingEmail((prev) => (prev === user.email ? null : user.email))
                          }
                          className="text-[rgba(var(--adm-ink-primary-rgb),0.4)] hover:text-[var(--adm-ink-primary)] disabled:opacity-50 cursor-pointer"
                          aria-label={`Edit branding for ${user.email}`}
                          title="Edit organization branding"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setResettingEmail((prev) => (prev === user.email ? null : user.email))}
                          className="text-[rgba(var(--adm-ink-primary-rgb),0.4)] hover:text-[var(--adm-ink-primary)] disabled:opacity-50 cursor-pointer"
                          aria-label={`Reset password for ${user.email}`}
                          title="Reset password"
                        >
                          <KeyRound className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(user.email)}
                          disabled={deletingEmail === user.email}
                          className="text-[rgba(var(--adm-ink-primary-rgb),0.4)] hover:text-red-400 disabled:opacity-50 cursor-pointer"
                          aria-label={`Delete ${user.email}`}
                          title="Delete user"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {resettingEmail === user.email && (
                    <tr className="border-b last:border-0" style={{ borderColor: SURFACE.border }}>
                      <td colSpan={7} className="px-4 pb-4">
                        <ResetPasswordForm
                          email={user.email}
                          onCancel={() => setResettingEmail(null)}
                          onDone={() => setResettingEmail(null)}
                        />
                      </td>
                    </tr>
                  )}
                  {editingBrandingEmail === user.email && (
                    <tr className="border-b last:border-0" style={{ borderColor: SURFACE.border }}>
                      <td colSpan={7} className="px-4 pb-4">
                        <BrandingForm
                          user={user}
                          onCancel={() => setEditingBrandingEmail(null)}
                          onDone={(updatedUser) => {
                            setUsers((prev) => prev.map((u) => (u.email === updatedUser.email ? updatedUser : u)));
                            setEditingBrandingEmail(null);
                          }}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Updates the account's password hash in place (see lib/users.js
// resetUserPassword) — no deletion/re-creation, role and history stay intact.
function ResetPasswordForm({ email, onCancel, onDone }) {
  const [password, setPassword] = useState(generatePassword());
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`${BASE_PATH}/api/admin/users/${encodeURIComponent(email)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to reset password.');

      toast.success(`Password reset — share it with ${email} now, it won't be shown again.`);
      onDone();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center"
      style={{ background: SURFACE.cardAlt, borderColor: SURFACE.border }}
    >
      <span className="whitespace-nowrap text-xs" style={{ color: INK.muted }}>
        New password:
      </span>
      <div className="flex flex-1 items-center gap-1.5">
        <Input
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-9 flex-1 rounded-lg font-mono text-[var(--adm-ink-primary)]"
          style={{ background: SURFACE.card, borderColor: SURFACE.border }}
        />
        <button
          type="button"
          onClick={() => setPassword(generatePassword())}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-[rgba(var(--adm-ink-primary-rgb),0.5)] transition-colors hover:text-[var(--adm-ink-primary)] cursor-pointer"
          style={{ background: SURFACE.card, borderColor: SURFACE.border }}
          title="Generate a password"
          aria-label="Generate a password"
        >
          <Shuffle className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-lg bg-[var(--adm-btn-primary-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--adm-btn-primary-fg)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
        >
          {isSaving ? 'Saving…' : 'Confirm reset'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors hover:text-[var(--adm-ink-primary)] cursor-pointer"
          style={{ borderColor: SURFACE.border, color: INK.muted }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// Edits an existing account's org name / logo — the nav-bar branding shown to
// that account. Uses the same PATCH endpoint as password reset (lib/users.js
// updateUserBranding), distinguished by which fields the request body carries.
function BrandingForm({ user, onCancel, onDone }) {
  const [orgNameValue, setOrgNameValue] = useState(user.orgName || '');
  const [logoUrlValue, setLogoUrlValue] = useState(user.logoUrl || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`${BASE_PATH}/api/admin/users/${encodeURIComponent(user.email)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgName: orgNameValue.trim(), logoUrl: logoUrlValue.trim() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to update branding.');

      toast.success('Branding updated.');
      onDone(result.user);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center"
      style={{ background: SURFACE.cardAlt, borderColor: SURFACE.border }}
    >
      <div className="flex flex-1 flex-col gap-1.5 sm:flex-row sm:items-center">
        <Input
          value={orgNameValue}
          onChange={(e) => setOrgNameValue(e.target.value)}
          placeholder="Organization name (blank = default)"
          className="h-9 rounded-lg text-[var(--adm-ink-primary)] placeholder:text-[rgba(var(--adm-ink-primary-rgb),0.3)] sm:flex-1"
          style={{ background: SURFACE.card, borderColor: SURFACE.border }}
        />
        <LogoUploadField value={logoUrlValue} onChange={setLogoUrlValue} size="sm" />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-lg bg-[var(--adm-btn-primary-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--adm-btn-primary-fg)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
        >
          {isSaving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors hover:text-[var(--adm-ink-primary)] cursor-pointer"
          style={{ borderColor: SURFACE.border, color: INK.muted }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
