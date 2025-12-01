import { useState, useMemo, useEffect, useRef, type ReactNode, type FormEvent } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { postJsonAuth, ApiError, getJson, putJsonAuth, getJsonAuth } from '../../lib/api';
import {
  Alert,
  Button,
  Card,
  CardHeader,
  CardBody,
  Checkbox,
  Heading,
  Inline,
  Input,
  Modal,
  PageContainer,
  Section,
  Pill,
  Radio,
  Stack,
  Text,
  Tooltip,
  InputContainer,
} from '../../design-system';
import { replaceEmojiShortcodes } from '../../utils/emoji';
import type { EventDetail } from '../../hooks/useEventDetail';

type StepKey = 'event' | 'registration' | 'stage' | 'templates';

const steps: { key: StepKey; label: string }[] = [
  { key: 'event', label: 'Event Info' },
  { key: 'registration', label: 'Registration' },
  { key: 'stage', label: 'Stage' },
  { key: 'templates', label: 'Templates' },
];

type EventStage = {
  label: string;
  config_json: unknown;
  starts_at: string | null;
  ends_at: string | null;
  stage_type: 'SINGLE' | 'ROUND_ROBIN' | 'BRACKET' | 'GAUNTLET';
  event_stage_id?: number;
};

type EventGameTemplate = {
  variant: string;
};

type StageForm = {
  id?: number;
  label: string;
  abbr: string;
  gameCount: number;
  startsAt: string;
  endsAt: string;
  timeBound: boolean;
  stageType: 'SINGLE' | 'ROUND_ROBIN' | 'BRACKET' | 'GAUNTLET';
  roundPattern?: RoundPattern;
};

type RoundPattern = {
  namePattern: string;
  abbrPattern: string;
  playDays: number;
  gapDays: number;
  gamesPerRound: string; // comma-separated numbers
};

const defaultRoundPattern: RoundPattern = {
  namePattern: 'Round {i}',
  abbrPattern: 'R{i}',
  playDays: 7,
  gapDays: 0,
  gamesPerRound: '3,3,5,5,7,7',
};

function normalizeRoundPattern(partial?: Partial<RoundPattern> | null): RoundPattern {
  if (!partial) return { ...defaultRoundPattern };
  return {
    namePattern: partial.namePattern ?? defaultRoundPattern.namePattern,
    abbrPattern: partial.abbrPattern ?? defaultRoundPattern.abbrPattern,
    playDays: partial.playDays ?? defaultRoundPattern.playDays,
    gapDays: partial.gapDays ?? defaultRoundPattern.gapDays,
    gamesPerRound: partial.gamesPerRound ?? defaultRoundPattern.gamesPerRound,
  };
}

type StepCardProps = {
  title: string;
  stepLabel?: string;
  children: ReactNode;
};

function StepCard({ title, stepLabel, children }: StepCardProps) {
  return (
    <Card variant="outline">
      <CardHeader>
        <Inline align="center" justify="space-between" wrap>
          <Heading level={4}>{title}</Heading>
          {stepLabel ? (
            <Pill size="sm" variant="accent">
              {stepLabel}
            </Pill>
          ) : null}
        </Inline>
      </CardHeader>
      <CardBody>{children}</CardBody>
    </Card>
  );
}

type RoundPatternEditorProps = {
  value?: RoundPattern;
  onChange: (next: RoundPattern) => void;
};

function RoundPatternEditor({ value, onChange }: RoundPatternEditorProps) {
  const [showRoundHelp, setShowRoundHelp] = useState(false);
  const pattern = normalizeRoundPattern(value);
  const abbrHasInvalidChars = /[^A-Za-z0-9{}-]/.test(pattern.abbrPattern);

  const update = (patch: Partial<StageForm['roundPattern']>) => {
    onChange(normalizeRoundPattern({ ...pattern, ...patch }));
  };

  return (
    <Stack gap="sm">
      {abbrHasInvalidChars && (
        <Alert
          variant="error"
          message="Round abbreviations must use only letters, numbers, hyphens, or tokens. Refer to the info icon above for valid patterns."
        />
      )}
      <FormLayout orientation="horizontal" gap="sm" columnWidths={['2fr', '2fr']}>
        <InputContainer
          label="Round name pattern"
          labelAction={
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="ui-icon-button"
              onClick={() => setShowRoundHelp((prev) => !prev)}
              aria-label="Round pattern help"
              title="Round pattern help"
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                info
              </span>
            </Button>
          }
        >
          <Input
            value={pattern.namePattern}
            onChange={(e) => update({ namePattern: e.target.value })}
            fullWidth
          />
        </InputContainer>
        <InputContainer label="Round abbreviation pattern">
          <Input
            value={pattern.abbrPattern}
            onChange={(e) => update({ abbrPattern: e.target.value })}
            fullWidth
          />
        </InputContainer>
      </FormLayout>
      <FormLayout orientation="horizontal" gap="sm" columnWidths={['1fr', '1fr']}>
        <InputContainer label="Days per round">
          <Input
            type="number"
            min={1}
            value={pattern.playDays}
            onChange={(e) => update({ playDays: Number(e.target.value) })}
            fullWidth
          />
        </InputContainer>
        <InputContainer label="Gap days between rounds">
          <Input
            type="number"
            min={0}
            value={pattern.gapDays}
            onChange={(e) => update({ gapDays: Number(e.target.value) })}
            fullWidth
          />
        </InputContainer>
      </FormLayout>
      <FormLayout orientation="horizontal" gap="sm" columnWidths={['1fr']}>
        <InputContainer label="Games per round (comma separated)">
          <Input
            value={pattern.gamesPerRound}
            onChange={(e) => update({ gamesPerRound: e.target.value })}
            fullWidth
          />
        </InputContainer>
      </FormLayout>

      <Modal open={showRoundHelp} onClose={() => setShowRoundHelp(false)} maxWidth="640px">
        <Stack gap="xs">
          <Heading level={4}>Round naming patterns</Heading>
          <Text>
            Use tokens to generate round names/abbreviations automatically. Available tokens:
          </Text>
          <ul className="text-sm text-gray-700" style={{ paddingLeft: '16px', margin: 0 }}>
            <li>{'{i}'} = round index (1-based)</li>
            <li>{'{t}'} = teams remaining (if known)</li>
          </ul>
          <Text variant="body">
            Example: {'Round {i}'} → Round 1, Round 2. Abbreviation pattern {'R{i}'} → R1, R2.
          </Text>
        </Stack>
      </Modal>
    </Stack>
  );
}

