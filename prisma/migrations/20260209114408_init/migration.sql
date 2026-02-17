-- CreateEnum
CREATE TYPE "RoleUtilisateur" AS ENUM ('ADMIN', 'DIRECTEUR_AUDIT', 'CHEF_DEPARTEMENT_AUDIT', 'CHEF_MISSION', 'AUDITEUR_SENIOR', 'AUDITEUR_JUNIOR', 'STAGIAIRE', 'RISK_CHAMPION', 'MANAGER_METIER', 'EMPLOYE_METIER', 'LECTURE_SEULE');

-- CreateEnum
CREATE TYPE "StatutUtilisateur" AS ENUM ('ACTIF', 'INACTIF', 'SUSPENDU');

-- CreateEnum
CREATE TYPE "TypeAudit" AS ENUM ('INTERNE', 'EXTERNE');

-- CreateEnum
CREATE TYPE "SourceAudit" AS ENUM ('SAISIE_MANUELLE', 'IMPORT_EXCEL');

-- CreateEnum
CREATE TYPE "StatutAudit" AS ENUM ('PLANIFIE', 'EN_COURS', 'PRE_PROJET', 'PUBLIE', 'CLOTURE', 'ARCHIVE');

-- CreateEnum
CREATE TYPE "Criticite" AS ENUM ('CRITIQUE', 'ELEVEE', 'MOYENNE', 'FAIBLE');

-- CreateEnum
CREATE TYPE "StatutPoint" AS ENUM ('OUVERT', 'EN_ATTENTE_VALIDATION', 'FERME_RESOLU', 'FERME_RISQUE_ACCEPTE', 'OBSOLETE');

-- CreateEnum
CREATE TYPE "StatutCasFraude" AS ENUM ('EN_INVESTIGATION', 'INVESTIGATION_TERMINEE', 'CLOTURE');

-- CreateEnum
CREATE TYPE "StatutImportBatch" AS ENUM ('EN_ATTENTE_VALIDATION', 'EN_COURS_TRAITEMENT', 'TERMINE_SUCCES', 'TERMINE_AVEC_ERREURS', 'ANNULE');

-- CreateEnum
CREATE TYPE "StatutLigneImport" AS ENUM ('VALIDE', 'ERREUR', 'AVERTISSEMENT', 'IMPORTE');

-- CreateEnum
CREATE TYPE "TypeActionLog" AS ENUM ('CONNEXION', 'DECONNEXION', 'CREATION', 'MODIFICATION', 'SUPPRESSION', 'PUBLICATION_RAPPORT', 'VALIDATION_POINT', 'IMPORT_EXCEL', 'EXPORT_EXCEL');

