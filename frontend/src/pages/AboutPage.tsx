import { Link } from 'react-router-dom';
import { Heading, PageContainer, Prose, Section, Stack } from '../design-system';

export function AboutPage() {
  return (
    <main>
      <PageContainer>
        <Heading level={1}>About Hanabi Challenges</Heading>
        <Section paddingY="lg">
          <Stack gap="lg">
            <Prose>
              <p>
                Hanabi Challenges is a home for organized play. We publish shared seed sets, collect
                results, and surface stats so every team—new or veteran—can compete on equal
                footing. The focus is clarity: straightforward formats, predictable timelines, and
                transparent scoring.
              </p>
            </Prose>

            <Stack as="section" gap="sm">
              <Heading level={3}>How it works</Heading>
              <Prose>
                <ul>
                  <li>Browse events to see formats, timelines, and seed details.</li>
                  <li>
                    Register your team, choose the right size, and set a table password if needed.
                  </li>
                  <li>
                    Play through the shared seeds, upload replays, and watch your progress update
                    live.
                  </li>
                  <li>Review standings and stage stats once events lock or complete.</li>
                </ul>
              </Prose>
            </Stack>

            <Stack as="section" gap="sm">
              <Heading level={3}>Who’s behind it</Heading>
              <Prose>
                <p>
                  We are Hanabi players building tools we wished existed: faster registration,
                  cleaner scorekeeping, and more reliable archives. Feedback drives our roadmap—if
                  something feels clunky or missing, let us know.
                </p>
              </Prose>
            </Stack>

            <Stack as="section" gap="sm">
              <Heading level={3}>What’s next</Heading>
              <Prose>
                <ul>
                  <li>Tournaments and multi-stage brackets alongside seasonal challenges.</li>
                  <li>Deeper stats, historical archives, and richer leaderboards.</li>
                  <li>Better replay validation and smoother team management workflows.</li>
                </ul>
              </Prose>
            </Stack>

            <Stack as="section" gap="sm">
              <Heading level={3}>FAQ</Heading>
              <Prose>
                <p>
                  Have questions? Visit the <Link to="/about/FAQ">FAQ page</Link> or reach out so we
                  can add what you need.
                </p>
              </Prose>
            </Stack>
          </Stack>
        </Section>
      </PageContainer>
    </main>
  );
}
