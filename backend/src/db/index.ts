import type { IRepository } from "./repository.js";
import { store as jsonStoreInstance } from "./store.js";
import { PostgresRepository } from "./postgresRepository.js";

let activeRepository: IRepository | null = null;

export function getRepository(): IRepository {
  if (activeRepository) return activeRepository;

  const driver = process.env.PERSISTENCE_DRIVER?.toLowerCase();
  const hasDbUrl = Boolean(process.env.DATABASE_URL || process.env.SUPABASE_DB_URL);
  const isProduction = process.env.NODE_ENV === "production";

  if (driver === "postgres" || hasDbUrl) {
    try {
      console.log("[Repository] Initializing production PostgreSQL repository...");
      activeRepository = new PostgresRepository();
      return activeRepository;
    } catch (err: any) {
      console.error("[Repository] Failed to initialize PostgreSQL repository:", err.message);
      if (isProduction && !process.env.ALLOW_LOCAL_JSON_IN_PROD) {
        throw new Error(
          "FATAL DATABASE ERROR: Production environment is configured for PostgreSQL but connection pool initialization failed. " +
          "Provide a valid DATABASE_URL or set ALLOW_LOCAL_JSON_IN_PROD=true if fallback is intended."
        );
      }
    }
  }

  if (isProduction && !process.env.ALLOW_LOCAL_JSON_IN_PROD) {
    console.warn(
      "[SECURITY WARNING] Running with local JSON persistent store in production! " +
      "For production deployments, please configure PostgreSQL via DATABASE_URL or SUPABASE_DB_URL."
    );
  }

  console.log("[Repository] Using Local Persistent JSON Repository (ACID Store).");
  activeRepository = jsonStoreInstance;
  return activeRepository as IRepository;
}

export const repository = getRepository();
export type { IRepository };

