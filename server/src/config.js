import 'dotenv/config';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  host: process.env.HOST || '0.0.0.0',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  databaseUrl: process.env.DATABASE_URL || 'file:./prisma/dev.db',
  uploadDir: resolve(__dirname, '..', process.env.UPLOAD_DIR || './uploads'),
  nodeEnv: process.env.NODE_ENV || 'development',
};
