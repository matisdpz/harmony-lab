package com.harmonylab.project;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Embeddable;

import java.util.List;

/** One chord of a saved progression. Its position is stored by the owning list's order column. */
@Embeddable
public class ProjectChord {

    @Column(name = "root", nullable = false, length = 3)
    private String root;

    @Column(name = "quality", nullable = false, length = 24)
    private String quality;

    @Column(name = "inversion", nullable = false)
    private int inversion;

    @Convert(converter = VoicingConverter.class)
    @Column(name = "voicing", nullable = false, length = 64)
    private List<Integer> voicing;

    @Column(name = "duration_beats", nullable = false)
    private int durationBeats;

    @Column(name = "pattern", nullable = false, length = 20)
    private String pattern;

    protected ProjectChord() {
    }

    public ProjectChord(String root, String quality, int inversion, List<Integer> voicing, int durationBeats, String pattern) {
        this.root = root;
        this.quality = quality;
        this.inversion = inversion;
        this.voicing = List.copyOf(voicing);
        this.durationBeats = durationBeats;
        this.pattern = pattern;
    }

    public String getRoot() {
        return root;
    }

    public String getQuality() {
        return quality;
    }

    public int getInversion() {
        return inversion;
    }

    public List<Integer> getVoicing() {
        return voicing;
    }

    public int getDurationBeats() {
        return durationBeats;
    }

    public String getPattern() {
        return pattern;
    }
}
