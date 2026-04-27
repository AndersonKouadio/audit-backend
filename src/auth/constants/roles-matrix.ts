/**
 * MATRICE DE RÔLES CENTRALISÉE
 *
 * Source unique de vérité pour les groupes de rôles utilisés dans toute l'application.
 *
 * Règles :
 * - NE JAMAIS hardcoder une liste de rôles dans un controller
 * - Importer depuis ce fichier uniquement
 * - Si un nouveau rôle est ajouté à l'enum, mettre à jour les groupes ci-dessous
 *
 * Hiérarchie audit (du plus privilégié au moins privilégié) :
 *   ADMIN > DIRECTEUR_AUDIT > CHEF_DEPARTEMENT_AUDIT > CHEF_MISSION
 *   > AUDITEUR_SENIOR > AUDITEUR_JUNIOR > STAGIAIRE
 *
 * Hiérarchie BU :
 *   MANAGER_METIER > RISK_CHAMPION > EMPLOYE_METIER
 *
 * Spécial :
 *   LECTURE_SEULE → consultation uniquement (régulateur, DG, audit externe)
 */

import { RoleUtilisateur } from 'src/generated/prisma/enums';

// ============================================================================
// GROUPES AUDIT (équipe d'audit interne)
// ============================================================================

/** Tous les rôles d'audit pouvant agir opérationnellement (créer, modifier, valider) */
export const ROLES_AUDIT_OPS: RoleUtilisateur[] = [
  RoleUtilisateur.ADMIN,
  RoleUtilisateur.DIRECTEUR_AUDIT,
  RoleUtilisateur.CHEF_DEPARTEMENT_AUDIT,
  RoleUtilisateur.CHEF_MISSION,
  RoleUtilisateur.AUDITEUR_SENIOR,
  RoleUtilisateur.AUDITEUR_JUNIOR,
];

/** Rôles audit pouvant lire (incluant les stagiaires en lecture) */
export const ROLES_AUDIT_LECTURE: RoleUtilisateur[] = [
  ...ROLES_AUDIT_OPS,
  RoleUtilisateur.STAGIAIRE,
];

/** Rôles managers audit (peuvent valider, clôturer, approuver) */
export const ROLES_AUDIT_MANAGEMENT: RoleUtilisateur[] = [
  RoleUtilisateur.ADMIN,
  RoleUtilisateur.DIRECTEUR_AUDIT,
  RoleUtilisateur.CHEF_DEPARTEMENT_AUDIT,
  RoleUtilisateur.CHEF_MISSION,
];

/** Rôles seniors d'audit (peuvent encadrer, créer batch, supprimer) */
export const ROLES_AUDIT_SENIOR_PLUS: RoleUtilisateur[] = [
  RoleUtilisateur.ADMIN,
  RoleUtilisateur.DIRECTEUR_AUDIT,
  RoleUtilisateur.CHEF_DEPARTEMENT_AUDIT,
  RoleUtilisateur.CHEF_MISSION,
  RoleUtilisateur.AUDITEUR_SENIOR,
];

// ============================================================================
// GROUPES BUSINESS UNIT (côté audité)
// ============================================================================

/** Rôles BU (côté métier audité) */
export const ROLES_BU: RoleUtilisateur[] = [
  RoleUtilisateur.MANAGER_METIER,
  RoleUtilisateur.RISK_CHAMPION,
  RoleUtilisateur.EMPLOYE_METIER,
];

/** Rôles BU autorisés à déclarer un statut sur un point */
export const ROLES_BU_DECLARATION: RoleUtilisateur[] = [
  RoleUtilisateur.MANAGER_METIER,
  RoleUtilisateur.RISK_CHAMPION,
  RoleUtilisateur.EMPLOYE_METIER,
];

/** Heads of Department (peuvent approuver le RAF niveau HoD) */
export const ROLES_HOD: RoleUtilisateur[] = [
  RoleUtilisateur.MANAGER_METIER,
  RoleUtilisateur.CHEF_DEPARTEMENT_AUDIT,
];

/** General Managers (peuvent approuver le RAF niveau GM) */
export const ROLES_GM: RoleUtilisateur[] = [
  RoleUtilisateur.ADMIN,
  RoleUtilisateur.DIRECTEUR_AUDIT,
];

/** Comité d'audit (validation finale RAF) */
export const ROLES_COMITE_AUDIT: RoleUtilisateur[] = [
  RoleUtilisateur.ADMIN,
  RoleUtilisateur.DIRECTEUR_AUDIT,
];