type StageBlockProps = {
  stage: StageForm;
  index: number;
  parsedMaxTeams: number | null;
  updateStage: (idx: number, patch: Partial<StageForm>) => void;
  seedingFormat: string;
};

function StageBlock({ stage, index, parsedMaxTeams, updateStage, seedingFormat }: StageBlockProps) {
  const pillLabel =
    stage.stageType === 'ROUND_ROBIN'
      ? seedingFormat === 'groups'
        ? 'Group Stage'
        : 'Round Robin'
      : stage.stageType === 'BRACKET'
        ? 'Bracket'
        : 'Main Stage';

  return (
    <Card variant="subtle" padding="md">
      <CardHeader>
        <Inline align="center" justify="space-between" wrap>
          <Pill size="sm" variant="accent">
            {pillLabel}
          </Pill>
        </Inline>
      </CardHeader>
      <CardBody>
        {stage.stageType !== 'BRACKET' && (
          <FormLayout orientation="horizontal" gap="sm" columnWidths={['2fr', '2fr', '1fr']}>
            <InputContainer label="Starts">
              <Input
                type="date"
                value={stage.startsAt}
                onChange={(e) => updateStage(index, { startsAt: e.target.value })}
                disabled={!stage.timeBound}
                fullWidth
                required={stage.timeBound}
              />
            </InputContainer>
            <InputContainer label="Ends">
              <Input
                type="date"
                value={stage.endsAt}
                onChange={(e) => updateStage(index, { endsAt: e.target.value })}
                disabled={!stage.timeBound}
                fullWidth
                required={stage.timeBound}
              />
            </InputContainer>
            <InputContainer label="Number of Games">
              <Input
                type="number"
                min={1}
                value={stage.gameCount}
                onChange={(e) => updateStage(index, { gameCount: Number(e.target.value) })}
                required
                fullWidth
              />
            </InputContainer>
          </FormLayout>
        )}

        {stage.stageType === 'BRACKET' && (
          <Stack gap="sm">
            <Heading level={5}>Bracket rounds pattern</Heading>
            <RoundPatternEditor
              value={stage.roundPattern}
              onChange={(next) => updateStage(index, { roundPattern: next })}
            />
            <BracketPreview
              startDate={stage.startsAt}
              roundPattern={stage.roundPattern}
              maxTeams={parsedMaxTeams}
            />
          </Stack>
        )}
      </CardBody>
    </Card>
  );
}

type FormLayoutProps = {
  orientation?: 'horizontal' | 'vertical';
  gap?: 'xs' | 'sm' | 'md';
  columnWidths?: string[];
  children: ReactNode;
};

function FormLayout({
  orientation = 'vertical',
  gap = 'sm',
  columnWidths,
  children,
}: FormLayoutProps) {
  const spacing =
    gap === 'xs'
      ? 'var(--ds-space-xs)'
      : gap === 'sm'
        ? 'var(--ds-space-sm)'
        : 'var(--ds-space-md)';
  if (orientation === 'horizontal') {
    const template = columnWidths && columnWidths.length > 0 ? columnWidths.join(' ') : undefined;
    return (
      <div style={{ display: 'grid', gridTemplateColumns: template, gap: spacing, width: '100%' }}>
        {children}
      </div>
    );
  }
  return <Stack gap={gap}>{children}</Stack>;
}

type FormFieldProps = {
  label: string;
  error?: string;
  helperText?: string;
  labelAction?: ReactNode;
  children: ReactNode;
};

function FormField({ label, error, helperText, children, labelAction }: FormFieldProps) {
  return (
    <InputContainer label={label} error={error} helperText={helperText} labelAction={labelAction}>
      {children}
    </InputContainer>
  );
}

type NavItem = { key: StepKey; label: string; onClick: () => void; active: boolean };
function NavLinkBar({ items }: { items: NavItem[] }) {
  return (
    <Inline gap="sm" wrap>
      {items.map((item) => (
        <Button
          key={item.key}
          variant={item.active ? 'secondary' : 'ghost'}
          size="sm"
          onClick={item.onClick}
        >
          {item.label}
        </Button>
      ))}
    </Inline>
  );
}

type BracketPreviewProps = {
  startDate?: string;
  roundPattern?: {
    namePattern: string;
    abbrPattern: string;
    playDays: number;
    gapDays: number;
    gamesPerRound: string;
  };
  maxTeams: number | null;
};

function BracketPreview({ startDate, roundPattern, maxTeams }: BracketPreviewProps) {
  const roundsCount = maxTeams ? Math.ceil(Math.log2(maxTeams)) : 7;
  const pattern = roundPattern ?? {
    namePattern: 'Round {i}',
    abbrPattern: 'R{i}',
    playDays: 7,
    gapDays: 0,
    gamesPerRound: '3,3,5,5,7,7',
  };
  const gameCounts = pattern.gamesPerRound
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => !Number.isNaN(n) && n > 0);

  const rounds = [];
  const names = ['Round One', 'Round Two', 'Round Three', 'Round Four', 'Round Five', 'Round Six'];
  let teamsRemaining = maxTeams ?? 0;
  let currentDate = startDate ? new Date(startDate) : null;

  for (let i = 0; i < roundsCount; i += 1) {
    const nameFromPattern = pattern.namePattern
      .replace('{i}', String(i + 1))
      .replace('{t}', teamsRemaining ? String(teamsRemaining) : '');
    const abbrFromPattern = pattern.abbrPattern
      .replace('{i}', String(i + 1))
      .replace('{t}', teamsRemaining ? String(teamsRemaining) : '');
    const displayName =
      pattern.namePattern.includes('{i}') || pattern.namePattern.includes('{t}')
        ? nameFromPattern
        : (names[i] ?? `Round ${i + 1}`);
    const games = gameCounts[i] ?? gameCounts[gameCounts.length - 1] ?? 1;
    let start = '';
    let end = '';
    if (currentDate) {
      const s = new Date(currentDate);
      const e = new Date(currentDate);
      e.setDate(e.getDate() + (pattern.playDays > 0 ? pattern.playDays - 1 : 0));
      start = s.toISOString().slice(0, 10);
      end = e.toISOString().slice(0, 10);
      currentDate = new Date(e);
      currentDate.setDate(currentDate.getDate() + (pattern.gapDays ?? 0) + 1);
      teamsRemaining =
        teamsRemaining > 0 ? Math.max(1, Math.ceil(teamsRemaining / 2)) : teamsRemaining;
    }
    rounds.push({ name: displayName, abbr: abbrFromPattern, start, end, games });
  }

  return (
    <Stack gap="xs">
      <Inline align="center" justify="space-between" wrap>
        <Heading level={6}>Preview</Heading>
        {maxTeams ? (
          <Pill size="sm" variant="default">
            Max teams: {maxTeams}
          </Pill>
        ) : null}
      </Inline>
      {rounds.length === 0 ? (
        <Text variant="caption">
          Add a bracket start date to generate the round schedule. Dates will compress automatically
          if fewer rounds are needed.
        </Text>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 'var(--ds-space-sm)',
            }}
          >
            {(rounds.length >= 3 ? [rounds[0], rounds[1], rounds[rounds.length - 1]] : rounds).map(
              (r, idx) => (
                <Card key={`${r.name}-${idx}`} variant="subtle" tone="neutral" padding="sm">
                  <Stack gap="xs">
                    <Text variant="body">Name: {r.name}</Text>
                    <Text variant="body">Abbreviation: {r.abbr}</Text>
                    <Text variant="body">
                      Dates: {r.start && r.end ? `${r.start} → ${r.end}` : 'TBD'}
                    </Text>
                    <Text variant="body">Games: {r.games}</Text>
                  </Stack>
                </Card>
              ),
            )}
          </div>
          {rounds.length >= 3 && (
            <Text variant="caption">Showing first two rounds and final round.</Text>
          )}
        </>
      )}
    </Stack>
  );
}

