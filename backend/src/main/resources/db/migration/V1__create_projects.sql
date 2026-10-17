-- Harmony Lab schema. Projects are single-user (no ownership column) by design for the MVP.

CREATE TABLE projects (
    id            UUID         PRIMARY KEY,
    name          VARCHAR(100) NOT NULL CHECK (length(trim(name)) > 0),
    key_tonic     VARCHAR(3)   NOT NULL CHECK (key_tonic ~ '^[A-G](#|b)?$'),
    key_mode      VARCHAR(10)  NOT NULL CHECK (key_mode IN ('MAJOR', 'MINOR')),
    tempo_bpm     INTEGER      NOT NULL CHECK (tempo_bpm BETWEEN 30 AND 300),
    register_low  INTEGER      NOT NULL,
    register_high INTEGER      NOT NULL,
    version       BIGINT       NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ  NOT NULL,
    updated_at    TIMESTAMPTZ  NOT NULL,
    CONSTRAINT projects_register_range CHECK (
        register_low >= 21 AND register_high <= 108 AND register_high - register_low >= 12)
);

CREATE INDEX idx_projects_updated_at ON projects (updated_at DESC);

-- Chord order is explicit: (project_id, position) is the primary key, so two chords can never share a slot.
CREATE TABLE project_chords (
    project_id     UUID        NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    position       INTEGER     NOT NULL CHECK (position >= 0),
    root           VARCHAR(3)  NOT NULL CHECK (root ~ '^[A-G](##|bb|#|b)?$'),
    quality        VARCHAR(24) NOT NULL,
    inversion      INTEGER     NOT NULL CHECK (inversion BETWEEN 0 AND 3),
    voicing        VARCHAR(64) NOT NULL CHECK (voicing ~ '^[0-9]{1,3}(,[0-9]{1,3}){0,7}$'),
    duration_beats INTEGER     NOT NULL CHECK (duration_beats BETWEEN 1 AND 16),
    PRIMARY KEY (project_id, position)
);
