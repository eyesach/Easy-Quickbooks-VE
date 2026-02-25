-- ============================================================
-- Supabase Setup for Group Sync
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. Groups table
CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Group members (no auth, just display names)
CREATE TABLE group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    joined_at TIMESTAMPTZ DEFAULT NOW()
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

-- 4. Row Level Security (permissive — no auth)
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on groups" ON groups FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on group_members" ON group_members FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on versions" ON versions FOR ALL USING (true) WITH CHECK (true);

-- 5. Atomic push_version RPC (prevents race conditions)
-- Uses advisory lock on the group to serialize pushes, then checks version.
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
    -- Advisory lock based on group ID to serialize concurrent pushes
    v_lock_key := ('x' || left(replace(p_group_id::text, '-', ''), 15))::bit(60)::bigint;
    PERFORM pg_advisory_xact_lock(v_lock_key);

    -- Get current max version
    SELECT COALESCE(MAX(version), 0) INTO v_current
    FROM versions WHERE group_id = p_group_id;

    -- Optimistic lock check
    IF v_current != p_base_version THEN
        RAISE EXCEPTION 'VERSION_CONFLICT:% ', v_current;
    END IF;

    v_new := v_current + 1;

    INSERT INTO versions (group_id, version, saved_by, size_bytes, storage_path)
    VALUES (p_group_id, v_new, p_saved_by, p_size_bytes, p_storage_path);

    RETURN v_new;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- STORAGE SETUP (do these in the Supabase Dashboard UI):
--
-- 1. Go to Storage → Create a new bucket called "db-blobs"
-- 2. Set it to PUBLIC (or add these policies below)
-- ============================================================

-- Storage policies (run after creating the bucket)
-- Allow anyone to upload
CREATE POLICY "Allow uploads to db-blobs"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'db-blobs');

-- Allow anyone to read
CREATE POLICY "Allow reads from db-blobs"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'db-blobs');
