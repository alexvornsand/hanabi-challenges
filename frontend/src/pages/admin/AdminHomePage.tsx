import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button, Heading, Inline, PageContainer, Section, Stack } from '../../design-system';

export function AdminHomePage() {
  const { user } = useAuth();

  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN')) {
    return <Navigate to="/" replace />;
  }

  return (
    <main>
      <PageContainer>
        <Heading level={1}>Admin</Heading>
        <Section paddingY="lg">
          <Stack gap="md">
            <Inline gap="sm" wrap>
              <Button as={Link} to="/admin/create-event" variant="primary" size="md">
                Create event
              </Button>
              {user.role === 'SUPERADMIN' && (
                <Button as={Link} to="/admin/manage-users" variant="primary" size="md">
                  Manage users
                </Button>
              )}
            </Inline>
          </Stack>
        </Section>
      </PageContainer>
    </main>
  );
}
