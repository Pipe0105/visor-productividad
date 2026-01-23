const dbConfig = {
  host: process.env.DB_HOST ?? "192.168.35.232",
  port: Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME ?? "produXdia",
  user: process.env.DB_USER ?? "postgres",
  password: process.env.DB_PASSWORD ?? "Nomiplus2014$%",
  schema: process.env.DB_SCHEMA ?? "public",
};

let pool: {
  connect: () => Promise<{
    query: (sql: string) => Promise<void>;
    release: () => void;
  }>;
} | null = null;

export const getDbPool = async () => {
  if (!pool) {
    try {
      const { Pool } = await import("pg");
      pool = new Pool({
        host: dbConfig.host,
        port: dbConfig.port,
        database: dbConfig.database,
        user: dbConfig.user,
        password: dbConfig.password,
        options: `-c search_path=${dbConfig.schema}`,
      });
    } catch (error) {
      throw new Error(
        "No se pudo cargar el cliente de PostgreSQL. Instala la dependencia 'pg' para habilitar la conexión.",
      );
    }
  }
  return pool;
};

export const testDbConnection = async () => {
  const client = await (await getDbPool()).connect();
  try {
    await client.query("SELECT 1");
  } finally {
    client.release();
  }
};