// ============================================================================
// GROUPES TRANSVERSAUX
// ============================================================================

/**
 * Tous les rôles authentifiés ayant le droit de LIRE le système.
 * Inclut tous les rôles audit + tous les BU + LECTURE_SEULE.
 *
 * À utiliser pour les endpoints GET de listing/détail des entités principales
 * (audits, points-audit, departements, dashboard).
 *
 * Le filtrage par scope (ex: par département) doit être fait DANS LE SERVICE.
 */
export const ROLES_LECTURE_GLOBALE: RoleUtilisateur[] = [
  ...ROLES_AUDIT_LECTURE,
  ...ROLES_BU,
  RoleUtilisateur.LECTURE_SEULE,
];

/**
 * Tous les rôles authentifiés (utile pour endpoints "self-service" comme /me).
 * Équivaut à @Public() mais explicite.
 */
export const ROLES_AUTHENTIFIE: RoleUtilisateur[] = [
  ...ROLES_AUDIT_LECTURE,
  ...ROLES_BU,
  RoleUtilisateur.LECTURE_SEULE,
];

// ============================================================================
// GROUPES EXPORT (sensibilité données)
// ============================================================================

/** Export opérationnel (points-audit, ageing) */
export const ROLES_EXPORT_OPERATIONNEL: RoleUtilisateur[] = [
  ...ROLES_AUDIT_OPS,
  RoleUtilisateur.LECTURE_SEULE,
];

/** Export sensible (cas-fraude, risques, journal) */
export const ROLES_EXPORT_SENSIBLE: RoleUtilisateur[] = [
  RoleUtilisateur.ADMIN,
  RoleUtilisateur.DIRECTEUR_AUDIT,
  RoleUtilisateur.CHEF_DEPARTEMENT_AUDIT,
];

// ============================================================================
// GROUPES UTILISATEURS (gestion comptes)
// ============================================================================

/** Peuvent créer/modifier/supprimer un utilisateur */
export const ROLES_GESTION_USERS: RoleUtilisateur[] = [
  RoleUtilisateur.ADMIN,
];

/**
 * Peuvent CONSULTER la liste des utilisateurs.
 * IMPORTANT : CHEF_MISSION et CHEF_DEPARTEMENT_AUDIT en font partie car
 * ils ont besoin d'assigner des équipes à leurs missions.
 */
export const ROLES_LECTURE_USERS: RoleUtilisateur[] = [
  RoleUtilisateur.ADMIN,
  RoleUtilisateur.DIRECTEUR_AUDIT,
  RoleUtilisateur.CHEF_DEPARTEMENT_AUDIT,
  RoleUtilisateur.CHEF_MISSION,
];

// ============================================================================
// GROUPES JOURNAL D'AUDIT
// ============================================================================

/**
 * Peuvent consulter le journal d'audit.
 * Étendu pour inclure les Chefs (besoin métier de traçabilité).
 */
export const ROLES_LECTURE_JOURNAL: RoleUtilisateur[] = [
  RoleUtilisateur.ADMIN,
  RoleUtilisateur.DIRECTEUR_AUDIT,
  RoleUtilisateur.CHEF_DEPARTEMENT_AUDIT,
  RoleUtilisateur.CHEF_MISSION,
  RoleUtilisateur.LECTURE_SEULE,
];

// ============================================================================
// HELPERS
// ============================================================================

/** Vérifie si un rôle fait partie de l'équipe d'audit (vs BU) */
export const isAuditTeamRole = (role: RoleUtilisateur): boolean =>
  ROLES_AUDIT_LECTURE.includes(role);

/** Vérifie si un rôle est BU (côté audité) */
export const isBURole = (role: RoleUtilisateur): boolean =>
  ROLES_BU.includes(role);

/** Rôles privilégiés : peuvent bypasser les filtres de scope (vue globale) */
export const ROLES_PRIVILEGIES: RoleUtilisateur[] = [
  RoleUtilisateur.ADMIN,
  RoleUtilisateur.DIRECTEUR_AUDIT,
  RoleUtilisateur.CHEF_DEPARTEMENT_AUDIT,
  RoleUtilisateur.LECTURE_SEULE,
];

/** Vérifie si un rôle peut bypasser les filtres de scope (vue globale) */
export const isPrivilegedRole = (role: RoleUtilisateur): boolean =>
  ROLES_PRIVILEGIES.includes(role);