-- CreateTable
CREATE TABLE "organisation" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "matricule" TEXT,
    "adresse" TEXT,
    "siteWeb" TEXT,
    "logoUrl" TEXT,
    "estConfiguree" BOOLEAN NOT NULL DEFAULT false,
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateMiseAJour" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "utilisateurs" (
    "id" TEXT NOT NULL,
    "matricule" TEXT,
    "email" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "motDePasse" TEXT NOT NULL,
    "role" "RoleUtilisateur" NOT NULL,
    "statut" "StatutUtilisateur" NOT NULL DEFAULT 'ACTIF',
    "departementId" TEXT,
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateMiseAJour" TIMESTAMP(3) NOT NULL,
    "derniereConnexion" TIMESTAMP(3),

    CONSTRAINT "utilisateurs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departements" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "riskChampionId" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateMiseAJour" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audits" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "type" "TypeAudit" NOT NULL,
    "source" "SourceAudit" NOT NULL DEFAULT 'SAISIE_MANUELLE',
    "anneeFiscale" INTEGER NOT NULL,
    "dateDebutPrevue" TIMESTAMP(3) NOT NULL,
    "dateFinPrevue" TIMESTAMP(3) NOT NULL,
    "datePublication" TIMESTAMP(3),
    "departementId" TEXT NOT NULL,
    "responsableId" TEXT NOT NULL,
    "cabinetExterne" TEXT,
    "associeSignataire" TEXT,
    "noteEvaluation" TEXT,
    "statut" "StatutAudit" NOT NULL DEFAULT 'PLANIFIE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "points_audit" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "departementId" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "causes" TEXT,
    "consequences" TEXT,
    "recommandation" TEXT NOT NULL,
    "criticite" "Criticite" NOT NULL,
    "dateEcheanceInitiale" TIMESTAMP(3) NOT NULL,
    "dateEcheanceActuelle" TIMESTAMP(3) NOT NULL,
    "dateResolution" TIMESTAMP(3),
    "dateCPF" TIMESTAMP(3),
    "statut" "StatutPoint" NOT NULL DEFAULT 'OUVERT',
    "ageing" INTEGER NOT NULL DEFAULT 0,
    "nbRelances" INTEGER NOT NULL DEFAULT 0,
    "createurId" TEXT NOT NULL,
    "formulaireRisqueId" TEXT,
    "sourceImportId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "points_audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actions_points" (
    "id" TEXT NOT NULL,
    "pointAuditId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "responsableId" TEXT NOT NULL,
    "dateEcheance" TIMESTAMP(3) NOT NULL,
    "statut" TEXT NOT NULL,
    "avancement" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "actions_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formulaires_acceptation_risque" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "justification" TEXT NOT NULL,
    "controleCompensatoire" TEXT,
    "approuvePar_HoD" TEXT,
    "approuvePar_GM" TEXT,
    "approuvePar_CEO" TEXT,
    "validePar_ComiteAudit" TEXT,
    "dateValidationFinal" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "formulaires_acceptation_risque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cas_fraudes" (
    "id" TEXT NOT NULL,
    "numeroCas" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "departementId" TEXT NOT NULL,
    "dateSignalement" TIMESTAMP(3) NOT NULL,
    "coutImpact" DECIMAL(15,2),
    "statut" "StatutCasFraude" NOT NULL DEFAULT 'EN_INVESTIGATION',
    "auditeurFRMId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cas_fraudes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "points_fraude" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "casId" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "recommandation" TEXT NOT NULL,
    "coutImpact" DECIMAL(15,2),
    "auditeurFRMId" TEXT NOT NULL,
    "dateEcheance" TIMESTAMP(3) NOT NULL,
    "dateReporting" TIMESTAMP(3),
    "statut" TEXT NOT NULL DEFAULT 'OUVERT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "points_fraude_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imports_batch" (
    "id" TEXT NOT NULL,
    "typeModule" TEXT NOT NULL,
    "nomFichier" TEXT NOT NULL,
    "urlFichier" TEXT NOT NULL,
    "auditCibleId" TEXT,
    "statut" "StatutImportBatch" NOT NULL DEFAULT 'EN_ATTENTE_VALIDATION',
    "totalLignes" INTEGER NOT NULL DEFAULT 0,
    "lignesReussies" INTEGER NOT NULL DEFAULT 0,
    "lignesEchouees" INTEGER NOT NULL DEFAULT 0,
    "importateurId" TEXT NOT NULL,
    "dateImport" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "imports_batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imports_lignes_staging" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "numeroLigneExcel" INTEGER NOT NULL,
    "donneesBrutes" JSONB NOT NULL,
    "statut" "StatutLigneImport" NOT NULL DEFAULT 'VALIDE',
    "messageErreur" TEXT,
    "mappingResolu" JSONB,
    "pointAuditCreeId" TEXT,

    CONSTRAINT "imports_lignes_staging_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journaux_audit" (
    "id" TEXT NOT NULL,
    "utilisateurId" TEXT,
    "utilisateurNom" TEXT,
    "utilisateurRole" TEXT,
    "action" "TypeActionLog" NOT NULL,
    "entiteType" TEXT NOT NULL,
    "entiteId" TEXT,
    "entiteRef" TEXT,
    "details" JSONB,
    "motif" TEXT,
    "adresseIP" TEXT,
    "userAgent" TEXT,
    "dateAction" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journaux_audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historique_statuts" (
    "id" TEXT NOT NULL,
    "typeEntite" TEXT NOT NULL,
    "entiteId" TEXT NOT NULL,
    "statutPrecedent" TEXT,
    "nouveauStatut" TEXT,
    "commentaire" TEXT,
    "modifiePar" TEXT NOT NULL,
    "dateModification" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pointAuditId" TEXT,
    "pointFraudeId" TEXT,

    CONSTRAINT "historique_statuts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commentaires" (
    "id" TEXT NOT NULL,
    "typeEntite" TEXT NOT NULL,
    "entiteId" TEXT NOT NULL,
    "texte" TEXT NOT NULL,
    "estInterne" BOOLEAN NOT NULL DEFAULT false,
    "creePar" TEXT NOT NULL,
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pointAuditId" TEXT,
    "pointFraudeId" TEXT,

    CONSTRAINT "commentaires_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pieces_jointes" (
    "id" TEXT NOT NULL,
    "nomFichier" TEXT NOT NULL,
    "urlFichier" TEXT NOT NULL,
    "typeMime" TEXT NOT NULL,
    "taille" INTEGER NOT NULL,
    "televerseePar" TEXT NOT NULL,
    "dateAjout" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "auditId" TEXT,
    "pointAuditId" TEXT,
    "actionPointId" TEXT,
    "pointFraudeId" TEXT,

    CONSTRAINT "pieces_jointes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "destinataire" TEXT NOT NULL,
    "sujet" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "statut" TEXT NOT NULL,
    "dateProgrammee" TIMESTAMP(3),
    "dateEnvoi" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planifications_dunning" (
    "id" TEXT NOT NULL,
    "typeCible" TEXT NOT NULL,
    "frequence" TEXT NOT NULL,
    "jour" INTEGER,
    "heure" INTEGER NOT NULL DEFAULT 9,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "lastRun" TIMESTAMP(3),
    "nextRun" TIMESTAMP(3),

    CONSTRAINT "planifications_dunning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_EquipeAudit" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_EquipeAudit_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "utilisateurs_matricule_key" ON "utilisateurs"("matricule");

-- CreateIndex
CREATE UNIQUE INDEX "utilisateurs_email_key" ON "utilisateurs"("email");

-- CreateIndex
CREATE UNIQUE INDEX "departements_code_key" ON "departements"("code");

-- CreateIndex
CREATE UNIQUE INDEX "departements_riskChampionId_key" ON "departements"("riskChampionId");

-- CreateIndex
CREATE UNIQUE INDEX "audits_reference_key" ON "audits"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "points_audit_reference_key" ON "points_audit"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "points_audit_sourceImportId_key" ON "points_audit"("sourceImportId");

-- CreateIndex
CREATE UNIQUE INDEX "formulaires_acceptation_risque_numero_key" ON "formulaires_acceptation_risque"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "cas_fraudes_numeroCas_key" ON "cas_fraudes"("numeroCas");

-- CreateIndex
CREATE UNIQUE INDEX "points_fraude_code_key" ON "points_fraude"("code");

-- CreateIndex
CREATE INDEX "imports_lignes_staging_batchId_idx" ON "imports_lignes_staging"("batchId");

-- CreateIndex
CREATE INDEX "journaux_audit_entiteId_idx" ON "journaux_audit"("entiteId");

-- CreateIndex
CREATE INDEX "journaux_audit_dateAction_idx" ON "journaux_audit"("dateAction");

-- CreateIndex
CREATE INDEX "historique_statuts_entiteId_idx" ON "historique_statuts"("entiteId");

-- CreateIndex
CREATE INDEX "commentaires_entiteId_idx" ON "commentaires"("entiteId");

-- CreateIndex
CREATE INDEX "_EquipeAudit_B_index" ON "_EquipeAudit"("B");

-- AddForeignKey
ALTER TABLE "utilisateurs" ADD CONSTRAINT "utilisateurs_departementId_fkey" FOREIGN KEY ("departementId") REFERENCES "departements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departements" ADD CONSTRAINT "departements_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "departements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departements" ADD CONSTRAINT "departements_riskChampionId_fkey" FOREIGN KEY ("riskChampionId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audits" ADD CONSTRAINT "audits_departementId_fkey" FOREIGN KEY ("departementId") REFERENCES "departements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audits" ADD CONSTRAINT "audits_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_audit" ADD CONSTRAINT "points_audit_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_audit" ADD CONSTRAINT "points_audit_departementId_fkey" FOREIGN KEY ("departementId") REFERENCES "departements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_audit" ADD CONSTRAINT "points_audit_createurId_fkey" FOREIGN KEY ("createurId") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_audit" ADD CONSTRAINT "points_audit_formulaireRisqueId_fkey" FOREIGN KEY ("formulaireRisqueId") REFERENCES "formulaires_acceptation_risque"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions_points" ADD CONSTRAINT "actions_points_pointAuditId_fkey" FOREIGN KEY ("pointAuditId") REFERENCES "points_audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions_points" ADD CONSTRAINT "actions_points_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cas_fraudes" ADD CONSTRAINT "cas_fraudes_departementId_fkey" FOREIGN KEY ("departementId") REFERENCES "departements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cas_fraudes" ADD CONSTRAINT "cas_fraudes_auditeurFRMId_fkey" FOREIGN KEY ("auditeurFRMId") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_fraude" ADD CONSTRAINT "points_fraude_casId_fkey" FOREIGN KEY ("casId") REFERENCES "cas_fraudes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_fraude" ADD CONSTRAINT "points_fraude_auditeurFRMId_fkey" FOREIGN KEY ("auditeurFRMId") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imports_batch" ADD CONSTRAINT "imports_batch_auditCibleId_fkey" FOREIGN KEY ("auditCibleId") REFERENCES "audits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imports_batch" ADD CONSTRAINT "imports_batch_importateurId_fkey" FOREIGN KEY ("importateurId") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imports_lignes_staging" ADD CONSTRAINT "imports_lignes_staging_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "imports_batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historique_statuts" ADD CONSTRAINT "historique_statuts_pointAuditId_fkey" FOREIGN KEY ("pointAuditId") REFERENCES "points_audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historique_statuts" ADD CONSTRAINT "historique_statuts_pointFraudeId_fkey" FOREIGN KEY ("pointFraudeId") REFERENCES "points_fraude"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commentaires" ADD CONSTRAINT "commentaires_pointAuditId_fkey" FOREIGN KEY ("pointAuditId") REFERENCES "points_audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commentaires" ADD CONSTRAINT "commentaires_pointFraudeId_fkey" FOREIGN KEY ("pointFraudeId") REFERENCES "points_fraude"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pieces_jointes" ADD CONSTRAINT "pieces_jointes_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "audits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pieces_jointes" ADD CONSTRAINT "pieces_jointes_pointAuditId_fkey" FOREIGN KEY ("pointAuditId") REFERENCES "points_audit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pieces_jointes" ADD CONSTRAINT "pieces_jointes_actionPointId_fkey" FOREIGN KEY ("actionPointId") REFERENCES "actions_points"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pieces_jointes" ADD CONSTRAINT "pieces_jointes_pointFraudeId_fkey" FOREIGN KEY ("pointFraudeId") REFERENCES "points_fraude"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EquipeAudit" ADD CONSTRAINT "_EquipeAudit_A_fkey" FOREIGN KEY ("A") REFERENCES "audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EquipeAudit" ADD CONSTRAINT "_EquipeAudit_B_fkey" FOREIGN KEY ("B") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
