import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import * as d3 from 'd3';
import { ApiError, getJson, getJsonAuth, postJsonAuth } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { SpoilerGatePage } from './SpoilerGatePage';

type TemplateStat = {
  template_id: number;
  template_index: number;
  seed_payload: string | null;
  variant: string | null;
  max_score: number | null;
  avg_score: number;
  avg_bdr: number;
  avg_win_rate: number;
  games_played: number;
};

type MeasureKey = 'avg_win_rate' | 'avg_score' | 'avg_bdr';

const MEASURES: { key: MeasureKey; label: string; format: (v: number) => string }[] = [
  { key: 'avg_win_rate', label: 'Avg Win Rate', format: (v) => `${Math.round(v * 100)}%` },
  { key: 'avg_score', label: 'Avg Score', format: (v) => v.toFixed(1) },
  { key: 'avg_bdr', label: 'Avg BDR', format: (v) => v.toFixed(1) },
];

const TEAM_SIZE_OPTIONS = [2, 3, 4, 5, 6];

export function EventStatsPage() {
  const { slug } = useParams<{ slug: string }>();
  const { token, user } = useAuth();
  const [teamSize, setTeamSize] = useState<number>(2);
  const [measure, setMeasure] = useState<MeasureKey>('avg_win_rate');
  const [data, setData] = useState<TemplateStat[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [gateMode, setGateMode] = useState<'loading' | 'allow' | 'login' | 'blocked' | 'prompt' | 'error'>('loading');
  const [gateError, setGateError] = useState<string | null>(null);
  const [forfeitLoading, setForfeitLoading] = useState(false);

  useEffect(() => {
    if (!slug) return;
    if (!user || !token) {
      setGateMode('login');
      return;
    }

    let cancelled = false;
    const run = async () => {
      setGateMode('loading');
      setGateError(null);
      try {
        const statuses = await getJsonAuth<{ status: string; team_size: number }[]>(
          `/events/${encodeURIComponent(slug)}/eligibility/me`,
          token,
        );
        if (cancelled) return;
        const entries = Array.isArray(statuses) ? statuses : [];
        const hasEnrolled = entries.some((e) => e.status === 'ENROLLED');
        if (hasEnrolled) {
          setGateMode('blocked');
          return;
        }
        const allowedStatuses = ['INELIGIBLE', 'COMPLETED'];
        const missingSizes = [2, 3, 4, 5, 6].filter(
          (size) => !entries.some((e) => Number(e.team_size) === size),
        );
        const allAllowed = entries.length > 0 && entries.every((e) => allowedStatuses.includes(e.status));
        if (missingSizes.length === 0 && allAllowed) {
          setGateMode('allow');
        } else {
          setGateMode('prompt');
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          setGateMode('login');
          return;
        }
        console.error('Failed to check eligibility', err);
        setGateError('Failed to check eligibility. Please try again.');
        setGateMode('error');
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [slug, token, user]);

  useEffect(() => {
    if (!slug || gateMode !== 'allow') return;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const resp = await getJson<{ templates: TemplateStat[] }>(
          `/events/${encodeURIComponent(slug)}/stats?team_size=${teamSize}`,
        );
        setData(resp.templates ?? []);
      } catch (err) {
        console.error('Failed to load stats', err);
        setError('Failed to load statistics');
      } finally {
        setLoading(false);
      }
    })();
  }, [slug, teamSize, gateMode]);

  const chartData = useMemo(
    () => data.slice().sort((a, b) => a.template_index - b.template_index),
    [data],
  );

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    const width = 900;
    const height = 480;
    const margin = { top: 24, right: 20, bottom: 90, left: 70 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const x = d3
      .scaleBand<string>()
      .domain(chartData.map((d) => (d.seed_payload || `Seed ${d.template_index}`)))
      .range([0, innerWidth])
      .padding(0.35);

    const values = chartData.map((d) => (d[measure] ?? 0) as number);
    const maxY = Math.max(1, d3.max(values) ?? 1);
    const y = d3
      .scaleLinear()
      .domain([0, maxY])
      .nice()
      .range([innerHeight, 0]);

    const color = d3.scaleOrdinal<string>().domain(['dot']).range(['#2563eb']);

    const g = svg
      .attr('viewBox', `0 0 ${width} ${height}`)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const xAxis = d3.axisBottom(x).tickFormat((d) => d);
    const yAxis = d3
      .axisLeft(y)
      .ticks(6)
      .tickFormat((v) => (measure === 'avg_win_rate' ? `${Math.round(Number(v) * 100)}%` : String(v)));

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis)
      .selectAll('text')
      .style('text-anchor', 'end')
      .attr('dx', '-0.6em')
      .attr('dy', '0.1em')
      .attr('transform', 'rotate(-35)');

    g.append('g').call(yAxis);

    g.append('g')
      .selectAll('circle')
      .data(chartData)
      .join('circle')
      .attr('cx', (d) => (x(d.seed_payload || `Seed ${d.template_index}`) ?? 0) + (x.bandwidth() / 2))
      .attr('cy', (d) => y((d[measure] ?? 0) as number))
      .attr('r', 7)
      .attr('fill', (d) => color('dot'))
      .attr('opacity', 0.85);

    g.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + margin.bottom - 10)
      .attr('text-anchor', 'middle')
      .attr('fill', '#374151')
      .text('Game Seed');

    g.append('text')
      .attr('x', -margin.left + 10)
      .attr('y', -10)
      .attr('text-anchor', 'start')
      .attr('fill', '#374151')
      .style('font-weight', '600')
      .text(MEASURES.find((m) => m.key === measure)?.label ?? '');
  }, [chartData, measure]);

  if (!slug) {
    return (
      <main className="page">
        <p>Event not specified.</p>
      </main>
    );
  }

  if (gateMode !== 'allow') {
    return (
      <SpoilerGatePage
        mode={
          gateMode === 'login'
            ? 'login'
            : gateMode === 'blocked'
              ? 'blocked'
              : gateMode === 'prompt'
                ? 'prompt'
                : gateMode === 'loading'
                  ? 'loading'
                  : 'error'
        }
        eventSlug={slug}
        onForfeit={
          gateMode === 'prompt'
            ? async () => {
                if (!token) return;
                setForfeitLoading(true);
                setGateError(null);
                try {
                  await postJsonAuth(
                    `/events/${encodeURIComponent(slug)}/eligibility/spoilers`,
                    token,
                    { all_team_sizes: true, reason: 'event_stats_spoiler' },
                  );
                  setGateMode('allow');
                } catch (err) {
                  console.error('Failed to update eligibility', err);
                  setGateError('Failed to update eligibility. Please try again.');
                  setGateMode('prompt');
                } finally {
                  setForfeitLoading(false);
                }
              }
            : undefined
        }
        loading={forfeitLoading || gateMode === 'loading'}
        errorMessage={gateError}
      />
    );
  }

  return (
    <main className="page">
      <div className="stack-md">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold">Event stats</h1>
          {slug && (
            <Link to={`/events/${slug}`} className="text-blue-700 underline text-sm">
              Back to event
            </Link>
          )}
        </div>

        <div className="card">
          <div className="flex gap-4 flex-wrap items-center">
            <label className="text-sm flex items-center gap-2">
              Team size
              <select
                value={teamSize}
                onChange={(e) => setTeamSize(Number(e.target.value))}
                className="input"
              >
                {TEAM_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}-Player
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm flex items-center gap-2">
              Measure
              <select
                value={measure}
                onChange={(e) => setMeasure(e.target.value as MeasureKey)}
                className="input"
              >
                {MEASURES.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {loading && <p className="text-gray-600 text-sm mt-3">Loading chart…</p>}
          {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
          {!loading && !error && chartData.length === 0 && (
            <p className="text-gray-600 text-sm mt-3">No data yet for this team size.</p>
          )}

          {chartData.length > 0 && (
            <div style={{ marginTop: '1rem', overflowX: 'auto' }}>
              <svg ref={svgRef} />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
