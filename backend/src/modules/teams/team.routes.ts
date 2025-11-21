// src/modules/teams/team.routes.ts
import { Router, Request, Response } from 'express';
import {
  listTeamMembers,
  createTeam,
  addTeamMember,
  listMemberCandidates,
  TeamRole,
} from './team.service';
import { authRequired, AuthenticatedRequest } from '../../middleware/authMiddleware';

const router = Router();

// GET /api/teams/:id/members
router.get('/:id/members', async (req: Request, res: Response) => {
  const teamId = Number(req.params.id);

  if (Number.isNaN(teamId)) {
    res.status(400).json({ error: 'Invalid team id' });
    return;
  }

  try {
    const members = await listTeamMembers(teamId);
    res.json(members);
  } catch (err) {
    console.error('Error fetching team members:', err);
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
});

// POST /api/teams (auth required)
router.post('/', authRequired, async (req: AuthenticatedRequest, res: Response) => {
  const { challenge_id, name, team_size } = req.body;

  if (!challenge_id || !name || team_size == null) {
    res.status(400).json({
      error: 'challenge_id, name, and team_size are required',
    });
    return;
  }

  const parsedTeamSize = Number(team_size);
  if (!Number.isInteger(parsedTeamSize) || parsedTeamSize < 2 || parsedTeamSize > 6) {
    res.status(400).json({
      error: 'team_size must be an integer between 2 and 6',
    });
    return;
  }

  try {
    const team = await createTeam({
      challenge_id,
      name,
      team_size: parsedTeamSize,
    });

    res.status(201).json(team);
  } catch (err) {
    if (err.code === 'TEAM_CREATE_CONFLICT') {
      res.status(409).json({
        error: 'Team name must be unique within the challenge',
      });
      return;
    }

    console.error('Error creating team:', err);
    res.status(500).json({ error: 'Failed to create team' });
  }
});

// POST /api/teams/:id/members (auth required)
router.post('/:id/members', authRequired, async (req: Request, res: Response) => {
  const teamId = Number(req.params.id);
  const { user_id, role, is_listed = true } = req.body;

  if (Number.isNaN(teamId)) {
    res.status(400).json({ error: 'Invalid team id' });
    return;
  }

  if (!user_id || !role) {
    res.status(400).json({
      error: 'user_id and role are required (PLAYER or STAFF)',
    });
    return;
  }

  if (role !== 'PLAYER' && role !== 'STAFF') {
    res.status(400).json({
      error: "role must be either 'PLAYER' or 'STAFF'",
    });
    return;
  }

  try {
    const member = await addTeamMember({
      team_id: teamId,
      user_id,
      role: role as TeamRole,
      is_listed,
    });

    res.status(201).json(member);
  } catch (err) {
    if (err.code === 'TEAM_MEMBER_EXISTS') {
      res.status(409).json({
        error: 'This user already has this role on the team',
      });
      return;
    }

    console.error('Error adding team member:', err);
    res.status(500).json({ error: 'Failed to add team member' });
  }
});

// GET /api/teams/:id/member-candidates (auth required)
router.get('/:id/member-candidates', authRequired, async (req: Request, res: Response) => {
  const teamId = Number(req.params.id);
  const queryParam = (req.query.query as string) || '';

  if (Number.isNaN(teamId)) {
    res.status(400).json({ error: 'Invalid team id' });
    return;
  }

  try {
    const candidates = await listMemberCandidates(teamId, queryParam);
    res.json(candidates);
  } catch (err) {
    console.error('Error searching member candidates:', err);
    res.status(500).json({ error: 'Failed to search member candidates' });
  }
});

export default router;
