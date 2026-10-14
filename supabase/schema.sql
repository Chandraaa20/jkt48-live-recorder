-- ==============================================================================
-- JKT48 Live & Cloud Recorder - Supabase Database Migration
-- ==============================================================================

-- 1. Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Drop existing tables if re-running migration cleanly
DROP TABLE IF EXISTS recordings CASCADE;
DROP TABLE IF EXISTS active_lives CASCADE;
DROP TABLE IF EXISTS member_platforms CASCADE;
DROP TABLE IF EXISTS members CASCADE;

-- 3. Create Table: members
CREATE TABLE members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    nickname TEXT,
    generation INT,
    avatar_url TEXT,
    is_notify BOOLEAN NOT NULL DEFAULT true,
    is_auto_record BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Create Table: member_platforms
-- Modular design supporting multiple live streaming platforms per member
CREATE TABLE member_platforms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('idn', 'showroom', 'youtube', 'tiktok', 'other')),
    external_id TEXT NOT NULL, -- username IDN or room_id Showroom
    room_url_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(member_id, platform, external_id)
);

-- 5. Create Table: active_lives
-- Real-time tracking of members currently streaming
CREATE TABLE active_lives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    platform TEXT NOT NULL, -- 'idn' or 'showroom'
    title TEXT,
    stream_url TEXT NOT NULL, -- HLS stream URL (.m3u8)
    thumbnail_url TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    is_recording BOOLEAN NOT NULL DEFAULT false
);

-- 6. Create Table: recordings
-- Archive of cloud recordings (in-progress and completed)
CREATE TABLE recordings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    title TEXT,
    status TEXT NOT NULL CHECK (status IN ('recording', 'uploading', 'completed', 'failed')),
    video_url TEXT,
    file_size_mb NUMERIC(10, 2) DEFAULT 0,
    duration_seconds INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. Performance Indexes
CREATE INDEX idx_members_is_auto_record ON members(is_auto_record);
CREATE INDEX idx_members_is_notify ON members(is_notify);
CREATE INDEX idx_member_platforms_member_id ON member_platforms(member_id);
CREATE INDEX idx_member_platforms_platform_external ON member_platforms(platform, external_id);
CREATE INDEX idx_active_lives_member_id ON active_lives(member_id);
CREATE INDEX idx_active_lives_started_at ON active_lives(started_at DESC);
CREATE INDEX idx_recordings_member_id ON recordings(member_id);
CREATE INDEX idx_recordings_status ON recordings(status);
CREATE INDEX idx_recordings_created_at ON recordings(created_at DESC);

-- 8. Enable Row Level Security (RLS)
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_lives ENABLE ROW LEVEL SECURITY;
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;

-- Allow public read/write for client application & automation workers
-- (Can be restricted further with authentication when needed)
CREATE POLICY "Allow public read access to members" ON members FOR SELECT USING (true);
CREATE POLICY "Allow public insert to members" ON members FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to members" ON members FOR UPDATE USING (true);
CREATE POLICY "Allow public delete to members" ON members FOR DELETE USING (true);

CREATE POLICY "Allow public read access to member_platforms" ON member_platforms FOR SELECT USING (true);
CREATE POLICY "Allow public insert to member_platforms" ON member_platforms FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to member_platforms" ON member_platforms FOR UPDATE USING (true);
CREATE POLICY "Allow public delete to member_platforms" ON member_platforms FOR DELETE USING (true);

CREATE POLICY "Allow public read access to active_lives" ON active_lives FOR SELECT USING (true);
CREATE POLICY "Allow public insert to active_lives" ON active_lives FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to active_lives" ON active_lives FOR UPDATE USING (true);
CREATE POLICY "Allow public delete to active_lives" ON active_lives FOR DELETE USING (true);

CREATE POLICY "Allow public read access to recordings" ON recordings FOR SELECT USING (true);
CREATE POLICY "Allow public insert to recordings" ON recordings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to recordings" ON recordings FOR UPDATE USING (true);
CREATE POLICY "Allow public delete to recordings" ON recordings FOR DELETE USING (true);

-- 9. Enable Realtime Publications for instant updates
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE members;
    ALTER PUBLICATION supabase_realtime ADD TABLE active_lives;
    ALTER PUBLICATION supabase_realtime ADD TABLE recordings;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN undefined_object THEN null;
END $$;

