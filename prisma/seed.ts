import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';
import 'dotenv/config';
import { Pool } from 'pg';
import {
  PrismaClient,
  RoleUtilisateur,
  StatutUtilisateur,
} from '../src/generated/prisma/client';

// Setup connexion
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Démarrage du seeding "Organisation & Admin"...');

  // ---------------------------------------------------------
  // 1. CRÉATION DE L'ORGANISATION
  // ---------------------------------------------------------
  const orgName = process.env.ORG_NOM || 'Mon Entreprise';

  // On part du principe qu'il n'y a qu'une seule organisation
  // On cherche la première, sinon on crée
  const existingOrg = await prisma.organisation.findFirst();

  if (!existingOrg) {
    await prisma.organisation.create({
      data: {
        nom: orgName,
        matricule: process.env.ORG_MATRICULE,
        adresse: process.env.ORG_ADRESSE,
        estConfiguree: false, // <--- Important : Force le parcours de configuration au début
      },
    });
    console.log(`🏢 Organisation "${orgName}" créée (Non configurée).`);
  } else {
    console.log(`ℹ️ Organisation déjà existante : ${existingOrg.nom}`);
  }

  // ---------------------------------------------------------
  // 2. DÉPARTEMENTS SYSTÈME
  // ---------------------------------------------------------
  // Le département AUDIT héberge l'équipe d'audit (CHEF_MISSION, AUDITEUR_*,
  // STAGIAIRE) ainsi que l'admin système. Il est aussi recréé automatiquement
  // au démarrage de l'app via DepartementsService.onApplicationBootstrap.
  const deptAudit = await prisma.departement.upsert({
    where: { code: 'AUDIT' },
    update: {},
    create: {
      code: 'AUDIT',
      nom: 'Audit Interne',
      description:
        "Département en charge des missions d'audit interne (généré automatiquement par le système).",
    },
  });
  console.log('🛡️  Département AUDIT vérifié/créé.');

  // ---------------------------------------------------------
  // 3. CRÉATION DU SUPER ADMIN
  // ---------------------------------------------------------
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@localhost.com';
  const adminPwd = process.env.ADMIN_PASSWORD || 'Admin@1234';

  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(adminPwd, salt);

  await prisma.utilisateur.upsert({
    where: { email: adminEmail },
    update: {
      role: RoleUtilisateur.ADMIN, // Mise à jour du rôle si nécessaire
      departementId: deptAudit.id,
    },
    create: {
      email: adminEmail,
      prenom: 'Super',
      nom: 'Admin',
      motDePasse: hash,
      role: RoleUtilisateur.ADMIN,
      statut: StatutUtilisateur.ACTIF,
      departementId: deptAudit.id,
    },
  });

  console.log(` 👮 Super Admin créé : ${adminEmail}`);
  console.log('✅ Seeding terminé. Prêt pour le premier lancement !');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