export function AdminCreateEventPage() {
  const { user, token } = useAuth();
  const { slug: editSlug } = useParams();
  const isEdit = Boolean(editSlug);
  const [name, setName] = useState('');
  const [eventType, setEventType] = useState<'Challenge' | 'Tournament'>('Challenge');
  const [eventAbbr, setEventAbbr] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [shortDescription, setShortDescription] = useState('');
  const [longDescription, setLongDescription] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [seedingPlayEnabled, setSeedingPlayEnabled] = useState(false);
  const [seedingFormat, setSeedingFormat] = useState<'round_robin' | 'groups' | ''>('');
  const [maxTeams, setMaxTeams] = useState<string>('');

  const [stages, setStages] = useState<StageForm[]>([
    {
      label: '',
      abbr: '',
      gameCount: 100,
      startsAt: '',
      endsAt: '',
      timeBound: true,
      stageType: 'SINGLE',
      roundPattern: {
        namePattern: 'Round {i}',
        abbrPattern: 'R{i}',
        playDays: 7,
        gapDays: 0,
        gamesPerRound: '3,3,5,5,7,7',
      },
    },
  ]);

  const [variant, setVariant] = useState('No Variant');
  const [seedCount, setSeedCount] = useState(100);
  const [seedFormula, setSeedFormula] = useState('{eID}-{i}');
  const [seedHashToken] = useState(() => generateHashToken());
  const [published, setPublished] = useState(false);
  const [allowLateRegistration, setAllowLateRegistration] = useState(true);
  const [registrationOpens, setRegistrationOpens] = useState('');
  const [registrationCutoff, setRegistrationCutoff] = useState('');
  const [enforceExactTeamSize, setEnforceExactTeamSize] = useState(false);

  const [currentStep, setCurrentStep] = useState<StepKey>('event');
  const [showPreview, setShowPreview] = useState(false);
  const [showFormulaHelp, setShowFormulaHelp] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const hasLoadedExisting = useRef(false);

  const abbrHasSpace = /\s/.test(eventAbbr);
  const formulaHasSpace = /\s/.test(seedFormula);
  const formulaHasInvalidChars = !/^[A-Za-z0-9{}:_.-]+$/.test(seedFormula);
  const isTournament = eventType === 'Tournament';
  const parsedMaxTeams = maxTeams ? Number(maxTeams) : null;
  const isUnauthorized = !user || (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN');

  useEffect(() => {
    if (!slugEdited) {
      setSlug(slugify(name));
    }
    setStages((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      next[0] = { ...next[0], label: name };
      return next;
    });
  }, [name, slugEdited, eventType]);

  useEffect(() => {
    if (isTournament) {
      setAllowLateRegistration(false);
      setEnforceExactTeamSize(true);
    }
  }, [isTournament]);

  useEffect(() => {
    // Challenge: lock stage abbreviation to event abbreviation
    if (eventType === 'Challenge') {
      setStages((prev) => {
        if (prev.length === 0) return prev;
        const next = [...prev];
        next[0] = { ...next[0], abbr: eventAbbr };
        return next;
      });
    }
  }, [eventAbbr, eventType]);

  useEffect(() => {
    const gc = stages[0]?.gameCount;
    if (gc != null) {
      setSeedCount(gc);
    }
  }, [stages]);

  // Derive stages from event type / seeding selections
  useEffect(() => {
    setStages((prev) => {
      const stage0 = prev[0];
      const stage1 = prev[1];
      const desired: StageForm[] = [];

      if (eventType === 'Tournament') {
        if (seedingPlayEnabled) {
          desired.push({
            label: seedingFormat === 'groups' ? 'Group Stage' : 'Round Robin',
            abbr: stage0?.abbr || eventAbbr || '',
            gameCount: stage0?.gameCount || 25,
            startsAt: stage0?.startsAt || startsAt,
            endsAt: stage0?.endsAt || endsAt,
            timeBound: stage0?.timeBound ?? Boolean(startsAt || endsAt),
            stageType: 'ROUND_ROBIN',
            roundPattern: normalizeRoundPattern(stage0?.roundPattern),
          });
        }
        desired.push({
          label: 'Bracket',
          abbr: stage1?.abbr || eventAbbr || '',
          gameCount: stage1?.gameCount || seedCount,
          startsAt: stage1?.startsAt || startsAt,
          endsAt: stage1?.endsAt || endsAt,
          timeBound: stage1?.timeBound ?? Boolean(startsAt || endsAt),
          stageType: 'BRACKET',
          roundPattern: normalizeRoundPattern(stage1?.roundPattern),
        });
      } else {
        desired.push({
          label: name,
          abbr: eventAbbr || '',
          gameCount: stage0?.gameCount || seedCount,
          startsAt: stage0?.startsAt || startsAt,
          endsAt: stage0?.endsAt || endsAt,
          timeBound: stage0?.timeBound ?? Boolean(startsAt || endsAt),
          stageType: 'SINGLE',
          roundPattern: normalizeRoundPattern(stage0?.roundPattern),
        });
      }

      const next = desired.map((desiredStage, idx) => {
        const existing = prev[idx];
        return {
          ...desiredStage,
          label: desiredStage.label || existing?.label || '',
          abbr: desiredStage.abbr || existing?.abbr || '',
          gameCount: existing?.gameCount ?? desiredStage.gameCount,
          startsAt: existing?.startsAt ?? desiredStage.startsAt,
          endsAt: existing?.endsAt ?? desiredStage.endsAt,
          timeBound: existing?.timeBound ?? desiredStage.timeBound,
          roundPattern: existing?.roundPattern ?? desiredStage.roundPattern,
        };
      });

      const unchanged =
        next.length === prev.length && next.every((stage, idx) => stagesEqual(stage, prev[idx]));
      return unchanged ? prev : next;
    });
  }, [
    eventType,
    seedingPlayEnabled,
    seedingFormat,
    eventAbbr,
    name,
    startsAt,
    endsAt,
    seedCount,
    isTournament,
    maxTeams,
  ]);

  // Default registration cutoff to end date when provided and cutoff is empty
  useEffect(() => {
    if (endsAt && !registrationCutoff) {
      setRegistrationCutoff(endsAt);
    }
  }, [endsAt, registrationCutoff]);

  useEffect(() => {
    if (startsAt && !registrationOpens) {
      setRegistrationOpens(startsAt);
    }
  }, [startsAt, registrationOpens]);

  useEffect(() => {
    if (!isEdit || !editSlug || hasLoadedExisting.current) return;
    const load = async () => {
      setLoadingExisting(true);
      setError(null);
      if (!token) {
        setError('Missing auth token');
        setLoadingExisting(false);
        return;
      }
      try {
        const event = await getJsonAuth<EventDetail>(`/events/${editSlug}`, token);
        setName(event.name);
        setSlug(event.slug);
        setShortDescription(event.short_description || '');
        setLongDescription(event.long_description || '');
        const evStart = event.starts_at ? event.starts_at.slice(0, 10) : '';
        const evEnd = event.ends_at ? event.ends_at.slice(0, 10) : '';
        setStartsAt(evStart);
        setEndsAt(evEnd);
        setPublished(event.published ?? false);
        const format = event.event_format === 'tournament' ? 'tournament' : 'challenge';
        setEventType(format === 'tournament' ? 'Tournament' : 'Challenge');
        setSeedingPlayEnabled(Boolean(event.round_robin_enabled));
        setSeedingFormat(event.round_robin_enabled ? 'round_robin' : '');
        setMaxTeams(event.max_teams ? String(event.max_teams) : '');
        setAllowLateRegistration(
          format === 'tournament' ? false : (event.allow_late_registration ?? true),
        );
        setRegistrationOpens(
          event.registration_opens_at ? event.registration_opens_at.slice(0, 10) : evStart,
        );
        setRegistrationCutoff(
          event.registration_cutoff ? event.registration_cutoff.slice(0, 10) : '',
        );

        const stages = await getJson<EventStage[]>(`/events/${editSlug}/stages`);
        if (stages.length > 0) {
          const loadedStages: StageForm[] = stages.map((stage) => {
            const config = (stage.config_json ?? {}) as {
              stage_abbreviation?: string;
              event_abbreviation?: string;
              bracket_round_pattern?: {
                name_pattern?: string;
                abbr_pattern?: string;
                play_days?: number;
                gap_days?: number;
                games_per_round?: string;
              };
            };
            const stAbbr = config.stage_abbreviation || config.event_abbreviation || '';
            const stStart = stage.starts_at ? stage.starts_at.slice(0, 10) : '';
            const stEnd = stage.ends_at ? stage.ends_at.slice(0, 10) : '';
            const pattern = config.bracket_round_pattern;
            const roundPattern =
              stage.stage_type === 'BRACKET'
                ? normalizeRoundPattern({
                    namePattern: pattern?.name_pattern,
                    abbrPattern: pattern?.abbr_pattern,
                    playDays: pattern?.play_days,
                    gapDays: pattern?.gap_days,
                    gamesPerRound: pattern?.games_per_round,
                  })
                : undefined;
            return {
              id: stage.event_stage_id,
              label: stage.label,
              abbr: stAbbr,
              gameCount: seedCount,
              startsAt: stStart,
              endsAt: stEnd,
              timeBound: Boolean(stStart || stEnd),
              stageType: stage.stage_type,
              roundPattern,
            };
          });
          setStages(
            loadedStages.length
              ? loadedStages
              : [
                  {
                    label: event.name,
                    abbr: eventAbbr,
                    gameCount: seedCount,
                    startsAt: evStart,
                    endsAt: evEnd,
                    timeBound: Boolean(evStart || evEnd),
                    stageType: 'SINGLE',
                  },
                ],
          );
          const enforce =
            ((stages[0]?.config_json ?? {}) as { enforce_exact_team_size?: boolean })
              .enforce_exact_team_size ?? false;
          setEnforceExactTeamSize(format === 'tournament' ? true : !!enforce);
        }

        const templates = await getJson<EventGameTemplate[]>(`/events/${editSlug}/game-templates`);
        if (templates.length > 0) {
          setVariant(templates[0].variant || 'No Variant');
          setSeedCount(templates.length);
          setStages((prev) => {
            if (prev.length === 0) return prev;
            const next = [...prev];
            next[0] = { ...next[0], gameCount: templates.length };
            return next;
          });
        }
      } catch {
        setError('Failed to load event for editing');
      } finally {
        hasLoadedExisting.current = true;
        setLoadingExisting(false);
      }
    };
    load();
  }, [isEdit, editSlug, token, seedCount, eventAbbr]);

  const invalidTokens = useMemo(() => {
    const matches = [...seedFormula.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
    return matches.filter(
      (tok) =>
        tok !== 'eID' &&
        tok !== 'sID' &&
        tok !== 'rID' &&
        tok !== 'i' &&
        tok !== 'hash' &&
        !/^0+i$/.test(tok),
    );
  }, [seedFormula]);

  const requiredTokensMissing = useMemo(() => {
    const needed = ['eID', 'i'];
    if (isTournament) needed.push('rID');
    const present = new Set([...seedFormula.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]));
    return needed.filter((tok) => !present.has(tok));
  }, [seedFormula, isTournament]);

  useEffect(() => {
    if (!isTournament) return;
    setSeedFormula((prev) => {
      if (prev.includes('{rID}')) return prev;
      if (prev.includes('{i}')) return prev.replace('{i}', '{rID}-{i}');
      return `${prev}-{rID}`;
    });
  }, [isTournament]);

  const seedPreview = useMemo(() => {
    const activeStageAbbr = getStageAbbrForSeeds(stages[0], eventAbbr, parsedMaxTeams);
    const rId = getRoundIdForStage(stages[0], 0);
    const seeds = buildSeedsFromFormula(
      seedFormula,
      eventAbbr,
      activeStageAbbr,
      rId,
      seedCount,
      seedHashToken,
    );
    const first = seeds.slice(0, 3);
    const last = seeds.slice(-3);
    return seeds.length > 6 ? [...first, '…', ...last] : seeds;
  }, [seedFormula, eventAbbr, stages, seedCount, seedHashToken, parsedMaxTeams]);

  const seedsHaveInvalidChars = useMemo(() => {
    const activeStageAbbr = getStageAbbrForSeeds(stages[0], eventAbbr, parsedMaxTeams);
    const rId = getRoundIdForStage(stages[0], 0);
    const seeds = buildSeedsFromFormula(
      seedFormula,
      eventAbbr,
      activeStageAbbr,
      rId,
      Math.min(seedCount, 10),
      seedHashToken,
    );
    return seeds.some((s) => !/^[A-Za-z0-9-]+$/.test(s));
  }, [seedFormula, eventAbbr, stages, seedCount, seedHashToken, parsedMaxTeams]);

  const duplicateSeedsError = useMemo(() => {
    const allSeeds: string[] = [];
    stages.forEach((st, idx) => {
      const stageAbbr = getStageAbbrForSeeds(st, eventAbbr, parsedMaxTeams);
      const rId = getRoundIdForStage(st, idx);
      const seeds = buildSeedsFromFormula(
        seedFormula,
        eventAbbr,
        stageAbbr,
        rId,
        st.gameCount,
        seedHashToken,
      );
      allSeeds.push(...seeds);
    });
    const seen = new Set<string>();
    for (const s of allSeeds) {
      if (seen.has(s))
        return 'Seed pattern results in duplicate seeds. Include round and game tokens.';
      seen.add(s);
    }
    return null;
  }, [stages, seedFormula, eventAbbr, parsedMaxTeams, seedHashToken]);

  const tournamentLimitError = useMemo(() => {
    if (!isTournament) return null;
    if (
      !maxTeams.trim() ||
      parsedMaxTeams == null ||
      Number.isNaN(parsedMaxTeams) ||
      parsedMaxTeams <= 0
    ) {
      return 'Select a valid max teams value for tournaments.';
    }
    if (seedingPlayEnabled && !seedingFormat) {
      return 'Choose a seeding play format.';
    }
    return null;
  }, [isTournament, maxTeams, parsedMaxTeams, seedingPlayEnabled, seedingFormat]);

  const eventValid =
    !!name &&
    !!slug &&
    !!longDescription &&
    !!eventAbbr &&
    !abbrHasSpace &&
    !formulaHasSpace &&
    !tournamentLimitError;
  const stageValid =
    stages.length > 0 &&
    stages.every((st) => {
      const hasSpace = /\s/.test(st.abbr);
      return (
        !!st.label &&
        !!st.abbr &&
        !hasSpace &&
        st.gameCount > 0 &&
        (st.timeBound ? datesValid(st.startsAt, st.endsAt) : true)
      );
    });
  const templatesValid =
    !!variant &&
    seedCount >= 1 &&
    !!seedFormula.trim() &&
    !formulaHasSpace &&
    !formulaHasInvalidChars &&
    invalidTokens.length === 0 &&
    requiredTokensMissing.length === 0 &&
    !seedsHaveInvalidChars &&
    !duplicateSeedsError;
  const registrationValid = isTournament ? Boolean(registrationOpens && registrationCutoff) : true;

  const stagesEqual = (a: StageForm, b: StageForm) =>
    a.label === b.label &&
    a.abbr === b.abbr &&
    a.gameCount === b.gameCount &&
    a.startsAt === b.startsAt &&
    a.endsAt === b.endsAt &&
    a.timeBound === b.timeBound &&
    a.stageType === b.stageType &&
    JSON.stringify(a.roundPattern ?? null) === JSON.stringify(b.roundPattern ?? null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user || !token) return;
    if (!eventValid || !stageValid || !templatesValid) return;
    // registrationValid currently always true

    const regOpensIso = registrationOpens ? `${registrationOpens}T00:00:00Z` : null;
    setSaving(true);
    setMessage(null);
    setError(null);
    const eventFormat = isTournament ? 'tournament' : 'challenge';
    const payloadMaxTeams = isTournament ? parsedMaxTeams : null;
    const payloadMaxRounds = null;
    const payloadAllowLate = isTournament ? false : allowLateRegistration;

    try {
      if (isEdit && editSlug) {
        await putJsonAuth(`/events/${encodeURIComponent(editSlug)}`, token, {
          name,
          new_slug: slug,
          short_description: shortDescription || null,
          long_description: longDescription,
          published,
          event_format: eventFormat,
          round_robin_enabled: seedingPlayEnabled && seedingFormat === 'round_robin',
          max_teams: payloadMaxTeams,
          max_rounds: payloadMaxRounds,
          allow_late_registration: payloadAllowLate,
          registration_opens_at: regOpensIso,
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
          event_format: eventFormat,
          round_robin_enabled: seedingPlayEnabled && seedingFormat === 'round_robin',
          max_teams: payloadMaxTeams,
          max_rounds: payloadMaxRounds,
          allow_late_registration: payloadAllowLate,
          registration_opens_at: regOpensIso,
          registration_cutoff: registrationCutoff || null,
          starts_at: startsAt ? `${startsAt}T12:00:00Z` : null,
          ends_at: endsAt ? `${endsAt}T23:59:59Z` : null,
        });
      }

      for (let idx = 0; idx < stages.length; idx += 1) {
        const st = stages[idx];
        const stagePayload = await postJsonAuth<{ event_stage_id: number }>(
          `/events/${encodeURIComponent(slug)}/stages`,
          token,
          {
            stage_index: idx + 1,
            label: st.label || name,
            stage_type: st.stageType,
            starts_at: st.timeBound && st.startsAt ? `${st.startsAt}T00:00:00Z` : null,
            ends_at: st.timeBound && st.endsAt ? `${st.endsAt}T23:59:59Z` : null,
            config_json: {
              event_abbreviation: eventAbbr || null,
              stage_abbreviation: st.abbr || null,
              enforce_exact_team_size: enforceExactTeamSize,
              bracket_type: st.stageType === 'BRACKET' ? 'SINGLE_ELIM' : null,
              include_round_robin: st.stageType === 'ROUND_ROBIN',
              bracket_max_teams: payloadMaxTeams,
              bracket_max_rounds: payloadMaxRounds,
              seeding_play_enabled: isTournament ? seedingPlayEnabled : false,
              seeding_format: isTournament ? seedingFormat : '',
              bracket_round_pattern:
                st.stageType === 'BRACKET'
                  ? {
                      name_pattern: st.roundPattern?.namePattern ?? 'Round {i}',
                      abbr_pattern: st.roundPattern?.abbrPattern ?? 'R{i}',
                      play_days: st.roundPattern?.playDays ?? 7,
                      gap_days: st.roundPattern?.gapDays ?? 0,
                      games_per_round: st.roundPattern?.gamesPerRound ?? '3,3,5,5,7,7',
                    }
                  : undefined,
            },
          },
        );

        const stageSeeds = buildSeedsFromFormula(
          seedFormula,
          eventAbbr,
          st.abbr,
          getRoundIdForStage(st, idx),
          st.gameCount,
          seedHashToken,
        );
        for (let i = 0; i < stageSeeds.length; i += 1) {
          await postJsonAuth(`/events/${encodeURIComponent(slug)}/game-templates`, token, {
            event_stage_id: stagePayload.event_stage_id,
            template_index: i + 1,
            variant,
            seed_payload: stageSeeds[i],
            metadata_json: {},
          });
        }
      }

      setMessage(
        isEdit
          ? `Updated event "${name}".`
          : `Created event "${name}" with ${seedCount} templates.`,
      );
      setName('');
      setEventAbbr('');
      setSlug('');
      setSlugEdited(false);
      setShortDescription('');
      setLongDescription('');
      setStartsAt('');
      setEndsAt('');
      setStages([
        {
          label: '',
          abbr: '',
          gameCount: 100,
          startsAt: '',
          endsAt: '',
          timeBound: true,
          stageType: 'SINGLE',
        },
      ]);
      setVariant('No Variant');
      setSeedCount(100);
      setSeedFormula('{eID}{i}');
      setEventType('Challenge');
      setSeedingPlayEnabled(false);
      setSeedingFormat('');
      setMaxTeams('');
      setPublished(false);
      setAllowLateRegistration(true);
      setRegistrationOpens('');
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
    if (key === 'registration') return registrationValid;
    return templatesValid;
  };

  function renderNav() {
    return (
      <div className="ui-topnav__links">
        <NavLinkBar
          items={steps.map((step) => ({
            key: step.key,
            label: step.label,
            onClick: () => setCurrentStep(step.key),
            active: step.key === currentStep,
          }))}
        />
      </div>
    );
  }

  // EVENT INFO
  function renderEventForm() {
    return (
      <Card variant="outline">
        <CardHeader>
          <Inline align="center" justify="space-between" wrap>
            <Heading level={4}>Event Basics</Heading>
            <Pill size="sm" variant="accent">
              Step 1 of 4
            </Pill>
          </Inline>
        </CardHeader>
        <CardBody>
          <InputContainer label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} required fullWidth />
          </InputContainer>
          <InputContainer label="Slug">
            <Input
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugEdited(true);
              }}
              required
              fullWidth
            />
          </InputContainer>

          <InputContainer label="Short Description">
            <Input
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              placeholder="Brief summary"
              required
              fullWidth
            />
          </InputContainer>

          <InputContainer
            label="Abbreviation"
            helperText={abbrHasSpace ? 'Abbreviation cannot contain spaces.' : undefined}
          >
            <Input
              placeholder="e.g., NVC25"
              value={eventAbbr}
              onChange={(e) => setEventAbbr(e.target.value)}
              required
              fullWidth
            />
          </InputContainer>

          <FormLayout orientation="horizontal" gap="sm" columnWidths={['1fr']}>
            <FormField label="Event Type">
              <div className="flex items-center" style={{ gap: 'var(--space-md)' }}>
                <Radio
                  name="event-type"
                  checked={eventType === 'Challenge'}
                  onChange={() => {
                    setEventType('Challenge');
                    setSeedingPlayEnabled(false);
                    setSeedingFormat('');
                    setMaxTeams('');
                  }}
                  label="Challenge"
                />
                <Radio
                  name="event-type"
                  checked={eventType === 'Tournament'}
                  onChange={() => setEventType('Tournament')}
                  label="Tournament"
                />
              </div>
            </FormField>
          </FormLayout>

          {isTournament && (
            <Stack gap="sm">
              <FormLayout
                orientation="horizontal"
                gap="sm"
                columnWidths={['1.5fr', '1fr', '0.8fr']}
              >
                <FormField label="Seeding play">
                  <Checkbox
                    label="Include seeding play"
                    checked={seedingPlayEnabled}
                    onChange={(e) => {
                      setSeedingPlayEnabled(e.target.checked);
                      if (!e.target.checked) setSeedingFormat('');
                    }}
                  />
                </FormField>
                <FormField label="Seeding format">
                  <select
                    className="ui-input ui-input--md ui-input--full"
                    value={seedingFormat}
                    onChange={(e) =>
                      setSeedingFormat(e.target.value as 'round_robin' | 'groups' | '')
                    }
                    required={seedingPlayEnabled}
                    disabled={!seedingPlayEnabled}
                  >
                    <option value="">Choose format</option>
                    <option value="round_robin">Round robin (single pool)</option>
                    <option value="groups">Group stage (multi-pool)</option>
                  </select>
                </FormField>
                <FormField
                  label="Max Teams"
                  labelAction={
                    <Tooltip content="Select the maximum teams for the bracket (power of two up to 64). Tournaments require a valid max team count.">
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: '18px', color: 'var(--ds-color-text-muted)' }}
                        aria-label="Max teams info"
                      >
                        info
                      </span>
                    </Tooltip>
                  }
                >
                  <select
                    className="ui-input ui-input--md ui-input--full"
                    value={maxTeams}
                    onChange={(e) => setMaxTeams(e.target.value)}
                    required
                    style={{ width: '100%' }}
                  >
                    <option value="">Select</option>
                    <option value="2">2</option>
                    <option value="4">4</option>
                    <option value="8">8</option>
                    <option value="16">16</option>
                    <option value="32">32</option>
                    <option value="64">64</option>
                  </select>
                </FormField>
              </FormLayout>
            </Stack>
          )}

          <Stack gap="xs" style={{ position: 'relative' }}>
            <Input
              multiline
              rows={10}
              style={{ resize: 'none', minHeight: '200px' }}
              id="long-description"
              label="Long Description (Markdown)"
              labelAction={
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="ui-icon-button"
                  onClick={() => setShowPreview((prev) => !prev)}
                  aria-label="Preview markdown"
                  title="Preview markdown"
                >
                  <span className="material-symbols-outlined" aria-hidden="true">
                    visibility
                  </span>
                </Button>
              }
              value={longDescription}
              onChange={(e) => {
                setLongDescription(e.target.value);
                setShowPreview(false);
              }}
              required
              fullWidth
            />
            <Modal open={showPreview} onClose={() => setShowPreview(false)} maxWidth="720px">
              <div
                className="stack-xs"
                dangerouslySetInnerHTML={{ __html: markdownToHtml(longDescription) }}
              />
            </Modal>
          </Stack>
        </CardBody>
      </Card>
    );
  }

  // REGISTRATION
  function renderRegistrationForm() {
    return (
      <Card variant="outline">
        <CardHeader>
          <Inline align="center" justify="space-between" wrap>
            <Heading level={4}>Registration</Heading>
            <Pill size="sm" variant="accent">
              Step 2 of 4
            </Pill>
          </Inline>
        </CardHeader>
        <CardBody>
          {isTournament && (
            <Alert
              variant="info"
              message="Tournaments always enforce exact team size and do not allow late registration. Registration dates are required."
            />
          )}
          <FormLayout orientation="horizontal" gap="sm" columnWidths={['1fr', '1fr', '1fr']}>
            <FormField label="Allow registration after cutoff">
              <Checkbox
                label="Allow late registration"
                checked={allowLateRegistration}
                onChange={(e) => setAllowLateRegistration(e.target.checked)}
                disabled={isTournament}
              />
            </FormField>
            <FormField label="Registration opens">
              <Input
                type="date"
                value={registrationOpens}
                onChange={(e) => setRegistrationOpens(e.target.value)}
                placeholder="Defaults to start date"
                fullWidth
                required={isTournament}
              />
            </FormField>
            <FormField label="Registration closes">
              <Input
                type="date"
                value={registrationCutoff}
                onChange={(e) => setRegistrationCutoff(e.target.value)}
                placeholder="Defaults to end date"
                fullWidth
                required={isTournament}
              />
            </FormField>
          </FormLayout>
          <FormField label="Enforce exact team size">
            <Checkbox
              label="Exact team size required"
              checked={enforceExactTeamSize}
              onChange={(e) => setEnforceExactTeamSize(e.target.checked)}
              disabled={isTournament}
            />
          </FormField>
        </CardBody>
      </Card>
    );
  }

  // STAGE
  function renderStageForm() {
    const updateStage = (index: number, patch: Partial<StageForm>) => {
      setStages((prev) => prev.map((st, i) => (i === index ? { ...st, ...patch } : st)));
    };

    return (
      <StepCard title="Stage" stepLabel="Step 3 of 4">
        <Stack gap="md">
          {stages.map((stage, idx) => (
            <StageBlock
              key={idx}
              stage={stage}
              index={idx}
              parsedMaxTeams={parsedMaxTeams}
              updateStage={updateStage}
              seedingFormat={seedingFormat}
            />
          ))}
        </Stack>
      </StepCard>
    );
  }

  // TEMPLATES
  function renderTemplateForm() {
    return (
      <Card variant="outline">
        <CardHeader>
          <Inline align="center" justify="space-between" wrap>
            <Heading level={4}>Templates</Heading>
            <Pill size="sm" variant="accent">
              Step 4 of 4
            </Pill>
          </Inline>
        </CardHeader>
        <CardBody>
          <FormField label="Variant">
            <Input
              value={variant}
              onChange={(e) => setVariant(e.target.value)}
              required
              fullWidth
            />
          </FormField>
          <FormField label="Number of Games">
            <Input
              type="number"
              min={1}
              value={seedCount}
              onChange={(e) => setSeedCount(Number(e.target.value))}
              required
              fullWidth
            />
          </FormField>

          {/* <div className="stack-xs" style={{ position: 'relative' }}>
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
              className="material-symbols-outlined ui-icon-button"
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
          </div> */}

          <Input
            value={seedFormula}
            onChange={(e) => setSeedFormula(e.target.value)}
            placeholder="{eID}-{rID}-{i}"
            fullWidth
            required
            label="Seed Formula"
            helperText={
              formulaHasSpace
                ? 'Formula cannot contain spaces.'
                : formulaHasInvalidChars
                  ? 'Use only letters, numbers, { }, -, _, :, .'
                  : requiredTokensMissing.length > 0
                    ? `Missing required token${requiredTokensMissing.length > 1 ? 's' : ''}: ${requiredTokensMissing.join(', ')}`
                    : seedsHaveInvalidChars
                      ? 'Resolved seeds must be letters, numbers, or hyphens.'
                      : undefined
            }
            labelAction={
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="ui-icon-button"
                onClick={() => setShowFormulaHelp((prev) => !prev)}
                aria-label="Seed formula help"
                title="Seed formula help"
              >
                <span className="material-symbols-outlined" aria-hidden="true">
                  visibility
                </span>
              </Button>
            }
          />
          {invalidTokens.length > 0 && (
            <Alert
              variant="error"
              message={`${invalidTokens.join(', ')} ${invalidTokens.length > 1 ? 'are' : 'is'} not a valid token. Seed templates resolve into seeds made of letters, numbers, and hyphens only. If you intended a literal "{", you cannot use it—stick to letters, numbers, and hyphens. Click the info icon below for help building patterns.`}
            />
          )}
          {requiredTokensMissing.length > 0 && (
            <Alert
              variant="error"
              message={`Missing required token${requiredTokensMissing.length > 1 ? 's' : ''}: ${requiredTokensMissing.join(', ')}. Include ${isTournament ? '{eID}, {rID}, and {i}' : '{eID} and {i}'} in your pattern.`}
            />
          )}
          {duplicateSeedsError && <Alert variant="error" message={duplicateSeedsError} />}
          {seedsHaveInvalidChars && invalidTokens.length === 0 && (
            <Alert
              variant="warning"
              message="Resolved seeds must be letters, numbers, and hyphens only. Adjust your pattern or tokens."
            />
          )}

          <Modal open={showFormulaHelp} onClose={() => setShowFormulaHelp(false)} maxWidth="640px">
            <Stack gap="xs">
              <h2 className="text-lg font-semibold" style={{ margin: 0 }}>
                Seed formula
              </h2>
              <p>
                Use the tokens below to build a seed template formula for your event. Resolved seeds
                must contain only letters, numbers, and hyphens.
              </p>
              <ul className="text-sm text-gray-700" style={{ paddingLeft: '16px', margin: 0 }}>
                <li>{'{eID}'} = event abbreviation (required)</li>
                <li>{'{rID}'} = round identifier (required for tournaments)</li>
                <li>{'{i}'} = game index (required)</li>
                <li>
                  {'{0i}'}, {'{00i}'}, etc. = zero-padded index (zeros set the padding)
                </li>
                <li>
                  {'{hash}'} = random 3–5 digit token (per event/round) to discourage pre-play
                </li>
              </ul>
              <p className="text-sm text-gray-700" style={{ margin: 0 }}>
                Example: {'{eID}-{sID}-{00i}'} → NVT-RR-001
              </p>
            </Stack>
          </Modal>

          <p className="text-sm text-gray-600">Preview: {seedPreview.join(', ')}</p>
        </CardBody>
      </Card>
    );
  }

  const currentValid = stepValid(currentStep);
  const stepOrder: StepKey[] = steps.map((s) => s.key);
  const currentIndex = stepOrder.indexOf(currentStep);
  const onNext = () => {
    if (!currentValid) return;
    const next = stepOrder[currentIndex + 1];
    if (next) setCurrentStep(next);
  };
  const onPrev = () => {
    const prev = stepOrder[currentIndex - 1];
    if (prev) setCurrentStep(prev);
  };

  if (isUnauthorized) {
    return <Navigate to="/" replace />;
  }

  return (
    <main>
      <PageContainer>
        <Heading level={1}>{isEdit ? 'Edit Event' : 'Create Event'}</Heading>

        {message && <Alert variant="success" message={message} />}
        {error && <Alert variant="error" message={error} />}

        <Section paddingY="lg">
          {isEdit && loadingExisting && <Text variant="body">Loading event details...</Text>}
          {isEdit && loadingExisting ? null : (
            <Card>
              <form
                style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-md)' }}
                onSubmit={handleSubmit}
              >
                {renderNav()}

                {currentStep === 'event' && renderEventForm()}
                {currentStep === 'registration' && renderRegistrationForm()}
                {currentStep === 'stage' && renderStageForm()}
                {currentStep === 'templates' && renderTemplateForm()}

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
                      <Button variant="ghost" onClick={onPrev} disabled={saving}>
                        Previous
                      </Button>
                    )}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      gap: '12px',
                      alignItems: 'center',
                    }}
                  >
                    {currentStep === 'templates' && (
                      <Checkbox
                        label="Publish event"
                        checked={published}
                        onChange={(e) => setPublished(e.target.checked)}
                      />
                    )}
                    {currentStep !== 'templates' && (
                      <Button variant="primary" onClick={onNext} disabled={!currentValid || saving}>
                        Next
                      </Button>
                    )}
                    {currentStep === 'templates' && (
                      <Button
                        type="submit"
                        variant="primary"
                        disabled={!eventValid || !stageValid || !templatesValid || saving}
                      >
                        {saving ? 'Creating…' : 'Create Event'}
                      </Button>
                    )}
                  </div>
                </div>
              </form>
            </Card>
          )}
        </Section>
      </PageContainer>
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

