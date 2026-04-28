import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { AppShell, Burger, Group, NavLink as MantineNavLink, useMantineColorScheme, ActionIcon, Anchor } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';

export function AppLayout() {
  const [opened, { toggle }] = useDisclosure();
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();

  return (
    <AppShell
      header={{ height: 56 }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Group gap="xs">
              <MantineNavLink component={NavLink} to="/admin/events" label="Events" />
              <MantineNavLink component={NavLink} to="/profile/awards" label="Awards" />
            </Group>
          </Group>
          <Group gap="sm">
            <Anchor
              href="/reference"
              target="_blank"
              rel="noopener noreferrer"
              size="sm"
              fw={500}
            >
              Reference
            </Anchor>
            <ActionIcon
              variant="default"
              onClick={() => toggleColorScheme()}
              title="Toggle color scheme"
              aria-label="Toggle color scheme"
            >
              {colorScheme === 'dark' ? '☀' : '☾'}
            </ActionIcon>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
