/** @type {import('next').NextConfig} */
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Подгружаем .env из корня проекта, чтобы NEXT_PUBLIC_* были доступны при сборке
const envPath = path.join(__dirname, '.env');
if (existsSync(envPath)) {
  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eq = trimmed.indexOf('=');
      if (eq > 0) {
        const key = trimmed.slice(0, eq).trim();
        const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
        if (key.startsWith('NEXT_PUBLIC_') && !process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

const nextConfig = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Явно пробрасываем переменные окружения в клиент (NEXT_PUBLIC_* подхватываются и из .env)
  env: {
    NEXT_PUBLIC_MYGIG_API_URL: process.env.NEXT_PUBLIC_MYGIG_API_URL ?? '',
  },
}

export default nextConfig
