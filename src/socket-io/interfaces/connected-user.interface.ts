import { RoleUtilisateur } from 'src/generated/prisma/enums';

export interface ConnectedUser {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  role: RoleUtilisateur | string;
  departementId?: string | null;
  socketId: string;
}

/**
 * Channels (events) émis par le serveur — source unique de vérité.
 * Le frontend doit s'abonner à ces noms exacts.
 */
export const SOCKET_EVENTS = {
  // Notifications in-app
  NOTIFICATION_NEW: 'notification:new',
  NOTIFICATION_READ: 'notification:read',

  // Audits / missions
  AUDIT_CREATED: 'audit:created',
  AUDIT_UPDATED: 'audit:updated',
  AUDIT_STATUS_CHANGED: 'audit:status-changed',
  AUDIT_TEAM_UPDATED: 'audit:team-updated',
  AUDIT_DELETED: 'audit:deleted',

  // Points d'audit
  POINT_CREATED: 'point:created',
  POINT_UPDATED: 'point:updated',
  POINT_STATUS_CHANGED: 'point:status-changed',
  POINT_STATUS_BU_CHANGED: 'point:status-bu-changed',
  POINT_DELETED: 'point:deleted',

  // Actions correctives
  ACTION_CREATED: 'action:created',
  ACTION_UPDATED: 'action:updated',
  ACTION_DELETED: 'action:deleted',

  // Formulaires RAF
  RAF_CREATED: 'raf:created',
  RAF_APPROVED: 'raf:approved',
  RAF_VALIDATED: 'raf:validated', // validation finale Comité
  RAF_DELETED: 'raf:deleted',

  // Commentaires
  COMMENT_CREATED: 'comment:created',
  COMMENT_DELETED: 'comment:deleted',

  // Journal d'audit (live)
  JOURNAL_ENTRY: 'journal:entry',

  // Dashboard / KPIs
  DASHBOARD_STATS_CHANGED: 'dashboard:stats-changed',

  // Système
  PING: 'ping',
  PONG: 'pong',
} as const;

export type SocketEventName = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];
