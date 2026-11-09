-- Avisos por Telegram para usuarios reales.
-- Un bot de Telegram solo le escribe a quien tocó "Iniciar": cuando eso pasa, el webhook
-- (`app/api/telegram/webhook`) guarda el `chat_id` de esa conversación.
--   - La freelancer tiene usuario: va en `users.telegram_chat_id`.
--   - El cliente no tiene usuario propio: va en `agreements.client_telegram_chat_id`.
-- Solo agrega columnas: no borra ni cambia datos. Se puede correr varias veces.

alter table users add column if not exists telegram_chat_id text;
alter table agreements add column if not exists client_telegram_chat_id text;