function getStageAbbrForSeeds(
  stage: StageForm | undefined,
  eventAbbr: string,
  maxTeams: number | null,
) {
  if (stage?.abbr?.trim()) return stage.abbr.trim();
  if (stage?.stageType === 'BRACKET' && maxTeams) return `${eventAbbr}-BRK`;
  return eventAbbr;
}

function getRoundIdForStage(stage: StageForm | undefined, idx: number) {
  if (!stage) return 'STG';
  if (stage.stageType === 'BRACKET') return `R${idx + 1}`;
  if (stage.stageType === 'ROUND_ROBIN') return 'RR';
  if (stage.stageType === 'GAUNTLET') return 'G';
  return 'C';
}

function buildSeedsFromFormula(
  formula: string,
  eventAbbr: string,
  stageAbbr: string,
  roundId: string,
  count: number,
  hashToken?: string,
) {
  const seeds: string[] = [];
  const safeFormula = formula.trim() || '{eID}-{sID}-{i}';
  const resolvedHash = hashToken ?? generateHashToken();
  for (let idx = 1; idx <= count; idx += 1) {
    let seed = safeFormula;
    seed = seed.replace(/\{eID\}/g, eventAbbr || 'EVT');
    seed = seed.replace(/\{sID\}/g, stageAbbr || 'STG');
    seed = seed.replace(/\{rID\}/g, roundId || 'R1');
    seed = seed.replace(/\{hash\}/g, resolvedHash);
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

  const emojiExpanded = replaceEmojiShortcodes(md || '');
  let html = escape(emojiExpanded);

  html = html.replace(/^### (.*)$/gm, '<h4>$1</h4>');
  html = html.replace(/^## (.*)$/gm, '<h3>$1</h3>');
  html = html.replace(/^# (.*)$/gm, '<h2>$1</h2>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/`(.+?)`/g, '<code>$1</code>');

  // Simple lists
  html = html.replace(/(^|\n)- (.*)/g, (_match, p1, item) => `${p1}<li>${item}</li>`);
  html = html.replace(/(<li>.*<\/li>)/gs, (match) => `<ul>${match}</ul>`);

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

function generateHashToken() {
  const len = 3 + Math.floor(Math.random() * 3); // 3-5 digits
  const min = 10 ** (len - 1);
  const max = 10 ** len - 1;
  const n = min + Math.floor(Math.random() * (max - min + 1));
  return String(n);
}