-- 10. Initial Seed Data (Popular JKT48 Members + Platforms + Sample Live & Archive)
DO $$
DECLARE
    freya_id UUID := gen_random_uuid();
    christy_id UUID := gen_random_uuid();
    marsha_id UUID := gen_random_uuid();
    feni_id UUID := gen_random_uuid();
    gita_id UUID := gen_random_uuid();
    gracia_id UUID := gen_random_uuid();
    muthe_id UUID := gen_random_uuid();
    kathrina_id UUID := gen_random_uuid();
BEGIN
    -- Insert Members
    INSERT INTO members (id, name, nickname, generation, avatar_url, is_notify, is_auto_record) VALUES
    (freya_id, 'Freya Jayawardana', 'Freya', 7, 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&h=300&fit=crop&crop=faces', true, true),
    (christy_id, 'Angelina Christy', 'Christy', 7, 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&h=300&fit=crop&crop=faces', true, true),
    (marsha_id, 'Marsha Lenathea', 'Marsha', 9, 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=300&h=300&fit=crop&crop=faces', true, false),
    (feni_id, 'Feni Fitriyanti', 'Feni', 3, 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&h=300&fit=crop&crop=faces', true, true),
    (gita_id, 'Gita Sekar Andarini', 'Gita', 6, 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=300&h=300&fit=crop&crop=faces', false, false),
    (gracia_id, 'Shania Gracia', 'Gracia', 3, 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=300&h=300&fit=crop&crop=faces', true, true),
    (muthe_id, 'Mutiara Azzahra', 'Muthe', 7, 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&h=300&fit=crop&crop=faces', true, false),
    (kathrina_id, 'Kathrina Irene', 'Kathrina', 9, 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&h=300&fit=crop&crop=faces', true, false);

    -- Insert Member Platforms (Modular: IDN & Showroom)
    INSERT INTO member_platforms (member_id, platform, external_id, room_url_key) VALUES
    (freya_id, 'idn', 'jkt48_freya', 'jkt48_freya'),
    (freya_id, 'showroom', '318204', 'JKT48_Freya'),
    (christy_id, 'idn', 'jkt48_christy', 'jkt48_christy'),
    (christy_id, 'showroom', '318117', 'JKT48_Christy'),
    (marsha_id, 'idn', 'jkt48_marsha', 'jkt48_marsha'),
    (marsha_id, 'showroom', '318227', 'JKT48_Marsha'),
    (feni_id, 'idn', 'jkt48_feni', 'jkt48_feni'),
    (feni_id, 'showroom', '318119', 'JKT48_Feni'),
    (gita_id, 'idn', 'jkt48_gita', 'jkt48_gita'),
    (gita_id, 'showroom', '318210', 'JKT48_Gita'),
    (gracia_id, 'idn', 'jkt48_gracia', 'jkt48_gracia'),
    (gracia_id, 'showroom', '318121', 'JKT48_Gracia'),
    (muthe_id, 'idn', 'jkt48_muthe', 'jkt48_muthe'),
    (muthe_id, 'showroom', '318231', 'JKT48_Muthe'),
    (kathrina_id, 'idn', 'jkt48_kathrina', 'jkt48_kathrina'),
    (kathrina_id, 'showroom', '318224', 'JKT48_Kathrina');

    -- Insert Sample Active Live (Stream Test HLS URL)
    INSERT INTO active_lives (member_id, platform, title, stream_url, thumbnail_url, started_at, is_recording) VALUES
    (freya_id, 'idn', 'Malam mingguan bareng Freya! ✨', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&h=340&fit=crop', now() - interval '24 minutes', true),
    (marsha_id, 'showroom', 'Ngobrol santai dulu yaa~ 🌸', 'https://test-streams.mux.dev/test_001/stream.m3u8', 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&h=340&fit=crop', now() - interval '8 minutes', false);

    -- Insert Sample Recordings (Completed and In-Progress)
    INSERT INTO recordings (member_id, platform, title, status, video_url, file_size_mb, duration_seconds, created_at) VALUES
    (freya_id, 'idn', 'Malam mingguan bareng Freya! ✨ [Sesi Aktif]', 'recording', '', 142.50, 1440, now() - interval '24 minutes'),
    (christy_id, 'idn', 'Cerita hari ini & persiapan theater 🎀', 'completed', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', 458.20, 3620, now() - interval '1 day'),
    (feni_id, 'showroom', 'Showroom spesial Q&A malam 🌙', 'completed', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', 382.10, 2940, now() - interval '2 days'),
    (gracia_id, 'idn', 'Live sehabis latihan show JKT48 💃', 'completed', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', 620.80, 4810, now() - interval '3 days');

END $$;
