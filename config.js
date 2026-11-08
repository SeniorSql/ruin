// Настройки подключения к Supabase.
// С 08.11.2026 — свой сервер в РФ (152-ФЗ): https://api.ru-in.ru (self-hosted Supabase, AdminVPS).
// Ключ anon публичный, его можно хранить здесь. Ключ service_role сюда НЕ вставлять.
// Откат на облако: архив-обновлений/config.cloud-backup.js
window.RUIN_CONFIG = {
  SUPABASE_URL: 'https://api.ru-in.ru',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzk0MDU0NTQ0LCJleHAiOjE5NTE3MzQ1NDR9.WudJVLtpJbkGs7BDzqoqHUaNDP-sJDjaO54IdkjrZBk'
};
