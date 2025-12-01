import { Link } from 'react-router-dom';
import {
  Button,
  Card,
  CardBody,
  Heading,
  PageContainer,
  Section,
  Stack,
  Text,
} from '../design-system';

export function NotFoundPage() {
  return (
    <main>
      <PageContainer variant="narrow">
        <Section paddingY="lg">
          <Card variant="outline">
            <CardBody>
              <Stack gap="sm">
                <Heading level={1}>404 – Page Not Found</Heading>
                <Text variant="muted">The page you’re looking for doesn’t exist.</Text>
                <Button as={Link} to="/" variant="primary">
                  Return home
                </Button>
              </Stack>
            </CardBody>
          </Card>
        </Section>
      </PageContainer>
    </main>
  );
}
