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
  // Le département IT héberge l'admin système (rôle technique, transverse).
  const deptIT = await prisma.departement.upsert({
    where: { code: 'IT' },
    update: {},
    create: {
      code: 'IT',
      nom: "Support & Systèmes d'Information",
      description: 'Département technique (Généré par le système).',
    },
  });
  console.log('💻 Département IT vérifié/créé.');

  // Le département AUDIT héberge l'équipe d'audit (CHEF_MISSION, AUDITEUR_*,
  // STAGIAIRE). Il est aussi recréé automatiquement au démarrage de l'app
  // via DepartementsService.onApplicationBootstrap.
  await prisma.departement.upsert({
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
  // 3. CRÉATION DU SUPER ADMIN (rattaché au département IT)
  // ---------------------------------------------------------
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@localhost.com';
  const adminPwd = process.env.ADMIN_PASSWORD || 'Admin@1234';

  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(adminPwd, salt);

  await prisma.utilisateur.upsert({
    where: { email: adminEmail },
    update: {
      role: RoleUtilisateur.ADMIN,
      departementId: deptIT.id,
    },
    create: {
      email: adminEmail,
      prenom: 'Super',
      nom: 'Admin',
      motDePasse: hash,
      role: RoleUtilisateur.ADMIN,
      statut: StatutUtilisateur.ACTIF,
      departementId: deptIT.id,
    },
  });

  console.log(` 👮 Super Admin créé : ${adminEmail}`);

  // ---------------------------------------------------------
  // 4. PARAMÈTRES SYSTÈME (singleton — défauts du schema)
  // ---------------------------------------------------------
  await prisma.parametresSysteme.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton' }, // tous les autres champs ont des @default
  });
  console.log('⚙️  Paramètres système (singleton) vérifiés/créés.');

  // ---------------------------------------------------------
  // 5. PLANIFICATION DUNNING par défaut (relances hebdomadaires lundi 9h)
  // ---------------------------------------------------------
  const existingPlan = await prisma.planificationDunning.findFirst({
    where: { typeCible: 'POINTS_ECHUS' },
  });
  if (!existingPlan) {
    await prisma.planificationDunning.create({
      data: {
        typeCible: 'POINTS_ECHUS',
        frequence: 'HEBDOMADAIRE',
        jour: 1, // lundi
        heure: 9,
        actif: true,
      },
    });
    console.log('📧 Planification Dunning (lundi 9h) créée.');
  } else {
    console.log('ℹ️  Planification Dunning déjà existante.');
  }

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
