-- A criacao de perfis agora e coordenada pela Edge Function profile-access.
-- Isso evita que uma falha de perfil invalide a criacao do usuario tecnico.

drop trigger if exists criar_perfil_apos_cadastro on auth.users;

