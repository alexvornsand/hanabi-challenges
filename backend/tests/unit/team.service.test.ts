// backend/tests/unit/team.service.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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

describe('team.service', () => {
  const TEST_TEAM_NAME = 'Unit Test Team';
  let testTeamId: number | null = null;

  beforeAll(async () => {
    // Clean up any leftover test team & memberships
    const res = await pool.query('SELECT id FROM teams WHERE name = $1', [TEST_TEAM_NAME]);
    if (res.rowCount > 0) {
      const id = res.rows[0].id;
      await pool.query('DELETE FROM team_memberships WHERE team_id = $1', [id]);
      await pool.query('DELETE FROM team_enrollments WHERE team_id = $1', [id]);
      await pool.query('DELETE FROM teams WHERE id = $1', [id]);
    }
  });

  afterAll(async () => {
    if (testTeamId != null) {
      await pool.query('DELETE FROM team_memberships WHERE team_id = $1', [testTeamId]);
      await pool.query('DELETE FROM team_enrollments WHERE team_id = $1', [testTeamId]);
      await pool.query('DELETE FROM teams WHERE id = $1', [testTeamId]);
    }
  });

  it('listTeamMembers returns expected members for Lanterns (team 1)', async () => {
    const members = await listTeamMembers(1);

    expect(members.length).toBe(4); // alice (manager), bob, carol, dave

    const names = members.map((m) => m.display_name).sort();
    expect(names).toEqual(['alice', 'bob', 'carol', 'dave'].sort());
  });

  it('createTeamWithCreator creates a team and MANAGER membership', async () => {
    // Use challenge 1, created_by_user_id = bob (2)
    const team = await createTeamWithCreator({
      challenge_id: 1,
      name: TEST_TEAM_NAME,
      created_by_user_id: 2,
    });

    testTeamId = team.id;

    expect(team.id).toBeGreaterThan(0);
    expect(team.name).toBe(TEST_TEAM_NAME);
    expect(team.challenge_id).toBe(1);
    expect(team.created_by_user_id).toBe(2);

    const membershipRes = await pool.query(
      `
      SELECT role
      FROM team_memberships
      WHERE team_id = $1 AND user_id = $2
      `,
      [team.id, 2],
    );

    expect(membershipRes.rowCount).toBe(1);
    expect(membershipRes.rows[0].role).toBe('MANAGER');
  });

  it('addTeamMember adds a member and rejects duplicate roles', async () => {
    if (!testTeamId) {
      throw new Error('Test team not created');
    }

    // Add carol (3) as PLAYER to test team
    const member = await addTeamMember({
      team_id: testTeamId,
      user_id: 3,
      role: 'PLAYER' as TeamRole,
      is_listed: true,
    });

    expect(member.team_id).toBe(testTeamId);
    expect(member.user_id).toBe(3);
    expect(member.role).toBe('PLAYER');
    expect(member.display_name).toBe('carol');

    // Adding the same user with the same role again should fail
    const expectedError: TeamServiceErrorShape = {
      code: 'TEAM_MEMBER_EXISTS',
    };

    await expect(
      addTeamMember({
        team_id: testTeamId,
        user_id: 3,
        role: 'PLAYER' as TeamRole,
        is_listed: true,
      }),
    ).rejects.toMatchObject(expectedError);
  });

  it('listMemberCandidates returns users not on the team and respects prefix search', async () => {
    // For Lanterns (team 1), members are: alice(1), bob(2), carol(3), dave(4)
    const allCandidates = await listMemberCandidates(1, null);

    const allNames = allCandidates.map((c) => c.display_name).sort();
    // From sample_data: users are alice, bob, carol, dave, erin, frank, grace
    // Candidates should include erin, frank, grace but not the existing members
    expect(allNames).toEqual(['erin', 'frank', 'grace'].sort());

    // Prefix search: "e" should only return erin
    const eCandidates = await listMemberCandidates(1, 'e');
    const eNames = eCandidates.map((c) => c.display_name);
    expect(eNames).toEqual(['erin']);
  });
});
