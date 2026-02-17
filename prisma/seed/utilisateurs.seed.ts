import {
  PrismaClient,
  RoleUtilisateur,
  StatutUtilisateur,
} from '../../src/generated/prisma/client';
import * as bcrypt from 'bcryptjs';

export async function utilisateurSeed(prisma: PrismaClient) {
  // 1. Préparation du mot de passe haché
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash('Password123!', salt);

  // 2. Récupération des IDs
  const deptAudit = await prisma.departement.findUnique({
    where: { code: 'AUDIT' },
  });
  const deptIT = await prisma.departement.findUnique({ where: { code: 'IT' } });
  const deptFin = await prisma.departement.findUnique({
    where: { code: 'FIN' },
  });
  const deptDG = await prisma.departement.findUnique({ where: { code: 'DG' } });

  if (!deptAudit || !deptIT || !deptFin || !deptDG) {
    throw new Error('❌ Départements manquants. Lancez departementSeed avant.');
  }

  // 3. Liste des utilisateurs
  const utilisateurs = [
    // --- ADMIN TECHNIQUE ---
    {
      email: 'admin@audit.app',
      prenom: 'Super',
      nom: 'Admin',
      role: RoleUtilisateur.ADMIN,
      departementId: deptIT.id,
    },
    // --- HIERARCHIE AUDIT ---
    {
      email: 'directeur.audit@audit.app',
      prenom: 'Jean',
      nom: 'Directeur',
      role: RoleUtilisateur.DIRECTEUR_AUDIT,
      departementId: deptAudit.id,
    },
    {
      email: 'chef.mission@audit.app',
      prenom: 'Michel',
      nom: 'Manager',
      role: RoleUtilisateur.CHEF_MISSION,
      departementId: deptAudit.id,
    },
    {
      email: 'auditeur.senior@audit.app',
      prenom: 'Sarah',
      nom: 'Senior',
      role: RoleUtilisateur.AUDITEUR_SENIOR,
      departementId: deptAudit.id,
    },
    {
      email: 'auditeur.junior@audit.app',
      prenom: 'Lucas',
      nom: 'Junior',
      role: RoleUtilisateur.AUDITEUR_JUNIOR,
      departementId: deptAudit.id,
    },
    // --- MÉTIERS (AUDITÉS) ---
    {
      email: 'risk.finance@audit.app',
      prenom: 'Paul',
      nom: 'RiskChampion',
      role: RoleUtilisateur.RISK_CHAMPION,
      departementId: deptFin.id,
    },
    {
      email: 'manager.finance@audit.app',
      prenom: 'Claire',
      nom: 'CFO',
      role: RoleUtilisateur.MANAGER_METIER,
      departementId: deptFin.id,
    },
    // --- DIRECTION GÉNÉRALE ---
    {
      email: 'dg@audit.app',
      prenom: 'Patron',
      nom: 'Général',
      role: RoleUtilisateur.LECTURE_SEULE,
      departementId: deptDG.id,
    },
  ];

  // 4. Boucle de création
  for (const user of utilisateurs) {
    await prisma.utilisateur.upsert({
      where: { email: user.email },
      update: {
        role: user.role,
        departementId: user.departementId,
      },
      create: {
        email: user.email,
        prenom: user.prenom,
        nom: user.nom,
        motDePasse: hash,
        role: user.role,
        statut: StatutUtilisateur.ACTIF,
        departementId: user.departementId,
      },
    });
  }

  // 5. Mettre à jour le Risk Champion Finance
  const userRiskFin = await prisma.utilisateur.findUnique({
    where: { email: 'risk.finance@audit.app' },
  });
  if (userRiskFin) {
    await prisma.departement.update({
      where: { code: 'FIN' },
      data: { riskChampionId: userRiskFin.id },
    });
  }

  console.log('   ✅ Utilisateurs créés.');
}
