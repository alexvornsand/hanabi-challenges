import { Link } from 'react-router-dom';
import { Heading, PageContainer, Prose, Section, Stack } from '../design-system';

export const AboutFAQPage: React.FC = () => {
  return (
    <main>
      <PageContainer>
        <Heading level={1}>FAQ</Heading>
        <Section paddingY="lg">
          <Stack gap="lg">
            <Stack as="section" gap="xs">
              <Heading level={3}>How do I register a team?</Heading>
              <Prose>
                <p>
                  Open an <Link to="/events">event</Link> page and click &quot;Register a
                  Team.&quot; Pick a team size, add your teammates, and submit. For challenges,
                  everyone will play the same preset seeds.
                </p>
              </Prose>
            </Stack>

            <Stack as="section" gap="xs">
              <Heading level={3}>Can I join after an event starts?</Heading>
              <Prose>
                <p>
                  Some events allow late registration. If registration is closed, the button will be
                  disabled and show a tooltip explaining why.
                </p>
              </Prose>
            </Stack>

            <Stack as="section" gap="xs">
              <Heading level={3}>How are replays used?</Heading>
              <Prose>
                <p>
                  Replays help validate that your team played the correct seed with the right
                  players. Paste a hanab.live replay link on your team page when logging a game.
                </p>
              </Prose>
            </Stack>

            <Stack as="section" gap="xs">
              <Heading level={3}>Where can I report issues or give feedback?</Heading>
              <Prose>
                <p>
                  Please reach out via the community channels or open an issue on our repository. We
                  iterate quickly and appreciate reports and ideas.
                </p>
              </Prose>
            </Stack>

            <Prose>
              <p>
                More questions? Head back to the <Link to="/about">About</Link> page or contact us.
              </p>
            </Prose>
          </Stack>
        </Section>
      </PageContainer>
    </main>
  );
};
