import { useState, useMemo, useEffect } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { postJsonAuth, ApiError, getJson, putJsonAuth } from '../../lib/api';

type StepKey = 'event' | 'stage' | 'templates' | 'registration';

const steps: { key: StepKey; label: string }[] = [
  { key: 'event', label: 'Event Info' },
  { key: 'stage', label: 'Stage' },
  { key: 'templates', label: 'Templates' },
  { key: 'registration', label: 'Registration' },
];

type EventStage = {
  label: string;
  config_json: unknown;
  starts_at: string | null;
  ends_at: string | null;
};

type EventGameTemplate = {
  variant: string;
};

export function AdminCreateEventPage() {
  const { user, token } = useAuth();
  const { slug: editSlug } = useParams();
  const isEdit = Boolean(editSlug);
  const [name, setName] = useState('');
  const [eventType] = useState<'Challenge'>('Challenge');
  const [eventAbbr, setEventAbbr] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [shortDescription, setShortDescription] = useState('');
  const [longDescription, setLongDescription] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');

  const [stageLabel, setStageLabel] = useState('');
  const [stageAbbr, setStageAbbr] = useState('');
  const [stageGameCount, setStageGameCount] = useState(100);
  const [stageIndex] = useState(1);

  const [variant, setVariant] = useState('No Variant');
  const [seedCount, setSeedCount] = useState(100);
  const [seedFormula, setSeedFormula] = useState('{eID}{i}');
  const [published, setPublished] = useState(false);
  const [allowLateRegistration, setAllowLateRegistration] = useState(true);
  const [registrationCutoff, setRegistrationCutoff] = useState('');
  const [enforceExactTeamSize, setEnforceExactTeamSize] = useState(false);

const [currentStep, setCurrentStep] = useState<StepKey>('event');
  const [showPreview, setShowPreview] = useState(false);
  const [showFormulaHelp, setShowFormulaHelp] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(false);

  const abbrHasSpace = /\s/.test(eventAbbr);
  const stageAbbrHasSpace = /\s/.test(stageAbbr);
  const formulaHasSpace = /\s/.test(seedFormula);

  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN')) {
    return <Navigate to="/" replace />;
  }

  useEffect(() => {
    if (!slugEdited) {
      setSlug(slugify(name));
    }
    if (eventType === 'Challenge') {
      setStageLabel(name);
    }
  }, [name, slugEdited, eventType]);

  useEffect(() => {
    // Challenge: lock stage abbreviation to event abbreviation
    if (eventType === 'Challenge') {
      setStageAbbr(eventAbbr);
    }
  }, [eventAbbr, eventType]);

  useEffect(() => {
    setSeedCount(stageGameCount);
  }, [stageGameCount]);

  // Default registration cutoff to end date when provided and cutoff is empty
  useEffect(() => {
    if (endsAt && !registrationCutoff) {
      setRegistrationCutoff(endsAt);
    }
  }, [endsAt, registrationCutoff]);

  useEffect(() => {
    if (!isEdit || !editSlug) return;
    const load = async () => {
      setLoadingExisting(true);
      setError(null);
      try {
        const event = await getJson<EventDetail>(`/events/${editSlug}`);
        setName(event.name);
        setSlug(event.slug);
        setShortDescription(event.short_description || '');
        setLongDescription(event.long_description || '');
        setStartsAt(event.starts_at ? event.starts_at.slice(0, 10) : '');
        setEndsAt(event.ends_at ? event.ends_at.slice(0, 10) : '');
        setPublished(event.published ?? false);
        setAllowLateRegistration(event.allow_late_registration ?? true);
        setRegistrationCutoff(event.registration_cutoff ? event.registration_cutoff.slice(0, 10) : '');

        const stages = await getJson<EventStage[]>(`/events/${editSlug}/stages`);
        if (stages.length > 0) {
          const st = stages[0];
          setStageLabel(st.label);
          const stAbbr = (st.config_json as any)?.stage_abbreviation || '';
          const evAbbr = (st.config_json as any)?.event_abbreviation || '';
          const enforce = (st.config_json as any)?.enforce_exact_team_size ?? false;
          setEnforceExactTeamSize(!!enforce);
          if (evAbbr) setEventAbbr(evAbbr);
          setStageAbbr(stAbbr || evAbbr || '');
        }

        const templates = await getJson<EventGameTemplate[]>(`/events/${editSlug}/game-templates`);
        if (templates.length > 0) {
          setVariant(templates[0].variant || 'No Variant');
          setSeedCount(templates.length);
        }
      } catch (err) {
        setError('Failed to load event for editing');
      } finally {
        setLoadingExisting(false);
      }
    };
    load();
  }, [isEdit, editSlug]);

  const seedPreview = useMemo(() => {
    const seeds = buildSeedsFromFormula(seedFormula, eventAbbr, stageAbbr, seedCount);
    const first = seeds.slice(0, 3);
    const last = seeds.slice(-3);
    return seeds.length > 6 ? [...first, '…', ...last] : seeds;
  }, [seedFormula, eventAbbr, stageAbbr, seedCount]);

  const eventValid =
    !!name && !!slug && !!longDescription && !!eventAbbr && !abbrHasSpace && !formulaHasSpace;
  const stageValid =
    !!stageLabel &&
    !!stageAbbr &&
    !stageAbbrHasSpace &&
    stageGameCount > 0 &&
    datesValid(startsAt, endsAt);
  const templatesValid = !!variant && seedCount >= 1 && !!seedFormula.trim() && !formulaHasSpace;
  const registrationValid = true;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !token) return;
    if (!eventValid || !stageValid || !templatesValid) return;
    // registrationValid currently always true

    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      if (isEdit && editSlug) {
        await putJsonAuth(`/events/${encodeURIComponent(editSlug)}`, token, {
          name,
          new_slug: slug,
          short_description: shortDescription || null,
          long_description: longDescription,
          published,
          allow_late_registration: allowLateRegistration,
          registration_cutoff: registrationCutoff || null,
          starts_at: startsAt ? `${startsAt}T12:00:00Z` : null,
          ends_at: endsAt ? `${endsAt}T23:59:59Z` : null,
        });
      } else {
        await postJsonAuth('/events', token, {
          name,
          slug,
          short_description: shortDescription || null,
          long_description: longDescription,
          published,
          allow_late_registration: allowLateRegistration,
          registration_cutoff: registrationCutoff || null,
          starts_at: startsAt ? `${startsAt}T12:00:00Z` : null,
          ends_at: endsAt ? `${endsAt}T23:59:59Z` : null,
        });
      }

      const stage = await postJsonAuth<{ event_stage_id: number }>(
        `/events/${encodeURIComponent(slug)}/stages`,
        token,
        {
          stage_index: 1,
          label: stageLabel || name,
          stage_type: 'SINGLE',
          starts_at: startsAt || null,
          ends_at: endsAt ? `${endsAt}T23:59:59Z` : null,
          config_json: {
            event_abbreviation: eventAbbr || null,
            stage_abbreviation: stageAbbr || null,
            enforce_exact_team_size: enforceExactTeamSize,
          },
        },
      );

      const stageId = stage.event_stage_id;
      const seeds = buildSeedsFromFormula(seedFormula, eventAbbr, stageAbbr, seedCount);
      for (let i = 0; i < seeds.length; i += 1) {
        await postJsonAuth(`/events/${encodeURIComponent(slug)}/game-templates`, token, {
          event_stage_id: stageId,
          template_index: i + 1,
          variant,
          seed_payload: seeds[i],
          metadata_json: {},
        });
      }

      setMessage(isEdit ? `Updated event "${name}".` : `Created event "${name}" with ${seedCount} templates.`);
      setName('');
      setEventAbbr('');
      setSlug('');
      setSlugEdited(false);
      setShortDescription('');
      setLongDescription('');
      setStartsAt('');
      setEndsAt('');
      setStageLabel('');
      setStageAbbr('');
      setStageGameCount(100);
      setVariant('No Variant');
      setSeedCount(100);
      setSeedFormula('{eID}{i}');
      setPublished(false);
      setAllowLateRegistration(true);
      setRegistrationCutoff('');
      setEnforceExactTeamSize(false);
      setCurrentStep('event');
    } catch (err) {
      if (err instanceof ApiError) {
        setError((err.body as { error?: string })?.error ?? 'Failed to create event');
      } else {
        setError('Failed to create event');
      }
    } finally {
      setSaving(false);
    }
  }

  const stepValid = (key: StepKey) => {
    if (key === 'event') return eventValid;
    if (key === 'stage') return stageValid;
    return templatesValid;
  };

  function renderNav() {
    return (
      <div className="flex gap-2">
        {steps.map((step) => {
          const active = step.key === currentStep;
          return (
            <button
              key={step.key}
              type="button"
              className="pill"
              style={
                active
                  ? { background: 'var(--color-accent-weak)', borderColor: 'var(--color-accent-weak)' }
                  : undefined
              }
              onClick={() => setCurrentStep(step.key)}
            >
              {step.label}
            </button>
          );
        })}
      </div>
    );
  }

  function renderEventForm() {
    return (
      <div className="stack-md" style={{ marginBottom: 'var(--space-sm)' }}>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="stack-xs">
            <label className="text-sm font-medium text-gray-700">Name</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="stack-xs">
            <label className="text-sm font-medium text-gray-700">Slug</label>
            <input
              className="input"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugEdited(true);
              }}
              required
            />
          </div>
        </div>

        <div className="stack-xs">
          <label className="text-sm font-medium text-gray-700">Short Description</label>
          <input
            className="input"
            value={shortDescription}
            onChange={(e) => setShortDescription(e.target.value)}
            placeholder="Optional brief summary"
          />
        </div>

        <div className="stack-xs">
          <label className="text-sm font-medium text-gray-700">Abbreviation</label>
          <input
            className="input"
            placeholder="e.g., NVC25"
            value={eventAbbr}
            onChange={(e) => setEventAbbr(e.target.value)}
            required
          />
          {abbrHasSpace && (
            <p className="text-sm text-red-600">Abbreviation cannot contain spaces.</p>
          )}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: '12px',
            alignItems: 'end',
          }}
        >
          <div className="stack-xs">
            <label className="text-sm font-medium text-gray-700">Event Type</label>
            <select className="select" value={eventType} disabled>
              <option>Challenge</option>
            </select>
          </div>
          <div className="stack-xs">
            <label className="text-sm font-medium text-gray-700">Stages</label>
            <select className="select" value="1" disabled>
              <option value="1">1</option>
            </select>
          </div>
        </div>

        <div className="stack-xs" style={{ position: 'relative' }}>
          <label className="text-sm font-medium text-gray-700">Long Description (Markdown)</label>
          <div className="relative">
            <textarea
              className="textarea"
              style={{ height: '220px', resize: 'none', overflowY: 'auto' }}
              value={longDescription}
              onChange={(e) => {
                setLongDescription(e.target.value);
                setShowPreview(false);
              }}
              required
            />
            <button
              type="button"
              className="material-symbols-outlined"
              aria-label="Preview markdown"
              title="Preview markdown"
              onClick={() => setShowPreview((prev) => !prev)}
              style={{
                position: 'absolute',
                bottom: '10px',
                right: '10px',
                background: 'var(--color-accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                padding: '6px',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              visibility
            </button>
            {showPreview && (
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(0,0,0,0.35)',
                  zIndex: 1000,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 'var(--space-lg)',
                }}
                onClick={() => setShowPreview(false)}
              >
                <div
                  className="card"
                  style={{
                    width: 'min(720px, 90vw)',
                    maxHeight: '80vh',
                    overflowY: 'auto',
                    position: 'relative',
                    boxShadow: 'var(--shadow-hover)',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className="material-symbols-outlined"
                    aria-label="Close preview"
                    onClick={() => setShowPreview(false)}
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    close
                  </button>
                  <div
                    className="stack-xs"
                    dangerouslySetInnerHTML={{ __html: markdownToHtml(longDescription) }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    );
  }

  function renderStageForm() {
    const stageOptionLabel = `${stageIndex} - ${stageLabel || 'Stage ' + stageIndex}`;
    return (
      <div className="stack-md" style={{ marginBottom: 'var(--space-sm)' }}>
        <div className="stack-xs">
          <label className="text-sm font-medium text-gray-700">Select Stage</label>
          <select className="select" value={stageIndex} disabled>
            <option value={stageIndex}>{stageOptionLabel}</option>
          </select>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="stack-xs">
            <label className="text-sm font-medium text-gray-700">Stage Name</label>
            <input
              className="input"
              value={stageLabel}
              onChange={(e) => setStageLabel(e.target.value)}
              placeholder="Defaults to event name"
              required
            />
          </div>
          <div className="stack-xs">
            <label className="text-sm font-medium text-gray-700">Stage Abbreviation</label>
            <input
              className="input"
              value={stageAbbr}
              onChange={(e) => setStageAbbr(e.target.value)}
              placeholder="Matches event abbreviation for challenges"
              required
              disabled={eventType === 'Challenge'}
            />
            {stageAbbrHasSpace && (
              <p className="text-sm text-red-600">Stage abbreviation cannot contain spaces.</p>
            )}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="stack-xs">
            <label className="text-sm font-medium text-gray-700">Stage Type</label>
            <input className="input" value="SINGLE" disabled />
          </div>
          <div className="stack-xs">
            <label className="text-sm font-medium text-gray-700">Number of Games</label>
            <input
              type="number"
              min={1}
              className="input"
              value={stageGameCount}
              onChange={(e) => setStageGameCount(Number(e.target.value))}
              required
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="stack-xs">
            <label className="text-sm font-medium text-gray-700">Stage Starts</label>
            <input
              type="date"
              className="input"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </div>
          <div className="stack-xs">
            <label className="text-sm font-medium text-gray-700">Stage Ends</label>
            <input
              type="date"
              className="input"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </div>
        </div>
      </div>
    );
  }

  function renderTemplateForm() {
    const stageOptionLabel = `${stageIndex} - ${stageLabel || 'Stage ' + stageIndex}`;
    return (
      <div className="stack-md">
        <div className="stack-xs">
          <label className="text-sm font-medium text-gray-700">Select Stage</label>
          <select className="select" value={stageIndex} disabled>
            <option value={stageIndex}>{stageOptionLabel}</option>
          </select>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="stack-xs">
            <label className="text-sm font-medium text-gray-700">Variant</label>
            <input className="input" value={variant} onChange={(e) => setVariant(e.target.value)} />
          </div>
          <div className="stack-xs">
            <label className="text-sm font-medium text-gray-700">Number of Games</label>
            <input
              type="number"
              min={1}
              className="input"
              value={seedCount}
              onChange={(e) => setSeedCount(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="stack-xs" style={{ position: 'relative' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <label className="text-sm font-medium text-gray-700">Seed Formula</label>
            <button
              type="button"
              className="material-symbols-outlined"
              aria-label="Seed formula help"
              title="Seed formula help"
              onClick={() => setShowFormulaHelp(true)}
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                padding: '2px 4px',
                cursor: 'pointer',
              }}
            >
              info
            </button>
          </div>
          <input
            className="input"
            value={seedFormula}
            onChange={(e) => setSeedFormula(e.target.value)}
            placeholder="{eID}{i}"
          />
          {formulaHasSpace && (
            <p className="text-sm text-red-600">Formula cannot contain spaces.</p>
          )}
        </div>

        {showFormulaHelp && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.35)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 'var(--space-lg)',
            }}
            onClick={() => setShowFormulaHelp(false)}
          >
            <div
              className="card"
              style={{
                width: 'min(640px, 90vw)',
                maxHeight: '80vh',
                overflowY: 'auto',
                position: 'relative',
                boxShadow: 'var(--shadow-hover)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="material-symbols-outlined"
                aria-label="Close"
                onClick={() => setShowFormulaHelp(false)}
                style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                close
              </button>
              <div className="stack-sm">
                <h3 className="text-lg font-semibold">Seed formula</h3>
                <ul className="text-sm text-gray-700" style={{ paddingLeft: '16px', margin: 0 }}>
                  <li>{'{eID}'} = event abbreviation</li>
                  <li>{'{sID}'} = stage abbreviation</li>
                  <li>{'{i}'} = seed index (1 .. n)</li>
                  <li>{'{0i}'}, { '{00i}' }, etc. = zero-padded index (zeros set the padding)</li>
                </ul>
                <p className="text-sm text-gray-700" style={{ marginTop: '4px' }}>
                  Example: {'{eID}-{sID}-{00i}'} → NVT-RR-001
                </p>
              </div>
            </div>
          </div>
        )}

        <p className="text-sm text-gray-600">Preview: {seedPreview.join(', ')}</p>
      </div>
    );
  }

  function renderRegistrationForm() {
    return (
      <div className="stack-md" style={{ marginBottom: 'var(--space-sm)' }}>
        <div className="flex items-center gap-2">
          <input
            id="allowLate"
            type="checkbox"
            checked={allowLateRegistration}
            onChange={(e) => setAllowLateRegistration(e.target.checked)}
          />
          <label htmlFor="allowLate" className="text-sm text-gray-700">
            Allow registration after cutoff
          </label>
        </div>
        <div className="grid gap-3 md:grid-cols-2" style={{ maxWidth: '420px' }}>
          <div className="stack-xxs">
            <label className="text-sm font-medium text-gray-700">Registration cutoff</label>
            <input
              type="date"
              className="input"
              value={registrationCutoff}
              onChange={(e) => setRegistrationCutoff(e.target.value)}
              placeholder="Defaults to end date"
            />
            <p className="text-xs text-gray-600">
              After this date, registration closes unless late registration is allowed.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="enforceExact"
              type="checkbox"
              checked={enforceExactTeamSize}
              onChange={(e) => setEnforceExactTeamSize(e.target.checked)}
            />
            <label htmlFor="enforceExact" className="text-sm text-gray-700">
              Enforce exact team size
            </label>
          </div>
        </div>
      </div>
    );
  }

  const currentValid = stepValid(currentStep);
  const onNext = () => {
    if (!currentValid) return;
    if (currentStep === 'event') setCurrentStep('stage');
    else if (currentStep === 'stage') setCurrentStep('templates');
    else if (currentStep === 'templates') setCurrentStep('registration');
  };
  const onPrev = () => {
    if (currentStep === 'registration') setCurrentStep('templates');
    else if (currentStep === 'templates') setCurrentStep('stage');
    else if (currentStep === 'stage') setCurrentStep('event');
  };

  return (
    <main className="page stack-md">
      <header className="stack-sm">
        <h1 className="text-2xl font-bold">{isEdit ? 'Edit Event' : 'Create Event'}</h1>
      </header>

      {message && <p className="text-green-700 text-sm">{message}</p>}
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {isEdit && loadingExisting && <p>Loading event details...</p>}
      {isEdit && loadingExisting ? null : (
      <form className="card stack-md" onSubmit={handleSubmit}>
        {renderNav()}

        {currentStep === 'event' && renderEventForm()}
        {currentStep === 'stage' && renderStageForm()}
        {currentStep === 'templates' && renderTemplateForm()}
        {currentStep === 'registration' && renderRegistrationForm()}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div>
            {currentStep !== 'event' && (
              <button type="button" className="btn btn--ghost" onClick={onPrev} disabled={saving}>
                Previous
              </button>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', alignItems: 'center' }}>
            {currentStep === 'registration' && (
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={published}
                  onChange={(e) => setPublished(e.target.checked)}
                />
                Publish event
              </label>
            )}
            {currentStep !== 'registration' && (
              <button
                type="button"
                className="btn btn--primary"
                onClick={onNext}
                disabled={!currentValid || saving}
              >
                Next
              </button>
            )}
            {currentStep === 'registration' && (
              <button
                type="submit"
                className="btn btn--primary"
                disabled={!eventValid || !stageValid || !templatesValid || saving}
              >
                {saving ? 'Creating…' : 'Create Event'}
              </button>
            )}
          </div>
        </div>
      </form>
      )}
    </main>
  );
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

function datesValid(start: string, end: string) {
  if (start && end) {
    const s = new Date(start);
    const e = new Date(end);
    if (!Number.isFinite(s.getTime()) || !Number.isFinite(e.getTime())) return false;
    return e > s;
  }
  return true;
}

function buildSeedsFromFormula(formula: string, eventAbbr: string, stageAbbr: string, count: number) {
  const seeds: string[] = [];
  const safeFormula = formula.trim() || '{eID}-{sID}-{i}';
  for (let idx = 1; idx <= count; idx += 1) {
    let seed = safeFormula;
    seed = seed.replace(/\{eID\}/g, eventAbbr || 'EVT');
    seed = seed.replace(/\{sID\}/g, stageAbbr || 'STG');
    // Zero-padded indices: {0i}, {00i}, etc.
    seed = seed.replace(/\{0+i\}/g, (m) => {
      const zeros = m.length - 3; // braces + 'i' + zeros
      const padLen = Math.max(1, zeros + 1);
      return String(idx).padStart(padLen, '0');
    });
    // Unpadded index: {i}
    seed = seed.replace(/\{i\}/g, String(idx));
    seeds.push(seed);
  }
  return seeds;
}

function markdownToHtml(md: string) {
  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const emojiMap: Record<string, string> = {
    firework: '🎆',
    fireworks: '🎆',
    tada: '🎉',
    sparkles: '✨',
    star: '⭐️',
  };

  let html = escape(md);

  html = html.replace(/:([a-z0-9_+-]+):/gi, (_, code) => emojiMap[code] || `:${code}:`);

  html = html.replace(/^### (.*)$/gm, '<h4>$1</h4>');
  html = html.replace(/^## (.*)$/gm, '<h3>$1</h3>');
  html = html.replace(/^# (.*)$/gm, '<h2>$1</h2>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/`(.+?)`/g, '<code>$1</code>');

  // Simple lists
  html = html.replace(/(^|\n)- (.*)/g, (m, p1, item) => `${p1}<li>${item}</li>`);
  html = html.replace(/(<li>.*<\/li>)/gs, (m) => `<ul>${m}</ul>`);

  // Paragraphs
  html = html
    .split(/\n{2,}/)
    .map((block) => {
      if (block.startsWith('<h') || block.startsWith('<ul>')) return block;
      return `<p>${block.replace(/\n/g, '<br/>')}</p>`;
    })
    .join('');

  return html;
}
