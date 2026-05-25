-- Supabase Schema for Citation Safety Engine

-- 1. Citation Patterns
CREATE TABLE IF NOT EXISTS citation_patterns (
    id SERIAL PRIMARY KEY,
    pattern_name VARCHAR(100) NOT NULL UNIQUE,
    regex TEXT NOT NULL,
    format_template VARCHAR(255) NOT NULL,
    example VARCHAR(255) NOT NULL,
    jurisdiction VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Section Mappings (IPC -> BNS, CrPC -> BNSS, IEA -> BSA)
CREATE TABLE IF NOT EXISTS section_mappings (
    id SERIAL PRIMARY KEY,
    old_section VARCHAR(255) NOT NULL,
    new_section VARCHAR(255) NOT NULL,
    old_act VARCHAR(255) NOT NULL,
    new_act VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_old_act_section UNIQUE (old_section, old_act)
);

-- 3. Verification Cache
CREATE TABLE IF NOT EXISTS verification_cache (
    citation_text VARCHAR(255) PRIMARY KEY,
    verified_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) NOT NULL CHECK (status IN ('VERIFIED', 'NOT_FOUND', 'UNVERIFIED')),
    ik_doc_id VARCHAR(100),
    case_name TEXT,
    corrected_text VARCHAR(255)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_section_mappings_old ON section_mappings(old_section, old_act);
CREATE INDEX IF NOT EXISTS idx_verification_cache_status ON verification_cache(status);
