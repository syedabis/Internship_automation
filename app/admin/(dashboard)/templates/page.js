'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Shuffle, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { INK, STATUS, SURFACE } from '../../_components/theme';
import { useAdminRole } from '../../_components/RoleContext';

// Base path — must match `basePath` in next.config.mjs; fetch() does not auto-apply it.
const BASE_PATH = '/certificate';
const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

// Random 4-digit code, matching the format already used by every existing code in
// Sheet2 (5312, 6801, 5683, …). Retries against the currently loaded codes so it
// won't hand back one already in use; the server still enforces this too.
function generateUniqueCode(existingCodes) {
  const used = new Set(existingCodes.map((c) => c.code));
  let code;
  let attempts = 0;
  do {
    code = String(Math.floor(1000 + Math.random() * 9000));
    attempts += 1;
  } while (used.has(code) && attempts < 50);
  return code;
}

// Best-effort "ai_dashboards.png" -> "Ai Dashboards" guess, used to prefill the
// inline backfill form for templates that predate code tracking.
function guessWorkshopFromFilename(filename) {
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

export default function AdminTemplatesPage() {
  const { role } = useAdminRole();
  const isAdmin = role === 'admin';
  const [templates, setTemplates] = useState([]);
  const [codes, setCodes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [workshopInput, setWorkshopInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deletingKey, setDeletingKey] = useState(null);
  const fileInputRef = useRef(null);

  const loadAll = async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const [templatesRes, codesRes] = await Promise.all([
        fetch(`${BASE_PATH}/api/admin/templates`),
        fetch(`${BASE_PATH}/api/admin/codes`),
      ]);
      const templatesResult = await templatesRes.json();
      const codesResult = await codesRes.json();
      if (!templatesRes.ok) throw new Error(templatesResult.error || 'Failed to load templates.');
      if (!codesRes.ok) throw new Error(codesResult.error || 'Failed to load codes.');

      setTemplates(templatesResult.templates || []);
      setCodes(codesResult.codes || []);
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const knownWorkshops = useMemo(
    () => [...new Set(codes.map((c) => c.workshop).filter(Boolean))].sort(),
    [codes]
  );

  // Sheet2 (code, workshop, filename) is the source of truth for which certificates
  // are "real". A certificate is Active only if it has a matching code + workshop
  // row in the sheet. A Drive file with no matching sheet row — code/workshop not
  // mentioned in the sheet — is Inactive, regardless of how nice the file looks.
  const entries = useMemo(() => {
    const templatesByName = new Map(templates.map((t) => [t.name, t]));
    const usedFilenames = new Set();
    const list = [];

    for (const c of codes) {
      const template = c.filename ? templatesByName.get(c.filename) : undefined;
      if (template) usedFilenames.add(template.name);
      list.push({
        key: `code-${c.rowNumber}`,
        workshop: c.workshop,
        code: c.code,
        filename: c.filename || '',
        codeRowNumber: c.rowNumber,
        template: template || null,
        isActive: true,
      });
    }

    for (const t of templates) {
      if (usedFilenames.has(t.name)) continue;
      list.push({
        key: `template-${t.id}`,
        workshop: '',
        code: '',
        filename: t.name,
        codeRowNumber: null,
        template: t,
        isActive: false,
      });
    }

    return list;
  }, [templates, codes]);

  const filteredEntries = useMemo(() => {
    const term = search.trim().toLowerCase();

    return entries.filter((entry) => {
      if (statusFilter === 'active' && !entry.isActive) return false;
      if (statusFilter === 'inactive' && entry.isActive) return false;
      if (!term) return true;

      return [entry.workshop, entry.code, entry.filename].some((value) =>
        String(value || '').toLowerCase().includes(term)
      );
    });
  }, [entries, search, statusFilter]);

  const addCode = async ({ code, workshop, filename }) => {
    const response = await fetch(`${BASE_PATH}/api/admin/codes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, workshop, filename }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Failed to add code.');
    return result.code;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const workshop = workshopInput.trim();
    const code = codeInput.trim();
    const file = fileInputRef.current?.files?.[0];

    if (!workshop || !code) {
      toast.error('Workshop and code are both required.');
      return;
    }

    setIsSaving(true);
    try {
      let filename = '';

      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('workshop', workshop);
        const response = await fetch(`${BASE_PATH}/api/admin/templates`, { method: 'POST', body: formData });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to upload template.');
        setTemplates((prev) => [result.template, ...prev]);
        filename = result.template.name;
      }

      const newCode = await addCode({ code, workshop, filename });
      setCodes((prev) => [...prev, newCode]);

      toast.success(file ? 'Template uploaded and code added.' : 'Code added.');
      setWorkshopInput('');
      setCodeInput('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetCode = async (entry, workshop, code) => {
    const newCode = await addCode({ code, workshop, filename: entry.filename });
    setCodes((prev) => [...prev, newCode]);
    toast.success('Code added.');
  };

  // A card's delete action removes whichever half of the certificate it represents:
  // the Drive file if one is attached, otherwise the sheet row itself.
  const handleDeleteEntry = async (entry) => {
    setDeletingKey(entry.key);
    try {
      if (entry.template) {
        const response = await fetch(`${BASE_PATH}/api/admin/templates/${entry.template.id}`, {
          method: 'DELETE',
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to delete template.');
        setTemplates((prev) => prev.filter((t) => t.id !== entry.template.id));
        toast.success('Template deleted.');
      }

      if (entry.codeRowNumber) {
        const response = await fetch(`${BASE_PATH}/api/admin/codes/${entry.codeRowNumber}`, {
          method: 'DELETE',
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to delete code.');
        setCodes((prev) => prev.filter((c) => c.rowNumber !== entry.codeRowNumber));
        if (!entry.template) toast.success('Code removed.');
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setDeletingKey(null);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1" style={{ color: INK.primary }}>
        Templates & Unlock Codes
      </h1>
      <p className="text-sm mb-6" style={{ color: INK.secondary }}>
        A certificate is Active once it has both a code and a workshop assigned. Uploaded files without
        a code yet are marked Inactive until you set one.
      </p>

      {isAdmin && (
        <form
          onSubmit={handleSave}
          className="mb-6 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center"
          style={{ background: SURFACE.card, borderColor: SURFACE.border }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            className="flex-1 text-sm text-[rgba(var(--adm-ink-primary-rgb),0.7)] file:mr-3 file:rounded-md file:border-0 file:bg-[rgba(var(--adm-ink-primary-rgb),0.08)] file:px-3 file:py-2 file:text-sm file:font-medium file:text-[var(--adm-ink-primary)] hover:file:bg-[rgba(var(--adm-ink-primary-rgb),0.16)]"
          />
          <Input
            value={workshopInput}
            onChange={(e) => setWorkshopInput(e.target.value)}
            placeholder="Workshop name"
            list="known-workshops"
            required
            className="w-full sm:w-56 h-10 rounded-lg text-[var(--adm-ink-primary)] placeholder:text-[rgba(var(--adm-ink-primary-rgb),0.3)]"
            style={{ background: SURFACE.cardAlt, borderColor: SURFACE.border }}
          />
          <div className="flex w-full items-center gap-1.5 sm:w-44">
            <Input
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder="Code"
              required
              className="h-10 flex-1 rounded-lg text-[var(--adm-ink-primary)] placeholder:text-[rgba(var(--adm-ink-primary-rgb),0.3)]"
              style={{ background: SURFACE.cardAlt, borderColor: SURFACE.border }}
            />
            <button
              type="button"
              onClick={() => setCodeInput(generateUniqueCode(codes))}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-[rgba(var(--adm-ink-primary-rgb),0.5)] transition-colors hover:text-[var(--adm-ink-primary)] cursor-pointer"
              style={{ background: SURFACE.cardAlt, borderColor: SURFACE.border }}
              title="Generate a code"
              aria-label="Generate a code"
            >
              <Shuffle className="h-4 w-4" />
            </button>
          </div>
          <datalist id="known-workshops">
            {knownWorkshops.map((workshop) => (
              <option key={workshop} value={workshop} />
            ))}
          </datalist>
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-lg bg-[var(--adm-btn-primary-bg)] px-4 py-2 text-sm font-semibold text-[var(--adm-btn-primary-fg)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </form>
      )}

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm" style={{ color: INK.muted }}>
          {isLoading ? 'Loading…' : `${filteredEntries.length} of ${entries.length} certificates`}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search workshop, code, filename…"
            className="w-full sm:w-64 h-10 rounded-lg text-[var(--adm-ink-primary)] placeholder:text-[rgba(var(--adm-ink-primary-rgb),0.3)]"
            style={{ background: SURFACE.card, borderColor: SURFACE.border }}
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger
              className="w-full sm:w-40 h-10 rounded-lg text-[var(--adm-ink-primary)]"
              style={{ background: SURFACE.card, borderColor: SURFACE.border }}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loadError && (
        <div
          className="mb-4 rounded-lg border px-4 py-3 text-sm"
          style={{ background: 'rgba(208,59,59,0.1)', borderColor: 'rgba(208,59,59,0.3)', color: STATUS.critical }}
        >
          {loadError}
        </div>
      )}

      {isLoading ? (
        <p className="text-center py-8" style={{ color: INK.muted }}>
          Loading certificates…
        </p>
      ) : filteredEntries.length === 0 ? (
        <p className="text-center py-8" style={{ color: INK.muted }}>
          No certificates found.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredEntries.map((entry) => (
            <CertificateCard
              key={entry.key}
              entry={entry}
              existingCodes={codes}
              isDeleting={deletingKey === entry.key}
              onSetCode={handleSetCode}
              onDelete={() => handleDeleteEntry(entry)}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CertificateCard({ entry, existingCodes, isDeleting, onSetCode, onDelete, isAdmin }) {
  const title = entry.workshop || (entry.filename && guessWorkshopFromFilename(entry.filename)) || 'Untitled';

  return (
    <div className="rounded-xl border p-4" style={{ background: SURFACE.card, borderColor: SURFACE.border }}>
      <div
        className="mb-3 flex h-32 items-center justify-center overflow-hidden rounded-lg"
        style={{ background: SURFACE.cardAlt }}
      >
        {entry.template ? (
          <TemplateThumbnail fileId={entry.template.id} name={entry.template.name} />
        ) : (
          <FileText className="h-10 w-10" style={{ color: INK.muted }} />
        )}
      </div>

      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="truncate text-sm font-semibold" style={{ color: INK.primary }} title={entry.filename}>
          {title}
        </p>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
          style={
            entry.isActive
              ? { background: 'rgba(12,163,12,0.15)', color: STATUS.good }
              : { background: 'rgba(250,178,25,0.15)', color: STATUS.warning }
          }
        >
          {entry.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1">
        {entry.isActive ? (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-xs"
            style={{ background: 'rgba(255,255,255,0.06)', color: INK.secondary }}
          >
            {entry.code}
          </span>
        ) : isAdmin ? (
          <InlineCodeForm
            defaultWorkshop={entry.filename ? guessWorkshopFromFilename(entry.filename) : ''}
            existingCodes={existingCodes}
            onSave={(workshop, code) => onSetCode(entry, workshop, code)}
          />
        ) : (
          <span className="text-xs" style={{ color: INK.muted }}>
            No code assigned
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between">
        {entry.template ? (
          <a
            href={entry.template.webViewLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium hover:text-[var(--adm-ink-primary)]"
            style={{ color: INK.muted }}
          >
            View in Drive
          </a>
        ) : (
          <span className="text-xs" style={{ color: INK.muted }}>
            No template file
          </span>
        )}
        {isAdmin && (
          <button
            type="button"
            onClick={onDelete}
            disabled={isDeleting}
            className="disabled:opacity-50 cursor-pointer transition-colors hover:text-red-400"
            style={{ color: INK.muted }}
            aria-label={`Delete ${title}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// Proxies the thumbnail through our own authenticated API route (see
// app/api/admin/templates/[fileId]/thumbnail/route.js) instead of pointing at
// Drive's thumbnailLink directly — that URL only loads for a browser already
// signed into an account with access, which the admin's browser isn't.
function TemplateThumbnail({ fileId, name }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <FileText className="h-10 w-10" style={{ color: INK.muted }} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- proxied via our own API route
    <img
      src={`${BASE_PATH}/api/admin/templates/${fileId}/thumbnail`}
      alt={name}
      className="h-full w-full object-contain"
      onError={() => setFailed(true)}
    />
  );
}

// Small inline form shown on an Inactive card — mainly for backfilling templates
// that were uploaded before code tracking existed, or codes that predate a filename
// column. Pre-fills the workshop name as a best guess from the filename.
function InlineCodeForm({ defaultWorkshop, existingCodes, onSave }) {
  const [workshop, setWorkshop] = useState(defaultWorkshop);
  const [code, setCode] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedWorkshop = workshop.trim();
    const trimmedCode = code.trim();
    if (!trimmedWorkshop || !trimmedCode) {
      toast.error('Workshop and code are both required.');
      return;
    }

    setIsSaving(true);
    try {
      await onSave(trimmedWorkshop, trimmedCode);
      setCode('');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-1.5">
      <Input
        value={workshop}
        onChange={(e) => setWorkshop(e.target.value)}
        placeholder="Workshop name"
        className="h-8 rounded-md text-xs text-[var(--adm-ink-primary)] placeholder:text-[rgba(var(--adm-ink-primary-rgb),0.3)]"
        style={{ background: SURFACE.cardAlt, borderColor: SURFACE.border }}
      />
      <div className="flex gap-1.5">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Code"
          className="h-8 flex-1 rounded-md text-xs text-[var(--adm-ink-primary)] placeholder:text-[rgba(var(--adm-ink-primary-rgb),0.3)]"
          style={{ background: SURFACE.cardAlt, borderColor: SURFACE.border }}
        />
        <button
          type="button"
          onClick={() => setCode(generateUniqueCode(existingCodes))}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-[rgba(var(--adm-ink-primary-rgb),0.5)] transition-colors hover:text-[var(--adm-ink-primary)] cursor-pointer"
          style={{ background: SURFACE.cardAlt, borderColor: SURFACE.border }}
          title="Generate a code"
          aria-label="Generate a code"
        >
          <Shuffle className="h-3.5 w-3.5" />
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-md bg-[var(--adm-btn-primary-bg)] px-2.5 text-xs font-semibold text-[var(--adm-btn-primary-fg)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
        >
          {isSaving ? '…' : 'Set'}
        </button>
      </div>
    </form>
  );
}
