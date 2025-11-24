import { useState, useMemo, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { postJsonAuth, ApiError } from '../../lib/api';

export function AdminCreateEventPage() {
  const { user, token } = useAuth();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [shortDescription, setShortDescription] = useState('');
  const [longDescription, setLongDescription] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');

  const [stageLabel, setStageLabel] = useState('Main Stage');
  const [variant, setVariant] = useState('No Variant');
  const [seedPrefix, setSeedPrefix] = useState('NVC');
  const [seedStart, setSeedStart] = useState(1);
  const [seedCount, setSeedCount] = useState(100);
  const [seedPad, setSeedPad] = useState(0);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN')) {
    return <Navigate to="/" replace />;
  }

  useEffect(() => {
    if (!slugEdited) {
      setSlug(slugify(name));
    }
  }, [name, slugEdited]);

  const seedPreview = useMemo(() => {
    const first = buildSeeds(seedPrefix, seedStart, seedCount, seedPad).slice(0, 3);
    const last = buildSeeds(seedPrefix, seedStart, seedCount, seedPad).slice(-3);
    return [...first, '…', ...last];
  }, [seedPrefix, seedStart, seedCount, seedPad]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !token) return;
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      // 1) Create event
      await postJsonAuth('/events', token, {
        name,
        slug,
        short_description: shortDescription || null,
        long_description: longDescription,
        starts_at: startsAt || null,
        ends_at: endsAt || null,
      });

      // 2) Create stage (single)
      const stage = await postJsonAuth<{ event_stage_id: number }>(
        `/events/${encodeURIComponent(slug)}/stages`,
        token,
        {
          stage_index: 1,
          label: stageLabel || 'Main Stage',
          stage_type: 'SINGLE',
          starts_at: startsAt || null,
          ends_at: endsAt || null,
          config_json: {},
        },
      );

      // 3) Create templates
      const stageId = stage.event_stage_id;
      const seeds = buildSeeds(seedPrefix, seedStart, seedCount, seedPad);
      for (let i = 0; i < seeds.length; i += 1) {
        await postJsonAuth(`/events/${encodeURIComponent(slug)}/game-templates`, token, {
          event_stage_id: stageId,
          template_index: i + 1,
          variant,
          seed_payload: seeds[i],
          metadata_json: {},
        });
      }

      setMessage(`Created event "${name}" with ${seedCount} templates.`);
      setName('');
      setSlug('');
      setSlugEdited(false);
      setShortDescription('');
      setLongDescription('');
      setStartsAt('');
      setEndsAt('');
      setStageLabel('Main Stage');
      setVariant('No Variant');
      setSeedPrefix('NVC');
      setSeedStart(1);
      setSeedCount(100);
      setSeedPad(0);
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

  return (
    <main className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Create Event</h1>
      <p className="text-gray-700">For now, single-stage challenge events with generated seeds.</p>

      {message && <p className="text-green-700 text-sm">{message}</p>}
      {error && <p className="text-red-600 text-sm">{error}</p>}

      <form className="space-y-4" onSubmit={handleSubmit}>
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Basics</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                className="w-full border rounded px-3 py-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Slug</label>
              <input
                className="w-full border rounded px-3 py-2"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlugEdited(true);
                }}
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Short description</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Long description</label>
            <textarea
              className="w-full border rounded px-3 py-2"
              rows={4}
              value={longDescription}
              onChange={(e) => setLongDescription(e.target.value)}
              required
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Starts at</label>
              <input
                type="datetime-local"
                className="w-full border rounded px-3 py-2"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Ends at</label>
              <input
                type="datetime-local"
                className="w-full border rounded px-3 py-2"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Stage (single)</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Label</label>
              <input
                className="w-full border rounded px-3 py-2"
                value={stageLabel}
                onChange={(e) => setStageLabel(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Stage type</label>
              <input className="w-full border rounded px-3 py-2 bg-gray-100" value="SINGLE" disabled />
            </div>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Templates & seeds</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Variant (all templates)</label>
              <input
                className="w-full border rounded px-3 py-2"
                value={variant}
                onChange={(e) => setVariant(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Number of templates</label>
              <input
                type="number"
                min={1}
                className="w-full border rounded px-3 py-2"
                value={seedCount}
                onChange={(e) => setSeedCount(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Seed prefix</label>
              <input
                className="w-full border rounded px-3 py-2"
                value={seedPrefix}
                onChange={(e) => setSeedPrefix(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Start index</label>
              <input
                type="number"
                min={1}
                className="w-full border rounded px-3 py-2"
                value={seedStart}
                onChange={(e) => setSeedStart(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Zero pad</label>
              <input
                type="number"
                min={0}
                max={6}
                className="w-full border rounded px-3 py-2"
                value={seedPad}
                onChange={(e) => setSeedPad(Number(e.target.value))}
              />
            </div>
          </div>

          <p className="text-sm text-gray-600">
            Preview: {seedPreview.join(', ')}
          </p>
        </section>

        <div className="flex gap-2">
          <button
            type="submit"
            className="px-4 py-2 rounded bg-blue-600 text-white font-semibold disabled:opacity-60"
            disabled={saving}
          >
            {saving ? 'Creating…' : 'Create event'}
          </button>
        </div>
      </form>
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

function buildSeeds(prefix: string, start: number, count: number, pad: number) {
  const seeds: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const n = start + i;
    const num = pad > 0 ? String(n).padStart(pad, '0') : String(n);
    seeds.push(`${prefix}${num}`);
  }
  return seeds;
}
