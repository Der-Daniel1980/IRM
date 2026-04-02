import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.APP_PORT ?? '3001', 10),
  env: process.env.APP_ENV ?? 'development',

  database: {
    url: process.env.DATABASE_URL,
  },

  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  },

  keycloak: {
    url: process.env.KEYCLOAK_URL ?? 'http://localhost:8080',
    realm: process.env.KEYCLOAK_REALM ?? 'irm',
    clientId: process.env.KEYCLOAK_CLIENT_ID ?? 'irm-backend',
    clientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
  },

  meilisearch: {
    host: process.env.MEILISEARCH_HOST ?? 'http://localhost:7700',
    apiKey: process.env.MEILISEARCH_API_KEY,
  },

  scheduling: {
    workDayStart: process.env.WORK_DAY_START ?? '07:00',
    workDayEnd: process.env.WORK_DAY_END ?? '17:00',
    bufferBetweenOrdersMin: parseInt(
      process.env.BUFFER_BETWEEN_ORDERS_MIN ?? '15',
      10,
    ),
  },
}));
