/**
 * Code unique du département "Audit Interne".
 *
 * Ce département est créé automatiquement au démarrage de l'application
 * (cf. DepartementsService.onApplicationBootstrap) et héberge l'équipe
 * d'audit (CHEF_MISSION, AUDITEUR_*, STAGIAIRE) ainsi que l'admin système.
 *
 * Il ne doit pas être supprimable depuis l'UI : la suppression est bloquée
 * dans DepartementsService.remove().
 */
export const AUDIT_DEPT_CODE = 'AUDIT';

export const AUDIT_DEPT_DEFAULT = {
  code: AUDIT_DEPT_CODE,
  nom: "Audit Interne",
  description:
    "Département en charge des missions d'audit interne (généré automatiquement par le système).",
};
