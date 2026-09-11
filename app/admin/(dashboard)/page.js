'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Award,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  GraduationCap,
  Users,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CATEGORICAL, INK, STATUS, SURFACE } from '../_components/theme';
import { BarList, Sparkline, TrendChart } from '../_components/charts';
import { useAdminRole } from '../_components/RoleContext';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
// 30 days rather than 14 — submissions cluster around live masterclass dates
// rather than trickling in daily, so a short window can land entirely inside a
// quiet stretch and make real activity look flatter than it is.
const TREND_DAYS = 30;

// Base path — must match `basePath` in next.config.mjs; fetch() does not auto-apply it.
const BASE_PATH = '';
const ALL_WORKSHOPS = '__all__';
const ALL_UNIVERSITIES = '__all__';
const ALL_DOMAINS = '__all__';
const SENT_STATUS = 'sent';
const FAILED_STATUS = 'failed';
const STATUS_COLUMN_CANDIDATES = ['certificate', 'status'];
const ACTIONS_COLUMN_WIDTH = 140;
// Per-column pixel widths (by lowercased header name) — generous enough that
// typical values (names, university names, workshop titles) show in full.
// The table's min-width (computed below from these) makes the surrounding
// `overflow-x-auto` wrapper actually scroll on narrower viewports instead of
// squeezing every column down to fit, which was cutting real data off.
const COLUMN_WIDTHS = {
  timestamp: 110,
  name: 160,
  email: 220,
  phone: 130,
  university: 220,
  domain: 140,
  graduation_year: 130,
  workshop: 220,
  certificate: 100,
  status: 100,
  // Rendered as a short "View" link (see the table body below), not the raw
  // URL, so it doesn't need nearly as much room.
  linkedin_url: 90,
};
const DEFAULT_COLUMN_WIDTH = 160;
const PAGE_SIZE_OPTIONS = [25, 50, 100];
const DEFAULT_PAGE_SIZE = 50;

function getColumnWidth(header) {
  return COLUMN_WIDTHS[header.toLowerCase()] || DEFAULT_COLUMN_WIDTH;
}

