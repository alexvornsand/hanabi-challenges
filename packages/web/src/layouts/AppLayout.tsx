import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { AppShell, Burger, Group, NavLink as MantineNavLink, useMantineColorScheme, ActionIcon } from '@mantine/core';
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
          <ActionIcon
            variant="default"
            onClick={() => toggleColorScheme()}
            title="Toggle color scheme"
            aria-label="Toggle color scheme"
          >
            {colorScheme === 'dark' ? '☀' : '☾'}
          </ActionIcon>
        </Group>
      </AppShell.Header>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
