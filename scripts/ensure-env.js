#!/usr/bin/env node
/**
 * После клонирования из Git файла .env нет (он не в репозитории).
 * Скрипт копирует .env.example в .env, если .env отсутствует.
 * Запускается из package.json postinstall.
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const envPath = path.join(root, ".env");
const examplePath = path.join(root, ".env.example");

if (!fs.existsSync(envPath) && fs.existsSync(examplePath)) {
  fs.copyFileSync(examplePath, envPath);
  console.log("[setup] Создан .env из .env.example. Проверьте NEXT_PUBLIC_REWARDS_API_URL и NEXT_PUBLIC_DEV_USER_ID.");
}
