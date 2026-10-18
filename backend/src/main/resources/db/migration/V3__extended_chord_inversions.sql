-- Extended and altered chords have up to six tones, so up to five inversions.
ALTER TABLE project_chords DROP CONSTRAINT project_chords_inversion_check;
ALTER TABLE project_chords ADD CONSTRAINT project_chords_inversion_check CHECK (inversion BETWEEN 0 AND 5);
