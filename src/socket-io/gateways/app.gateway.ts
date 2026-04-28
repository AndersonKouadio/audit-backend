import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { StatutUtilisateur } from 'src/generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  ConnectedUser,
  SOCKET_EVENTS,
  SocketEventName,
} from '../interfaces/connected-user.interface';

interface CachedUser {
  data: ConnectedUser;
  expiresAt: number;
}

/**
 * Gateway Socket.io central pour les événements temps réel d'audit-apps.
 *
 * Auth : JWT passé dans handshake.query.token (compatible avec le pattern
 * chicken-nation : socket.io-client envoie ?token=...&type=user)
 *
 * Rooms automatiques par utilisateur connecté :
 *   - user_<id>            : événements personnels
 *   - dept_<departementId> : événements du département (BU)
 *   - role_<RoleEnum>      : tous les users d'un rôle (ex: tous les MANAGER_METIER)
 *   - audit_team           : toute l'équipe d'audit interne
 *   - admins               : ADMIN + DIRECTEUR_AUDIT (vue globale)
 *   - all                  : tous les utilisateurs connectés
 */
@WebSocketGateway({
  cors: { origin: true, credentials: true },
  namespace: '/audit',
})
export class AppGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(AppGateway.name);

  @WebSocketServer()
  server: Server;

  // socketId -> ConnectedUser
  private connectedUsers = new Map<string, ConnectedUser>();

  // Cache d'auth pour éviter de spammer la DB en cas de reconnexions répétées
  private authCache = new Map<string, CachedUser>();
  private readonly CACHE_TTL_MS = 10_000;
  private readonly CACHE_MAX_SIZE = 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ════════════════════════════════════════════════════════════════════════
  // CONNEXION / DECONNEXION
  // ════════════════════════════════════════════════════════════════════════

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.query.token as string) ||
        (client.handshake.auth?.token as string) ||
        '';

      if (!token) {
        client.disconnect();
        return;
      }

      // Vérification JWT
      let decoded: { sub: string; role: string };
      try {
        decoded = await this.jwtService.verifyAsync(token, {
          secret: this.config.get<string>('JWT_SECRET'),
        });
      } catch {
        client.disconnect();
        return;
      }

      const userInfo = await this.identifyUser(decoded.sub);
      if (!userInfo) {
        client.disconnect();
        return;
      }

      this.connectedUsers.set(client.id, {
        ...userInfo,
        socketId: client.id,
      });

      await this.joinRooms(client, userInfo);

      this.logger.log(
        `🔌 ${userInfo.role} connecté : ${userInfo.email} (socket ${client.id.slice(0, 8)})`,
      );

      // Notifier le client de la connexion réussie
      client.emit('connected', {
        userId: userInfo.id,
        role: userInfo.role,
      });
    } catch (err) {
      this.logger.error(`Erreur de connexion socket: ${(err as Error).message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const user = this.connectedUsers.get(client.id);
    if (user) {
      this.logger.log(
        `🔌 ${user.role} déconnecté : ${user.email} (socket ${client.id.slice(0, 8)})`,
      );
      this.connectedUsers.delete(client.id);
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // AUTH UTILISATEUR
  // ════════════════════════════════════════════════════════════════════════

  private async identifyUser(userId: string): Promise<ConnectedUser | null> {
    if (!userId) return null;

    // 1. Cache hit ?
    const now = Date.now();
    const cached = this.authCache.get(userId);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }
    if (cached) this.authCache.delete(userId);

    // 2. DB
    let user;
    try {
      user = await this.prisma.utilisateur.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          nom: true,
          prenom: true,
          role: true,
          statut: true,
          departementId: true,
        },
      });
    } catch (err) {
      this.logger.error(`DB error in identifyUser: ${(err as Error).message}`);
      return null;
    }

    if (!user || user.statut !== StatutUtilisateur.ACTIF) {
      return null;
    }

    const result: ConnectedUser = {
      id: user.id,
      email: user.email,
      nom: user.nom,
      prenom: user.prenom,
      role: user.role,
      departementId: user.departementId,
      socketId: '',
    };

    // 3. Cache write + LRU
    this.authCache.set(userId, {
      data: result,
      expiresAt: now + this.CACHE_TTL_MS,
    });
    if (this.authCache.size > this.CACHE_MAX_SIZE) {
      this.evictCache(now);
    }

    return result;
  }

  private evictCache(now: number) {
    // Phase 1 : entrées expirées
    for (const [k, v] of this.authCache) {
      if (v.expiresAt <= now) this.authCache.delete(k);
    }
    // Phase 2 : encore trop ? les plus anciennes
    if (this.authCache.size > this.CACHE_MAX_SIZE) {
      const sorted = Array.from(this.authCache.entries()).sort(
        (a, b) => a[1].expiresAt - b[1].expiresAt,
      );
      const toRemove = this.authCache.size - this.CACHE_MAX_SIZE;
      for (let i = 0; i < toRemove; i++) {
        this.authCache.delete(sorted[i][0]);
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // ROOMS
  // ════════════════════════════════════════════════════════════════════════

  private async joinRooms(client: Socket, user: ConnectedUser) {
    await client.join('all');
    await client.join(`user_${user.id}`);
    await client.join(`role_${user.role}`);

    if (user.departementId) {
      await client.join(`dept_${user.departementId}`);
    }

    const isAdmin = ['ADMIN', 'DIRECTEUR_AUDIT'].includes(user.role as string);
    const isAuditTeam = [
      'ADMIN',
      'DIRECTEUR_AUDIT',
      'CHEF_DEPARTEMENT_AUDIT',
      'CHEF_MISSION',
      'AUDITEUR_SENIOR',
      'AUDITEUR_JUNIOR',
      'STAGIAIRE',
    ].includes(user.role as string);

    if (isAdmin) await client.join('admins');
    if (isAuditTeam) await client.join('audit_team');
  }

  /**
   * Pour faire rejoindre dynamiquement la room d'un audit spécifique
   * (membre d'une mission). Appelé depuis l'extérieur via service.
   */
  joinAuditRoom(userId: string, auditId: string) {
    for (const [socketId, user] of this.connectedUsers) {
      if (user.id === userId) {
        const socket = this.server.sockets.sockets.get(socketId);
        socket?.join(`audit_${auditId}`);
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // ÉMISSION (à utiliser depuis les services métier)
  // ════════════════════════════════════════════════════════════════════════

  /** Émettre à un utilisateur spécifique (toutes ses sessions) */
  emitToUser<T>(userId: string, event: SocketEventName, data: T) {
    this.server.to(`user_${userId}`).emit(event, data);
  }

  /** Émettre à plusieurs utilisateurs (cumulé) */
  emitToUsers<T>(userIds: string[], event: SocketEventName, data: T) {
    if (userIds.length === 0) return;
    const rooms = userIds.map((id) => `user_${id}`);
    this.server.to(rooms).emit(event, data);
  }

  /** Émettre à un département (BU) */
  emitToDept<T>(departementId: string, event: SocketEventName, data: T) {
    this.server.to(`dept_${departementId}`).emit(event, data);
  }

  /** Émettre à toute l'équipe d'audit */
  emitToAuditTeam<T>(event: SocketEventName, data: T) {
    this.server.to('audit_team').emit(event, data);
  }

  /** Émettre aux ADMIN + DIRECTEUR_AUDIT */
  emitToAdmins<T>(event: SocketEventName, data: T) {
    this.server.to('admins').emit(event, data);
  }

  /** Émettre aux membres d'un audit spécifique (équipe + responsable) */
  emitToAudit<T>(auditId: string, event: SocketEventName, data: T) {
    this.server.to(`audit_${auditId}`).emit(event, data);
  }

  /** Émettre aux utilisateurs ayant un rôle donné */
  emitToRole<T>(role: string, event: SocketEventName, data: T) {
    this.server.to(`role_${role}`).emit(event, data);
  }

  /** Broadcast à tous les connectés */
  broadcast<T>(event: SocketEventName, data: T) {
    this.server.to('all').emit(event, data);
  }

  // ════════════════════════════════════════════════════════════════════════
  // SUBSCRIPTIONS (events reçus du client)
  // ════════════════════════════════════════════════════════════════════════

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    const user = this.connectedUsers.get(client.id);
    if (!user) return;
    client.emit(SOCKET_EVENTS.PONG, { ts: Date.now(), userId: user.id });
  }

  // ════════════════════════════════════════════════════════════════════════
  // STATS / HEALTH
  // ════════════════════════════════════════════════════════════════════════

  getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  isUserOnline(userId: string): boolean {
    for (const u of this.connectedUsers.values()) {
      if (u.id === userId) return true;
    }
    return false;
  }
}
