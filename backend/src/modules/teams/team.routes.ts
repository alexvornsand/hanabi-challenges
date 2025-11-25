// src/modules/teams/team.routes.ts
import { Router, Request, Response } from 'express';
import {
  listTeamMembers,
  createEventTeam,
  addTeamMember,
  listMemberCandidates,
  TeamRole,
  getEventTeamDetail,
  listTeamGames,
  listTeamTemplatesWithResults,
  hasUserPlayedOnTeam,
  hasTeamGames,
  removeTeamMember,
  deleteEventTeam,
} from './team.service';
import { authRequired, AuthenticatedRequest } from '../../middleware/authMiddleware';

const router = Router();

// GET /api/event-teams/:id
router.get('/:id', async (req: Request, res: Response) => {
  const eventTeamId = Number(req.params.id);

  if (Number.isNaN(eventTeamId)) {
    res.status(400).json({ error: 'Invalid event team id' });
    return;
  }

  try {
    const team = await getEventTeamDetail(eventTeamId);
    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    const [members, games] = await Promise.all([
      listTeamMembers(eventTeamId),
      listTeamGames(eventTeamId),
    ]);

    res.json({ team, members, games });
  } catch (err) {
    console.error('Error fetching team detail:', err);
    res.status(500).json({ error: 'Failed to fetch team detail' });
  }
});

// GET /api/event-teams/:id/templates
router.get('/:id/templates', async (req: Request, res: Response) => {
  const eventTeamId = Number(req.params.id);

  if (Number.isNaN(eventTeamId)) {
    res.status(400).json({ error: 'Invalid event team id' });
    return;
  }

  try {
    const team = await getEventTeamDetail(eventTeamId);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const templates = await listTeamTemplatesWithResults(eventTeamId);
    console.log('[team:templates]', {
      teamId: eventTeamId,
      templates: templates.map((t) => ({
        template_id: t.template_id,
        result_id: t.result?.id ?? null,
        players: t.result?.players ?? [],
      })),
    });
    res.json({ team, templates });
  } catch (err) {
    console.error('Error fetching team templates:', err);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// GET /api/event-teams/:id/members
router.get('/:id/members', async (req: Request, res: Response) => {
  const eventTeamId = Number(req.params.id);

  if (Number.isNaN(eventTeamId)) {
    res.status(400).json({ error: 'Invalid event team id' });
    return;
  }

  try {
    const members = await listTeamMembers(eventTeamId);
    res.json(members);
  } catch (err) {
    console.error('Error fetching team members:', err);
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
});

// POST /api/event-teams (auth required)
router.post('/', authRequired, async (req: AuthenticatedRequest, res: Response) => {
  const { event_id, name, team_size } = req.body;
  const requester = req.user;

  if (!event_id || !name || team_size == null) {
    res.status(400).json({
      error: 'event_id, name, and team_size are required',
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
    const team = await createEventTeam({
      event_id,
      name,
      team_size: parsedTeamSize,
      owner_user_id: requester?.userId ?? null,
    });

    res.status(201).json(team);
  } catch (err) {
    if (err.code === 'TEAM_CREATE_CONFLICT') {
      res.status(409).json({
        error: 'Team name must be unique within the event',
      });
      return;
    }

    console.error('Error creating team:', err);
    res.status(500).json({ error: 'Failed to create team' });
  }
});

// POST /api/event-teams/:id/members (auth required)
router.post('/:id/members', authRequired, async (req: AuthenticatedRequest, res: Response) => {
  const eventTeamId = Number(req.params.id);
  const { user_id, role, is_listed = true } = req.body;
  const requester = req.user;

  if (Number.isNaN(eventTeamId)) {
    res.status(400).json({ error: 'Invalid event team id' });
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
    const team = await getEventTeamDetail(eventTeamId);
    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    const isOwner = requester && team.owner_user_id != null && team.owner_user_id === requester.userId;
    const isAdmin = requester && (requester.role === 'ADMIN' || requester.role === 'SUPERADMIN');
    if (!isOwner && !isAdmin) {
      res.status(403).json({ error: 'Only the team owner or an admin can add members' });
      return;
    }

    const member = await addTeamMember({
      event_team_id: eventTeamId,
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

// DELETE /api/event-teams/:id/members/:userId (auth required)
router.delete(
  '/:id/members/:userId',
  authRequired,
  async (req: AuthenticatedRequest, res: Response) => {
    const eventTeamId = Number(req.params.id);
    const targetUserId = Number(req.params.userId);

    if (Number.isNaN(eventTeamId) || Number.isNaN(targetUserId)) {
      res.status(400).json({ error: 'Invalid id' });
      return;
    }

    try {
      const team = await getEventTeamDetail(eventTeamId);
      if (!team) {
        res.status(404).json({ error: 'Team not found' });
        return;
      }
      const requester = req.user;
      if (!requester) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const isSelf = requester.userId === targetUserId;
      const isOwner =
        team.owner_user_id != null && requester.userId === team.owner_user_id;
      const isAdmin = requester.role === 'ADMIN' || requester.role === 'SUPERADMIN';
      if (!isSelf && !isOwner && !isAdmin) {
        res.status(403).json({ error: 'Not authorized to remove this member' });
        return;
      }

      const alreadyPlayed = await hasUserPlayedOnTeam(eventTeamId, targetUserId);
      if (alreadyPlayed) {
        res
          .status(409)
          .json({ error: 'This member has recorded games and cannot be removed.' });
        return;
      }

      const removed = await removeTeamMember(eventTeamId, targetUserId);
      if (!removed) {
        res.status(404).json({ error: 'Member not found on team' });
        return;
      }
      res.status(204).end();
    } catch (err) {
      console.error('Error removing team member:', err);
      res.status(500).json({ error: 'Failed to remove team member' });
    }
  },
);

// DELETE /api/event-teams/:id (owner/admin, only if no games)
router.delete('/:id', authRequired, async (req: AuthenticatedRequest, res: Response) => {
  const eventTeamId = Number(req.params.id);
  if (Number.isNaN(eventTeamId)) {
    res.status(400).json({ error: 'Invalid event team id' });
    return;
  }

  const requester = req.user;
  if (!requester) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  try {
    const team = await getEventTeamDetail(eventTeamId);
    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }
    const isOwner = team.owner_user_id != null && requester.userId === team.owner_user_id;
    const isAdmin = requester.role === 'ADMIN' || requester.role === 'SUPERADMIN';
    if (!isOwner && !isAdmin) {
      res.status(403).json({ error: 'Only the team owner or an admin can delete this team' });
      return;
    }

    const hasGames = await hasTeamGames(eventTeamId);
    if (hasGames) {
      res.status(409).json({ error: 'Team has recorded games and cannot be deleted' });
      return;
    }

    const deleted = await deleteEventTeam(eventTeamId);
    if (!deleted) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }
    res.status(204).end();
  } catch (err) {
    console.error('Error deleting team:', err);
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

// GET /api/event-teams/:id/member-candidates (auth required)
router.get('/:id/member-candidates', authRequired, async (req: Request, res: Response) => {
  const eventTeamId = Number(req.params.id);
  const queryParam = (req.query.query as string) || '';

  if (Number.isNaN(eventTeamId)) {
    res.status(400).json({ error: 'Invalid event team id' });
    return;
  }

  try {
    const candidates = await listMemberCandidates(eventTeamId, queryParam);
    res.json(candidates);
  } catch (err) {
    console.error('Error searching member candidates:', err);
    res.status(500).json({ error: 'Failed to search member candidates' });
  }
});

export default router;