function dayLabel(date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export default function AdminSubmissionsPage() {
  const { role } = useAdminRole();
  const isAdmin = role === 'admin';
  const [submissions, setSubmissions] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [workshopFilter, setWorkshopFilter] = useState(ALL_WORKSHOPS);
  const [workshopOptions, setWorkshopOptions] = useState([]);
  const [universityFilter, setUniversityFilter] = useState(ALL_UNIVERSITIES);
  const [domainFilter, setDomainFilter] = useState(ALL_DOMAINS);
  const [savingRow, setSavingRow] = useState(null);
  // Most recent first by default.
  const [sortDirection, setSortDirection] = useState('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const statusKey = useMemo(
    () => headers.find((h) => STATUS_COLUMN_CANDIDATES.includes(h.toLowerCase())),
    [headers]
  );
  const programKey = useMemo(
    () => headers.find((h) => h.toLowerCase().includes('program') || h.toLowerCase().includes('internship') || h.toLowerCase() === 'workshop'),
    [headers]
  );
  const workshopKey = useMemo(() => headers.find((h) => h.toLowerCase() === 'workshop'), [headers]);
  const timestampKey = useMemo(() => headers.find((h) => h.toLowerCase() === 'timestamp'), [headers]);
  const linkedinKey = useMemo(() => headers.find((h) => h.toLowerCase().includes('linkedin')), [headers]);
  const universityKey = useMemo(() => headers.find((h) => h.toLowerCase() === 'university'), [headers]);
  const domainKey = useMemo(() => headers.find((h) => h.toLowerCase() === 'domain'), [headers]);

  const programOptions = useMemo(() => {
    const pKey = programKey || workshopKey;
    if (!pKey) return [];
    const values = new Set();
    for (const row of submissions) {
      const v = String(row[pKey] || '').trim();
      if (v) values.add(v);
    }
    return [...values].sort((a, b) => a.localeCompare(b));
  }, [submissions, programKey, workshopKey]);

  // University/domain are free-text fields (no master list like workshops has),
  // so the filter's own options come from whatever values already appear in
  // the loaded data rather than a separate lookup.
  const universityOptions = useMemo(() => {
    if (!universityKey) return [];
    const values = new Set();
    for (const row of submissions) {
      const v = String(row[universityKey] || '').trim();
      if (v) values.add(v);
    }
    return [...values].sort((a, b) => a.localeCompare(b));
  }, [submissions, universityKey]);
  const domainOptions = useMemo(() => {
    if (!domainKey) return [];
    const values = new Set();
    for (const row of submissions) {
      const v = String(row[domainKey] || '').trim();
      if (v) values.add(v);
    }
    return [...values].sort((a, b) => a.localeCompare(b));
  }, [submissions, domainKey]);

  // What the table actually renders: the sheet's own header order, minus the
  // code column (redundant once you can already see the workshop name) and
  // with the status column moved to the end (so "was it sent" reads as the
  // final word on each row, not buried in the middle).
  const displayHeaders = useMemo(() => {
    const withoutCode = headers.filter((h) => h.toLowerCase() !== 'code');
    if (!statusKey) return withoutCode;
    return [...withoutCode.filter((h) => h !== statusKey), statusKey];
  }, [headers, statusKey]);

  // Sum of every column's own width, so the table can be told to never shrink
  // below that — otherwise `table-fixed` + `w-full` squeezes every column down
  // to fit the container no matter how wide the values actually are, and the
  // surrounding `overflow-x-auto` never has anything to scroll.
  const tableMinWidth = useMemo(
    () => displayHeaders.reduce((sum, h) => sum + getColumnWidth(h), isAdmin ? ACTIONS_COLUMN_WIDTH : 0),
    [displayHeaders, isAdmin]
  );

  const statusOf = (row) => (statusKey ? String(row[statusKey] || '').toLowerCase() : '');

  // "Last 30 days" only counts rows with a parseable timestamp — older historical
  // rows in this sheet predate the timestamp column and are blank, so they're
  // correctly excluded rather than mis-counted.
  const stats = useMemo(() => {
    const total = submissions.length;
    let sent = 0;
    let last30Days = 0;
    let undated = 0;
    const cutoff = Date.now() - THIRTY_DAYS_MS;

    for (const row of submissions) {
      const s = statusOf(row);
      if (s === SENT_STATUS || s === 'completed') sent++;

      const rawTimestamp = timestampKey ? row[timestampKey] : '';
      const parsed = rawTimestamp ? Date.parse(rawTimestamp) : NaN;
      if (!rawTimestamp || Number.isNaN(parsed)) {
        undated++;
      } else if (parsed >= cutoff) {
        last30Days++;
      }
    }

    const pending = total - sent;
    return { total, sent, pending, last30Days, undated };
  }, [submissions, statusKey, timestampKey]);

  // Daily counts for the trend chart + card sparklines, bucketed over the last
  // TREND_DAYS days. Real data only — rows without a parseable timestamp (the
  // older historical batch) simply don't contribute a bucket.
  const dailySeries = useMemo(() => {
    const buckets = new Map();
    const universitySets = new Map();
    const order = [];
    const now = new Date();
    for (let i = TREND_DAYS - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const label = dayLabel(d);
      buckets.set(label, { label, submitted: 0, sent: 0, universities: 0 });
      universitySets.set(label, new Set());
      order.push(label);
    }

    if (timestampKey) {
      for (const row of submissions) {
        const raw = row[timestampKey];
        if (!raw) continue;
        const parsed = new Date(raw);
        if (Number.isNaN(parsed.getTime())) continue;
        const label = dayLabel(parsed);
        const bucket = buckets.get(label);
        if (!bucket) continue;
        bucket.submitted += 1;
        if (statusOf(row) === SENT_STATUS) bucket.sent += 1;
        const university = universityKey ? String(row[universityKey] || '').trim() : '';
        if (university) universitySets.get(label).add(university);
      }
    }

    for (const label of order) {
      buckets.get(label).universities = universitySets.get(label).size;
    }

    return order.map((label) => buckets.get(label));
  }, [submissions, timestampKey, statusKey, universityKey]);

  const topWorkshops = useMemo(() => {
    if (!workshopKey) return [];
    const counts = new Map();
    for (const row of submissions) {
      const w = row[workshopKey];
      if (!w) continue;
      counts.set(w, (counts.get(w) || 0) + 1);
    }
    return [...counts.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [submissions, workshopKey]);

  const loadSubmissions = async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const response = await fetch(`${BASE_PATH}/api/admin/submissions`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to load submissions.');

      setSubmissions(result.submissions || []);
      setHeaders(result.headers || []);
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSubmissions();

    fetch(`${BASE_PATH}/api/workshops`)
      .then((res) => (res.ok ? res.json() : { workshops: [] }))
      .then((data) => setWorkshopOptions(data.workshops || []))
      .catch(() => setWorkshopOptions([]));
  }, []);

  const filteredSubmissions = useMemo(() => {
    const term = search.trim().toLowerCase();

    const filtered = submissions.filter((row) => {
      const matchesWorkshop =
        workshopFilter === ALL_WORKSHOPS || !workshopKey || row[workshopKey] === workshopFilter;
      if (!matchesWorkshop) return false;

      const matchesUniversity =
        universityFilter === ALL_UNIVERSITIES || !universityKey || row[universityKey] === universityFilter;
      if (!matchesUniversity) return false;

      const matchesDomain = domainFilter === ALL_DOMAINS || !domainKey || row[domainKey] === domainFilter;
      if (!matchesDomain) return false;

      if (!term) return true;

      return Object.values(row).some((value) => String(value ?? '').toLowerCase().includes(term));
    });

    const byRowNumber = (a, b) =>
      sortDirection === 'desc' ? b.rowNumber - a.rowNumber : a.rowNumber - b.rowNumber;

    if (!timestampKey) {
      // No timestamp column at all — rowNumber is still a reliable proxy for
      // insertion order (Sheet1 rows are always appended, never reordered).
      return [...filtered].sort(byRowNumber);
    }

    // Rows with a real timestamp are unambiguously more recent than the older,
    // pre-timestamp-column historical rows, so timed rows always sort before
    // untimed ones (for "most recent first"); within each group, sort by its own
    // key using the same direction. rowNumber breaks ties among untimed rows.
    const timed = [];
    const untimed = [];
    for (const row of filtered) {
      const parsed = Date.parse(row[timestampKey] || '');
      if (Number.isNaN(parsed)) {
        untimed.push(row);
      } else {
        timed.push({ row, parsed });
      }
    }

    timed.sort((a, b) => (sortDirection === 'desc' ? b.parsed - a.parsed : a.parsed - b.parsed));
    untimed.sort(byRowNumber);

    const orderedTimed = timed.map((x) => x.row);
    return sortDirection === 'desc' ? [...orderedTimed, ...untimed] : [...untimed, ...orderedTimed];
  }, [
    submissions,
    search,
    workshopFilter,
    workshopKey,
    universityFilter,
    universityKey,
    domainFilter,
    domainKey,
    timestampKey,
    sortDirection,
  ]);

  // Reset to page 1 whenever the filtered set or page size changes, so a search/
  // filter never leaves the view stranded on a now out-of-range page.
  useEffect(() => {
    setPage(1);
  }, [search, workshopFilter, universityFilter, domainFilter, sortDirection, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredSubmissions.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedSubmissions = filteredSubmissions.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleMarkSent = async (rowNumber) => {
    if (!statusKey) {
      toast.error('Submissions data isn’t set up to track send status yet — contact support to enable it.');
      return;
    }

    setSavingRow(rowNumber);
    try {
      const response = await fetch(`${BASE_PATH}/api/admin/submissions/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowNumber, status: SENT_STATUS }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to update status.');

      setSubmissions((prev) =>
        prev.map((row) => (row.rowNumber === rowNumber ? { ...row, [statusKey]: SENT_STATUS } : row))
      );
      toast.success('Marked as sent.');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSavingRow(null);
    }
  };

  return (
    <div>
      <p className="text-sm" style={{ color: 'rgba(var(--adm-ink-primary-rgb),0.4)' }}>
        Welcome back
      </p>
      <h1 className="mb-1 text-2xl font-bold" style={{ color: INK.primary }}>
        Submissions Overview
      </h1>
      <p className="mb-6 text-sm" style={{ color: INK.secondary }}>
        Certificate submissions, updated in real time — {TREND_DAYS}-day trend below
      </p>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          icon={Users}
          label="Total Submissions"
          value={stats.total}
          color={CATEGORICAL.blue}
          trend={dailySeries.map((d) => d.submitted)}
          isLoading={isLoading}
        />
        <KpiCard
          icon={CheckCircle2}
          label="Certificates Sent"
          value={stats.sent}
          color={STATUS.good}
          trend={dailySeries.map((d) => d.sent)}
          isLoading={isLoading}
        />
        <KpiCard
          icon={Clock}
          label="Pending Certificates"
          value={stats.pending}
          color={CATEGORICAL.violet}
          trend={dailySeries.map((d) => d.submitted)}
          isLoading={isLoading}
        />
        <KpiCard
          icon={Award}
          label="Internship Programs"
          value={programOptions.length || 1}
          color={CATEGORICAL.aqua}
          trend={dailySeries.map((d) => d.submitted)}
          isLoading={isLoading}
        />
      </div>

      {!isLoading && dailySeries.some((d) => d.submitted > 0) && (
        <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
          <div className="rounded-xl border p-4" style={{ background: SURFACE.card, borderColor: SURFACE.border }}>
            <div className="mb-4">
              <h2 className="text-sm font-semibold" style={{ color: INK.primary }}>
                Certificates issued
              </h2>
              {stats.undated > 0 && (
                <p className="mt-0.5 text-xs" style={{ color: INK.muted }}>
                  {stats.undated.toLocaleString()} older submissions don&apos;t have a recorded date, so
                  they aren&apos;t shown on this chart.
                </p>
              )}
            </div>
            <TrendChart
              data={dailySeries}
              series={[{ key: 'sent', label: 'Certificates issued', color: STATUS.good, area: true }]}
            />
          </div>
          <div className="rounded-xl border p-4" style={{ background: SURFACE.card, borderColor: SURFACE.border }}>
            <h2 className="mb-4 text-sm font-semibold" style={{ color: INK.primary }}>
              Top workshops
            </h2>
            {topWorkshops.length > 0 ? (
              <BarList items={topWorkshops} color={CATEGORICAL.blue} />
            ) : (
              <p className="text-sm" style={{ color: INK.muted }}>
                No workshop data yet.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm" style={{ color: INK.muted }}>
          {isLoading ? 'Loading…' : `${filteredSubmissions.length} of ${submissions.length} submissions`}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, phone…"
            className="w-full sm:w-64 h-10 rounded-lg text-[var(--adm-ink-primary)] placeholder:text-[rgba(var(--adm-ink-primary-rgb),0.3)]"
            style={{ background: SURFACE.card, borderColor: SURFACE.border }}
          />
          <Select value={workshopFilter} onValueChange={setWorkshopFilter}>
            <SelectTrigger
              className="w-full sm:w-56 h-10 rounded-lg text-[var(--adm-ink-primary)]"
              style={{ background: SURFACE.card, borderColor: SURFACE.border }}
            >
              <SelectValue placeholder="All workshops" />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              <SelectItem value={ALL_WORKSHOPS}>All workshops</SelectItem>
              {workshopOptions.map((workshop) => (
                <SelectItem key={workshop} value={workshop}>
                  {workshop}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {universityKey && (
            <Select value={universityFilter} onValueChange={setUniversityFilter}>
              <SelectTrigger
                className="w-full sm:w-56 h-10 rounded-lg text-[var(--adm-ink-primary)]"
                style={{ background: SURFACE.card, borderColor: SURFACE.border }}
              >
                <SelectValue placeholder="All universities" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectItem value={ALL_UNIVERSITIES}>All universities</SelectItem>
                {universityOptions.map((university) => (
                  <SelectItem key={university} value={university}>
                    {university}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {domainKey && (
            <Select value={domainFilter} onValueChange={setDomainFilter}>
              <SelectTrigger
                className="w-full sm:w-44 h-10 rounded-lg text-[var(--adm-ink-primary)]"
                style={{ background: SURFACE.card, borderColor: SURFACE.border }}
              >
                <SelectValue placeholder="All domains" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectItem value={ALL_DOMAINS}>All domains</SelectItem>
                {domainOptions.map((domain) => (
                  <SelectItem key={domain} value={domain}>
                    {domain}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
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

      <div className="overflow-x-auto rounded-xl border" style={{ background: SURFACE.card, borderColor: SURFACE.border }}>
        <table className="w-full table-fixed text-sm" style={{ minWidth: tableMinWidth }}>
          <colgroup>
            {displayHeaders.map((header) => (
              <col key={header} style={{ width: getColumnWidth(header) }} />
            ))}
            {isAdmin && <col style={{ width: ACTIONS_COLUMN_WIDTH }} />}
          </colgroup>
          <thead>
            <tr
              className="border-b text-left text-xs font-semibold uppercase tracking-wide"
              style={{ borderColor: SURFACE.border, color: INK.muted, background: SURFACE.cardAlt }}
            >
              {displayHeaders.map((header) =>
                timestampKey && header === timestampKey ? (
                  <th key={header} className="truncate px-2 py-2">
                    <button
                      type="button"
                      onClick={() => setSortDirection((d) => (d === 'desc' ? 'asc' : 'desc'))}
                      className="flex items-center gap-1 uppercase tracking-wide hover:text-[var(--adm-ink-primary)] cursor-pointer"
                      title={`Sort by ${header} (${sortDirection === 'desc' ? 'newest first' : 'oldest first'})`}
                    >
                      {header}
                      {sortDirection === 'desc' ? (
                        <ArrowDown className="h-3 w-3" />
                      ) : (
                        <ArrowUp className="h-3 w-3" />
                      )}
                    </button>
                  </th>
                ) : (
                  <th key={header} className="truncate px-2 py-2" title={header}>
                    {header}
                  </th>
                )
              )}
              {isAdmin && <th className="truncate px-2 py-2">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td
                  colSpan={displayHeaders.length + (isAdmin ? 1 : 0)}
                  className="px-4 py-6 text-center"
                  style={{ color: INK.muted }}
                >
                  Loading submissions…
                </td>
              </tr>
            ) : pagedSubmissions.length === 0 ? (
              <tr>
                <td
                  colSpan={displayHeaders.length + (isAdmin ? 1 : 0)}
                  className="px-4 py-6 text-center"
                  style={{ color: INK.muted }}
                >
                  No submissions found.
                </td>
              </tr>
            ) : (
              pagedSubmissions.map((row) => {
                const s = statusOf(row);
                const isSent = s === SENT_STATUS;
                const isFailed = s === FAILED_STATUS;
                return (
                  <tr key={row.rowNumber} className="border-b last:border-0" style={{ borderColor: SURFACE.border }}>
                    {displayHeaders.map((header) => {
                      const value = String(row[header] ?? '');
                      if (header === statusKey) {
                        return (
                          <td key={header} className="px-2 py-2">
                            <StatusPill isSent={isSent} isFailed={isFailed} />
                          </td>
                        );
                      }
                      if (header === linkedinKey) {
                        return (
                          <td key={header} className="px-2 py-2">
                            {value ? (
                              <a
                                href={value}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline underline-offset-2 hover:text-[var(--adm-ink-primary)]"
                                style={{ color: INK.secondary }}
                              >
                                View
                              </a>
                            ) : (
                              <span style={{ color: INK.muted }}>—</span>
                            )}
                          </td>
                        );
                      }
                      return (
                        <td key={header} className="truncate px-2 py-2" style={{ color: INK.secondary }} title={value}>
                          {value}
                        </td>
                      );
                    })}
                    {isAdmin && (
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          onClick={() => handleMarkSent(row.rowNumber)}
                          disabled={isSent || savingRow === row.rowNumber}
                          className="rounded-md px-2 py-1 text-xs font-semibold transition-colors disabled:opacity-50"
                          style={
                            isSent
                              ? { background: 'rgba(12,163,12,0.15)', color: STATUS.good, cursor: 'default' }
                              : {
                                  background: 'var(--adm-btn-primary-bg)',
                                  color: 'var(--adm-btn-primary-fg)',
                                  cursor: 'pointer',
                                }
                          }
                        >
                          {isSent ? 'Sent' : savingRow === row.rowNumber ? 'Saving…' : isFailed ? 'Retry: mark sent' : 'Mark sent'}
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {!isLoading && filteredSubmissions.length > 0 && (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 text-sm" style={{ color: INK.muted }}>
            <span>
              Showing {(currentPage - 1) * pageSize + 1}–
              {Math.min(currentPage * pageSize, filteredSubmissions.length)} of {filteredSubmissions.length}
            </span>
            <div
              className="flex items-center gap-0.5 rounded-lg border p-0.5"
              style={{ background: SURFACE.card, borderColor: SURFACE.border }}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setPageSize(size)}
                  className="rounded-md px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer"
                  style={
                    pageSize === size
                      ? { background: 'var(--adm-btn-primary-bg)', color: 'var(--adm-btn-primary-fg)' }
                      : { color: INK.secondary }
                  }
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg border transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer hover:text-[var(--adm-ink-primary)]"
              style={{ background: SURFACE.card, borderColor: SURFACE.border, color: INK.secondary }}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm" style={{ color: INK.secondary }}>
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="flex h-8 w-8 items-center justify-center rounded-lg border transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer hover:text-[var(--adm-ink-primary)]"
              style={{ background: SURFACE.card, borderColor: SURFACE.border, color: INK.secondary }}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusPill({ isSent, isFailed }) {
  if (isSent) {
    return (
      <span
        className="inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold"
        style={{ background: 'rgba(12,163,12,0.15)', color: STATUS.good }}
      >
        Sent
      </span>
    );
  }
  if (isFailed) {
    return (
      <span
        className="inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold"
        style={{ background: 'rgba(208,59,59,0.15)', color: STATUS.critical }}
      >
        Failed
      </span>
    );
  }
  return (
    <span className="inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ color: INK.muted }}>
      Pending
    </span>
  );
}

function KpiCard({ icon: Icon, label, value, color, trend, isLoading }) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border p-4"
      style={{ background: SURFACE.card, borderColor: SURFACE.border }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{ background: `radial-gradient(circle at 15% 0%, ${color}, transparent 60%)` }}
      />
      <div className="relative">
        <div className="mb-3 flex items-center justify-between">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: `${color}26`, color }}
          >
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <p className="text-xs font-medium uppercase tracking-wide" style={{ color: INK.muted }}>
          {label}
        </p>
        <p className="mt-1 text-2xl font-bold" style={{ color: INK.primary }}>
          {isLoading ? '—' : value.toLocaleString()}
        </p>
        {!isLoading && trend.some((v) => v > 0) && (
          <div className="mt-2">
            <Sparkline data={trend} color={color} />
          </div>
        )}
      </div>
    </div>
  );
}
