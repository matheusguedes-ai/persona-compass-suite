-- #282 — people.avatar_url/banner_url guardavam a URL "pública" inteira que
-- getPublicUrl() monta (https://<projeto>.supabase.co/storage/v1/object/public/<bucket>/<caminho>),
-- que nunca funcionou sozinha (o bucket 'avatares' é privado). Passa a
-- guardar só o identificador interno <bucket>/<caminho>, que é o que
-- storage-assinado.server.ts (partirUrl) sabe assinar na hora de exibir.
-- regexp_replace extrai bucket+caminho sem precisar copiar cada valor à mão;
-- idempotente (não muda linha que já estiver no formato novo ou for null).
update public.people
set avatar_url = regexp_replace(avatar_url, '^https://[^/]+/storage/v1/object/public/', ''),
    banner_url = regexp_replace(banner_url, '^https://[^/]+/storage/v1/object/public/', '')
where avatar_url like 'https://%/storage/v1/object/public/%'
   or banner_url like 'https://%/storage/v1/object/public/%';
