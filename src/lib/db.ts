import { Pool } from "pg";

const getPool = () => {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString) {
    return new Pool({ connectionString });
  }

  const {
    DB_HOST = "localhost",
    DB_PORT = "5432",
    DB_NAME = "produXdia",
    DB_USER = "postgres",
    DB_PASS = "1234",
  } = process.env;

  return new Pool({
    host: DB_HOST,
    port: Number(DB_PORT),
    database: DB_NAME,
    user: DB_USER,
    password: DB_PASS,
  });
};

const pool = getPool();

export { pool };
