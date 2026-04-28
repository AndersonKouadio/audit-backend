-- Migrations SQL custom à appliquer AVANT `prisma db push`.
-- Le CI exécute ce fichier en idempotent (échecs ignorés).
--
-- Use case : changements de type que `prisma db push` refuse
-- (ex: String → enum) → on convertit ici via CAST sans perte.

-- ─── 1. ActionPoint.statut : String → enum StatutActionPoint ─────────────

DO $$ BEGIN
  CREATE TYPE "StatutActionPoint" AS ENUM ('A_FAIRE', 'EN_COURS', 'TERMINE', 'ANNULEE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF (
    SELECT data_type
    FROM information_schema.columns
    WHERE table_name = 'actions_points' AND column_name = 'statut'
  ) = 'text' THEN
    -- Drop le default String, convert via CAST (les valeurs invalides → A_FAIRE)
    ALTER TABLE actions_points ALTER COLUMN statut DROP DEFAULT;
    ALTER TABLE actions_points
      ALTER COLUMN statut TYPE "StatutActionPoint"
      USING (
        CASE
          WHEN statut IN ('A_FAIRE','EN_COURS','TERMINE','ANNULEE')
            THEN statut::"StatutActionPoint"
          ELSE 'A_FAIRE'::"StatutActionPoint"
        END
      );
    ALTER TABLE actions_points
      ALTER COLUMN statut SET DEFAULT 'A_FAIRE'::"StatutActionPoint";
    RAISE NOTICE '✅ actions_points.statut migré en enum StatutActionPoint';
  END IF;
END $$;
