import { PrismaClient } from "../../src/generated/prisma/client";

export async function departementSeed(prisma: PrismaClient) {
  console.log("   Create departments...");

  const departements = [
    {
      code: "AUDIT",
      nom: "Audit Interne & Inspection",
      description: "Département en charge des contrôles",
    },
    {
      code: "IT",
      nom: "Systèmes d'Information",
      description: "DSI et Support Technique",
    },
    {
      code: "FIN",
      nom: "Finance & Comptabilité",
      description: "Gestion financière",
    },
    {
      code: "RH",
      nom: "Ressources Humaines",
      description: "Gestion du personnel",
    },
    { code: "DG", nom: "Direction Générale", description: "Top Management" },
    { code: "MKT", nom: "Marketing & Vente", description: "Commercial" },
  ];

  for (const dept of departements) {
    await prisma.departement.upsert({
      where: { code: dept.code },
      update: {}, // On ne change rien si ça existe déjà
      create: {
        code: dept.code,
        nom: dept.nom,
        description: dept.description,
      },
    });
  }
  console.log("   ✅ Départements créés.");
}
