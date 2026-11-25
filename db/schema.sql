-- Run once on the Postgres (Neon) database.
create table if not exists chats (
  id          text primary key,
  share_token text unique,
  created_at  timestamptz not null default now(),
  paid        boolean not null default false,
  report_at   timestamptz,
  data        jsonb not null,
  messages_gz text            -- gzip+base64 of the parsed messages; nulled by the cleanup job
);
create index if not exists chats_cleanup on chats (paid, created_at);

create table if not exists otps (
  email      text primary key,
  hash       text not null,
  expires_at timestamptz not null,
  tries      int not null default 0
);
