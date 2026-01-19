import { Pool } from "pg";
let pool: Pool | null = null;
const getPool = () => {
  if (pool) {
    return pool;
  }
  const connectionString = process.env.DATABASE_URL;
  if (connectionString) {
    pool = new Pool({ connectionString });
    return pool;
  }

  const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS } = process.env;

  const missingVars = [
    ["DB_HOST", DB_HOST],
    ["DB_PORT", DB_PORT],
    ["DB_NAME", DB_NAME],
    ["DB_USER", DB_USER],
    ["DB_PASS", DB_PASS],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missingVars.length > 0) {
    throw new Error(
      `Missing database environment variables: ${missingVars.join(
        ", ",
      )}. Set DATABASE_URL or provide all DB_* values.`,
    );
  }

  pool = new Pool({
    host: DB_HOST,
    port: Number(DB_PORT),
    database: DB_NAME,
    user: DB_USER,
    password: DB_PASS,
  });
  return pool;
};

export { getPool };
