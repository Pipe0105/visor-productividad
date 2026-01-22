import { Pool } from "pg";
let pool: Pool | null = null;

type DbEnv = {
  host?: string;
  port?: string;
  name?: string;
  user?: string;
  pass?: string;
};

const resolveEnv = (): DbEnv => {
  const env = process.env;
  return {
    host:
      env.DB_HOST ??
      env.PGHOST ??
      env.MYSQL_HOST ??
      env.DB_HOSTNAME ??
      env.DATABASE_HOST,
    port:
      env.DB_PORT ??
      env.PGPORT ??
      env.MYSQL_PORT ??
      env.DB_PORT_NUMBER ??
      env.DATABASE_PORT,
    name:
      env.DB_NAME ??
      env.PGDATABASE ??
      env.MYSQL_DATABASE ??
      env.DB_DATABASE ??
      env.DATABASE_NAME,
    user:
      env.DB_USER ??
      env.PGUSER ??
      env.MYSQL_USER ??
      env.DB_USERNAME ??
      env.DATABASE_USER,
    pass:
      env.DB_PASS ??
      env.PGPASSWORD ??
      env.MYSQL_PASSWORD ??
      env.DB_PASSWORD ??
      env.DATABASE_PASSWORD,
  };
};

const getPoolConfigError = () => {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString) {
    return null;
  }

  const { host, port, name, user, pass } = resolveEnv();

  const missingVars = [
    ["DB_HOST", host],
    ["DB_PORT", port],
    ["DB_NAME", name],
    ["DB_USER", user],
    ["DB_PASS", pass],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missingVars.length > 0) {
    return `Missing database environment variables: ${missingVars.join(
      ", ",
    )}. Set DATABASE_URL or provide values for DB_* (or PG*, MYSQL*, DATABASE_*).`;
  }

  return null;
};

const getPool = () => {
  if (pool) {
    return pool;
  }
  const connectionString = process.env.DATABASE_URL;
  if (connectionString) {
    pool = new Pool({ connectionString });
    return pool;
  }

  const configError = getPoolConfigError();
  if (configError) {
    return null;
  }

  const { host, port, name, user, pass } = resolveEnv();
  if (!host || !port || !name || !user || !pass) {
    return null;
  }

  pool = new Pool({
    host,
    port: Number(port),
    database: name,
    user,
    password: pass,
  });
  return pool;
};

export { getPool, getPoolConfigError };
