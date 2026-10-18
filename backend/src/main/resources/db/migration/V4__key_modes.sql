-- Keys can be any of the nine supported modes (major, the three minors and the church modes).
ALTER TABLE projects ALTER COLUMN key_mode TYPE VARCHAR(20);
ALTER TABLE projects DROP CONSTRAINT projects_key_mode_check;
ALTER TABLE projects ADD CONSTRAINT projects_key_mode_check CHECK (key_mode IN (
    'MAJOR', 'MINOR', 'HARMONIC_MINOR', 'MELODIC_MINOR', 'DORIAN', 'PHRYGIAN', 'LYDIAN', 'MIXOLYDIAN', 'LOCRIAN'));
