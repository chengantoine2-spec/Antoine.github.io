-- ============================================================
-- 焦糖布丁博客站 · Supabase 数据库结构
-- 在 Supabase Dashboard → SQL Editor 里整段执行即可（幂等，可重复跑）。
--
-- 权限模型：
--   anon        未登录：只能读文章（GitHub Issues）与评论
--   user        普通用户：可评论、可管理自己的物品台账；不能改角色、不能改别人的东西
--   admin       管理员：所有权限（含改角色/封禁/管理全部评论与资产）
-- 角色与封禁的强制点在数据库（RLS + 触发器），前端改代码绕不过去。
-- ============================================================

-- ---------- 1. profiles：用户名、角色、封禁 ----------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  username   text not null unique check (char_length(username) between 2 and 24),
  role       text not null default 'user' check (role in ('admin', 'user')),
  banned     boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- 判断是否管理员（security definer：绕过 RLS 自查，避免策略递归）
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid and p.role = 'admin' and not p.banned
  );
$$;

-- 判断账号是否可用（未被封禁）
create or replace function public.is_active(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.profiles p where p.id = uid and not p.banned);
$$;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles
  for select using (true);              -- 公开读：只暴露用户名/角色/注册时间，不含邮箱

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- 防提权：非管理员不能改自己的 role / banned / id
-- 注意：直接 SQL / service_role（Dashboard、迁移脚本、下面的提权 SQL）不带 JWT，
-- auth.uid() 为 null，此时放行 —— 这类请求不经过 anon/authenticated 角色，
-- 而 RLS 策略对 uid 为 null 的请求本来就匹配不到任何行，因此不会成为提权入口。
create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if public.is_admin(auth.uid()) then
    return new;
  end if;
  if new.role is distinct from old.role
     or new.banned is distinct from old.banned
     or new.id is distinct from old.id then
    raise exception '只有管理员可以修改角色或封禁状态';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard
  before update on public.profiles
  for each row execute function public.guard_profile_update();

-- 注册时自动建 profile，角色固定为 user（绝不信任前端传值）
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uname text;
begin
  uname := nullif(trim(new.raw_user_meta_data ->> 'username'), '');
  if uname is null then
    uname := split_part(new.email, '@', 1);
  end if;
  begin
    insert into public.profiles (id, username) values (new.id, uname);
  exception when unique_violation then
    insert into public.profiles (id, username)
    values (new.id, uname || '-' || substr(new.id::text, 1, 4));
  end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- 2. comments：注册用户评论（替代 Giscus） ----------
create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  blog_id    integer not null,                       -- 对应 GitHub Issue number
  user_id    uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 2000),
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists comments_blog_idx on public.comments (blog_id, created_at desc);
alter table public.comments enable row level security;

drop policy if exists comments_read on public.comments;
create policy comments_read on public.comments
  for select using (not is_deleted);

drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments
  for insert with check (auth.uid() = user_id and public.is_active(auth.uid()));

drop policy if exists comments_update_own on public.comments;
create policy comments_update_own on public.comments
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists comments_admin_all on public.comments;
create policy comments_admin_all on public.comments
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- 每篇文章的评论数（列表页用，避免逐篇查）
create or replace function public.comment_counts()
returns table (blog_id integer, total bigint)
language sql
security definer
set search_path = public
stable
as $$
  select c.blog_id, count(*)::bigint
  from public.comments c
  where not c.is_deleted
  group by c.blog_id;
$$;
grant execute on function public.comment_counts() to anon, authenticated;

-- ---------- 3. assets：普通用户自己的物品台账 ----------
create table if not exists public.assets (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 80),
  category     text not null default '其他',
  quantity     numeric(12, 2) not null default 1 check (quantity >= 0),
  unit         text not null default '件',
  unit_value   numeric(14, 2) check (unit_value >= 0),   -- 单价
  currency     text not null default 'CNY',
  purchased_at date,
  location     text,
  cover        text,                                     -- 图片 URL（img 分支 + jsDelivr）
  notes        text,
  tags         text[] not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists assets_owner_idx on public.assets (owner_id, created_at desc);
alter table public.assets enable row level security;

drop policy if exists assets_own on public.assets;
create policy assets_own on public.assets
  for all using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id and public.is_active(auth.uid()));

drop policy if exists assets_admin_read on public.assets;
create policy assets_admin_read on public.assets
  for select using (public.is_admin(auth.uid()));

drop policy if exists assets_admin_write on public.assets;
create policy assets_admin_write on public.assets
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- updated_at 自动维护
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists comments_touch on public.comments;
create trigger comments_touch before update on public.comments
  for each row execute function public.touch_updated_at();

drop trigger if exists assets_touch on public.assets;
create trigger assets_touch before update on public.assets
  for each row execute function public.touch_updated_at();

-- ---------- 4. 管理后台用的用户统计（仅管理员拿得到数据） ----------
create or replace function public.admin_user_stats()
returns table (user_id uuid, comments bigint, assets bigint, assets_value numeric)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception '需要管理员权限';
  end if;
  return query
    select p.id,
           (select count(*) from public.comments c where c.user_id = p.id and not c.is_deleted),
           (select count(*) from public.assets a where a.owner_id = p.id),
           (select coalesce(sum(a.quantity * coalesce(a.unit_value, 0)), 0)
              from public.assets a where a.owner_id = p.id)
    from public.profiles p;
end;
$$;
grant execute on function public.admin_user_stats() to authenticated;

-- ============================================================
-- 5. 首个管理员：先用某个用户名注册，然后把下面这行的用户名换掉再执行一次
-- ============================================================
-- update public.profiles set role = 'admin' where username = '你的用户名';

-- ============================================================
-- 6. 点赞（本期不做，留好表结构，将来直接启用）
-- ============================================================
-- create table if not exists public.likes (
--   blog_id integer not null,
--   user_id uuid not null references public.profiles (id) on delete cascade,
--   created_at timestamptz not null default now(),
--   primary key (blog_id, user_id)
-- );
-- alter table public.likes enable row level security;
-- create policy likes_read on public.likes for select using (true);
-- create policy likes_insert on public.likes for insert
--   with check (auth.uid() = user_id and public.is_active(auth.uid()));
-- create policy likes_delete_own on public.likes for delete using (auth.uid() = user_id);
