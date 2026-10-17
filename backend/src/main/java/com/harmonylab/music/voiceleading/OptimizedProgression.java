package com.harmonylab.music.voiceleading;

import com.harmonylab.music.Chord;
import com.harmonylab.music.Voicing;

import java.util.List;

public record OptimizedProgression(List<Chord> chords, List<Voicing> voicings, double totalCost, int totalMovement) {
}
