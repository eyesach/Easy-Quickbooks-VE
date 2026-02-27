-- ============================================================
-- Supabase Setup for Group Sync (with Authentication)
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Groups table
CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Group members (with password auth and roles)
CREATE TABLE group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(group_id, display_name)
);

-- 3. Version metadata (blobs stored in Supabase Storage)
CREATE TABLE versions (
    id SERIAL PRIMARY KEY,
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    saved_by TEXT NOT NULL,
    saved_at TIMESTAMPTZ DEFAULT NOW(),
    size_bytes INTEGER NOT NULL,
    storage_path TEXT NOT NULL,
    UNIQUE(group_id, version)
);

CREATE INDEX idx_versions_group_version ON versions(group_id, version DESC);

-- 4. Row Level Security
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on groups" ON groups FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
-- Only allow SELECT directly — all mutations go through SECURITY DEFINER RPCs
CREATE POLICY "Allow select on group_members" ON group_members FOR SELECT USING (true);

ALTER TABLE versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on versions" ON versions FOR ALL USING (true) WITH CHECK (true);

-- 5. Atomic push_version RPC (prevents race conditions)
CREATE OR REPLACE FUNCTION push_version(
    p_group_id UUID,
    p_base_version INTEGER,
    p_saved_by TEXT,
    p_size_bytes INTEGER,
    p_storage_path TEXT
) RETURNS INTEGER AS $$
DECLARE
    v_current INTEGER;
    v_new INTEGER;
    v_lock_key BIGINT;
BEGIN
    v_lock_key := ('x' || left(replace(p_group_id::text, '-', ''), 15))::bit(60)::bigint;
    PERFORM pg_advisory_xact_lock(v_lock_key);

    SELECT COALESCE(MAX(version), 0) INTO v_current
    FROM versions WHERE group_id = p_group_id;

    IF v_current != p_base_version THEN
        RAISE EXCEPTION 'VERSION_CONFLICT:% ', v_current;
    END IF;

    v_new := v_current + 1;

    INSERT INTO versions (group_id, version, saved_by, size_bytes, storage_path)
    VALUES (p_group_id, v_new, p_saved_by, p_size_bytes, p_storage_path);

    RETURN v_new;
END;
$$ LANGUAGE plpgsql;

-- 6. Register a new member (hashes password server-side)
CREATE OR REPLACE FUNCTION register_member(
    p_group_id UUID,
    p_display_name TEXT,
    p_password TEXT,
    p_role TEXT DEFAULT 'member'
) RETURNS JSONB AS $$
DECLARE
    v_new_id UUID;
BEGIN
    IF p_role NOT IN ('admin', 'member') THEN
        RAISE EXCEPTION 'INVALID_ROLE:Role must be admin or member';
    END IF;

    INSERT INTO group_members (group_id, display_name, password_hash, role)
    VALUES (p_group_id, p_display_name, crypt(p_password, gen_salt('bf')), p_role)
    RETURNING id INTO v_new_id;

    RETURN jsonb_build_object(
        'id', v_new_id,
        'group_id', p_group_id,
        'display_name', p_display_name,
        'role', p_role
    );
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION 'MEMBER_EXISTS:A member with this name already exists in the group';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Authenticate an existing member (verify password)
CREATE OR REPLACE FUNCTION authenticate_member(
    p_group_id UUID,
    p_display_name TEXT,
    p_password TEXT
) RETURNS JSONB AS $$
DECLARE
    v_member RECORD;
BEGIN
    SELECT id, group_id, display_name, password_hash, role, joined_at
    INTO v_member
    FROM group_members
    WHERE group_id = p_group_id AND display_name = p_display_name;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    IF v_member.password_hash = crypt(p_password, v_member.password_hash) THEN
        RETURN jsonb_build_object(
            'id', v_member.id,
            'group_id', v_member.group_id,
            'display_name', v_member.display_name,
            'role', v_member.role,
            'joined_at', v_member.joined_at
        );
    ELSE
        RAISE EXCEPTION 'INVALID_PASSWORD:Incorrect password for this username';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Verify a member still exists (for page-reload reconnect)
CREATE OR REPLACE FUNCTION verify_member(
    p_group_id UUID,
    p_member_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_member RECORD;
BEGIN
    SELECT id, group_id, display_name, role
    INTO v_member
    FROM group_members
    WHERE group_id = p_group_id AND id = p_member_id;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    RETURN jsonb_build_object(
        'id', v_member.id,
        'group_id', v_member.group_id,
        'display_name', v_member.display_name,
        'role', v_member.role
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Remove a member (admin only)
CREATE OR REPLACE FUNCTION remove_member(
    p_group_id UUID,
    p_member_id UUID,
    p_admin_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_admin_role TEXT;
BEGIN
    SELECT role INTO v_admin_role
    FROM group_members
    WHERE group_id = p_group_id AND id = p_admin_id;

    IF v_admin_role IS NULL OR v_admin_role != 'admin' THEN
        RAISE EXCEPTION 'NOT_ADMIN:Only admins can remove members';
    END IF;

    IF p_member_id = p_admin_id THEN
        RAISE EXCEPTION 'CANNOT_REMOVE_SELF:Admins cannot remove themselves';
    END IF;

    DELETE FROM group_members
    WHERE group_id = p_group_id AND id = p_member_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'MEMBER_NOT_FOUND:Member not found in this group';
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. List all members of a group (no password hashes)
CREATE OR REPLACE FUNCTION list_members(
    p_group_id UUID
) RETURNS JSONB AS $$
BEGIN
    RETURN COALESCE((
        SELECT jsonb_agg(
            jsonb_build_object(
                'id', gm.id,
                'display_name', gm.display_name,
                'role', gm.role,
                'joined_at', gm.joined_at
            ) ORDER BY gm.joined_at ASC
        )
        FROM group_members gm
        WHERE gm.group_id = p_group_id
    ), '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- STORAGE SETUP (do these in the Supabase Dashboard UI):
--
-- 1. Go to Storage → Create a new bucket called "db-blobs"
-- 2. Set it to PUBLIC (or add these policies below)
-- ============================================================

-- Storage policies (run after creating the bucket)
CREATE POLICY "Allow uploads to db-blobs"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'db-blobs');

CREATE POLICY "Allow reads from db-blobs"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'db-blobs');

-- ============================================================
-- MIGRATION: If upgrading from a previous version without auth,
-- run these ALTER statements instead of recreating the table:
--
-- ALTER TABLE group_members ADD COLUMN password_hash TEXT NOT NULL DEFAULT '';
-- ALTER TABLE group_members ADD COLUMN role TEXT NOT NULL DEFAULT 'member';
-- ALTER TABLE group_members ADD CONSTRAINT uq_group_member_name UNIQUE (group_id, display_name);
-- DROP POLICY IF EXISTS "Allow all on group_members" ON group_members;
-- CREATE POLICY "Allow select on group_members" ON group_members FOR SELECT USING (true);
-- ============================================================
