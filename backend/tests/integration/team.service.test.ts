import { describe, it, expect, beforeEach } from 'vitest';
import { pool } from '../../src/config/db';
import {
  listTeamMembers,
  createTeamWithCreator,
  addTeamMember,
  listMemberCandidates,
  TeamRole,
} from '../../src/modules/teams/team.service';

interface TeamServiceErrorShape {
  code: string;
}

describe('team.service (integration)', () => {
  beforeEach(async () => {
    await pool.query(
      `
      TRUNCATE
        game_participants,
        games,
        challenge_seeds,
        team_memberships,
        teams,
        challenges,
        users
      RESTART IDENTITY CASCADE;
      `,
    );
  });

  async function seedUsers() {
    const res = await pool.query(
      `
      INSERT INTO users (display_name, password_hash, role)
      VALUES 
        ('alice', 'dummy-hash', 'USER'),
        ('bob',   'dummy-hash', 'USER'),
        ('carol', 'dummy-hash', 'USER'),
        ('dave',  'dummy-hash', 'USER'),
        ('erin',  'dummy-hash', 'USER'),
        ('frank', 'dummy-hash', 'USER'),
        ('grace', 'dummy-hash', 'USER')
      RETURNING id, display_name;
      `,
    );

    const map = new Map<string, number>();
    for (const row of res.rows) {
      map.set(row.display_name as string, row.id as number);
    }
    return map;
  }

  async function seedChallengeAndTeam(teamName: string) {
    const challengeRes = await pool.query(
      `
      INSERT INTO challenges (name, slug, short_description, long_description)
      VALUES ($1, $2, $3, $4)
      RETURNING id;
      `,
      [
        'Team Test Challenge',
        'team-test-challenge',
        'short desc',
        'long description for team tests',
      ],
    );
    const challengeId = challengeRes.rows[0].id as number;

    const teamRes = await pool.query(
      `
      INSERT INTO teams (name, challenge_id, team_size)
      VALUES ($1, $2, 3)
      RETURNING id, name, challenge_id;
      `,
      [teamName, challengeId],
    );

    return {
      challengeId,
      teamId: teamRes.rows[0].id as number,
    };
  }

  it('listTeamMembers returns expected members for a seeded team', async () => {
    const userIds = await seedUsers();
    const { teamId } = await seedChallengeAndTeam('Lanterns');

    const aliceId = userIds.get('alice')!;
    const bobId = userIds.get('bob')!;
    const carolId = userIds.get('carol')!;
    const daveId = userIds.get('dave')!;

    await pool.query(
      `
      INSERT INTO team_memberships (team_id, user_id, role, is_listed)
      VALUES 
        ($1, $2, 'STAFF',  true),
        ($1, $3, 'PLAYER', true),
        ($1, $4, 'PLAYER', true),
        ($1, $5, 'PLAYER', true);
      `,
      [teamId, aliceId, bobId, carolId, daveId],
    );

    const members = await listTeamMembers(teamId);

    expect(members.length).toBe(4);

    const names = members.map((m) => m.display_name).sort();
    expect(names).toEqual(['alice', 'bob', 'carol', 'dave'].sort());
  });

  it('createTeamWithCreator creates a team and STAFF membership', async () => {
    const userIds = await seedUsers();

    const challengeRes = await pool.query(
      `
      INSERT INTO challenges (name, slug, short_description, long_description)
      VALUES ($1, $2, $3, $4)
      RETURNING id;
      `,
      [
        'Create Team Challenge',
        'create-team-challenge',
        'short desc',
        'long description for create team test',
      ],
    );
    const challengeId = challengeRes.rows[0].id as number;

    const bobId = userIds.get('bob')!;
    const TEST_TEAM_NAME = 'Unit Test Team';

    const team = await createTeamWithCreator({
      challenge_id: challengeId,
      name: TEST_TEAM_NAME,
      team_size: 3,
      creator_user_id: bobId,
    });

    expect(team.id).toBeGreaterThan(0);
    expect(team.name).toBe(TEST_TEAM_NAME);
    expect(team.challenge_id).toBe(challengeId);
    expect(team.team_size).toBe(3);

    const membershipRes = await pool.query(
      `
      SELECT role
      FROM team_memberships
      WHERE team_id = $1 AND user_id = $2
      `,
      [team.id, bobId],
    );

    expect(membershipRes.rowCount).toBe(1);
    expect(membershipRes.rows[0].role).toBe('STAFF');
  });

  it('addTeamMember adds a member and rejects duplicate roles', async () => {
    const userIds = await seedUsers();

    const challengeRes = await pool.query(
      `
      INSERT INTO challenges (name, slug, short_description, long_description)
      VALUES ($1, $2, $3, $4)
      RETURNING id;
      `,
      [
        'Add Member Challenge',
        'add-member-challenge',
        'short desc',
        'long description for add member test',
      ],
    );
    const challengeId = challengeRes.rows[0].id as number;

    const bobId = userIds.get('bob')!;
    const carolId = userIds.get('carol')!;

    const team = await createTeamWithCreator({
      challenge_id: challengeId,
      name: 'Member Test Team',
      team_size: 3,
      creator_user_id: bobId,
    });

    const member = await addTeamMember({
      team_id: team.id,
      user_id: carolId,
      role: 'PLAYER' as TeamRole,
      is_listed: true,
    });

    expect(member.team_id).toBe(team.id);
    expect(member.user_id).toBe(carolId);
    expect(member.role).toBe('PLAYER');
    expect(member.display_name).toBe('carol');

    const expectedError: TeamServiceErrorShape = {
      code: 'TEAM_MEMBER_EXISTS',
    };

    await expect(
      addTeamMember({
        team_id: team.id,
        user_id: carolId,
        role: 'PLAYER' as TeamRole,
        is_listed: true,
      }),
    ).rejects.toMatchObject(expectedError);
  });

  it('listMemberCandidates returns users not on the team and respects prefix search', async () => {
    const userIds = await seedUsers();
    const { teamId } = await seedChallengeAndTeam('Lanterns');

    const aliceId = userIds.get('alice')!;
    const bobId = userIds.get('bob')!;
    const carolId = userIds.get('carol')!;
    const daveId = userIds.get('dave')!;

    await pool.query(
      `
      INSERT INTO team_memberships (team_id, user_id, role, is_listed)
      VALUES
        ($1, $2, 'STAFF',  true),
        ($1, $3, 'PLAYER', true),
        ($1, $4, 'PLAYER', true),
        ($1, $5, 'PLAYER', true);
      `,
      [teamId, aliceId, bobId, carolId, daveId],
    );

    const allCandidates = await listMemberCandidates(teamId, null);
    const allNames = allCandidates.map((c) => c.display_name).sort();

    expect(allNames).toEqual(['erin', 'frank', 'grace'].sort());

    const eCandidates = await listMemberCandidates(teamId, 'e');
    const eNames = eCandidates.map((c) => c.display_name).sort();
    expect(eNames).toEqual(['erin']);
  });
});
