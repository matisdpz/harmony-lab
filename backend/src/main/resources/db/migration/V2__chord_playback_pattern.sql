-- How each saved chord is played back (block chord, arpeggio, ...). Existing chords keep the block sound.
ALTER TABLE project_chords
    ADD COLUMN pattern VARCHAR(20) NOT NULL DEFAULT 'BLOCK'
        CONSTRAINT project_chords_pattern_check CHECK (pattern IN (
            'BLOCK', 'ARPEGGIO_UP', 'ARPEGGIO_DOWN', 'ARPEGGIO_UP_DOWN', 'ALBERTI', 'REPEATED', 'BASS_CHORD'));
