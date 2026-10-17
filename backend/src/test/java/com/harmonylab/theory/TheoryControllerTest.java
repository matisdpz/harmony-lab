package com.harmonylab.theory;

import com.harmonylab.api.ApiExceptionHandler;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.greaterThan;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** HTTP-level tests of the theory endpoints (no database needed). */
@WebMvcTest(TheoryController.class)
@Import({TheoryService.class, ApiExceptionHandler.class})
class TheoryControllerTest {

    private static final String PROGRESSION = """
            "key":{"tonic":"C","mode":"MAJOR"},
            "chords":[
              {"root":"A","quality":"MINOR","voicing":[57,60,64]},
              {"root":"F","quality":"MAJOR","voicing":[57,60,65],"inversion":1},
              {"root":"C","quality":"MAJOR","voicing":[55,60,64],"inversion":2},
              {"root":"G","quality":"MAJOR","voicing":[55,59,62]}]""";

    @Autowired
    MockMvc mvc;

    private ResultActions postJson(String url, String body) throws Exception {
        return mvc.perform(post(url).contentType(MediaType.APPLICATION_JSON).content(body));
    }

    @Test
    void catalogListsAllQualities() throws Exception {
        mvc.perform(get("/api/theory/catalog"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.qualities", hasSize(15)))
                .andExpect(jsonPath("$.qualities[0].id").value("MAJOR"))
                .andExpect(jsonPath("$.objectives", hasSize(4)))
                .andExpect(jsonPath("$.pitchConvention", containsString("C4")));
    }

    @Test
    void resolvesAChordWithVoicingInversionsAndKeyRelation() throws Exception {
        postJson("/api/theory/chords/resolve", """
                {"root":"G","quality":"DOMINANT7","inversion":1,"key":{"tonic":"C","mode":"MAJOR"}}""")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.chord.symbol").value("G7/B"))
                .andExpect(jsonPath("$.chord.intervals[3].name").value("m7"))
                .andExpect(jsonPath("$.chord.voicing[0]").value(59))
                .andExpect(jsonPath("$.inversions", hasSize(4)))
                .andExpect(jsonPath("$.relation.label").value("V6/5"))
                .andExpect(jsonPath("$.relation.function").value("DOMINANT"));
    }

    @Test
    void voiceLeadsFromAPreviousVoicingWhenRequested() throws Exception {
        postJson("/api/theory/chords/resolve", """
                {"root":"F","quality":"MAJOR","inversion":2,"previousVoicing":[60,64,67]}""")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.chord.voicing[0]").value(60))
                .andExpect(jsonPath("$.chord.voicing[1]").value(65))
                .andExpect(jsonPath("$.chord.voicing[2]").value(69));
    }

    @Test
    void parsesSymbolsAndReportsInvalidOnes() throws Exception {
        postJson("/api/theory/chords/parse", "{\"symbol\":\"Bbmaj7/D\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.chord.root").value("Bb"))
                .andExpect(jsonPath("$.chord.inversion").value(1));
        postJson("/api/theory/chords/parse", "{\"symbol\":\"Cmaj13#11\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("symbol"))
                .andExpect(jsonPath("$.errors[0].message", containsString("Unsupported chord quality")));
    }

    @Test
    void identifiesAmbiguousNoteSets() throws Exception {
        postJson("/api/theory/chords/identify", "{\"midiNotes\":[57,60,64,67]}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.candidates", hasSize(2)))
                .andExpect(jsonPath("$.candidates[0].chord.symbol").value("Am7"))
                .andExpect(jsonPath("$.message", containsString("ambiguous")));
    }

    @Test
    void describesKeys() throws Exception {
        mvc.perform(get("/api/theory/keys").param("tonic", "Eb").param("mode", "MAJOR"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.signatureText").value("3 flats"))
                .andExpect(jsonPath("$.triads[4].chord.symbol").value("Bb"))
                .andExpect(jsonPath("$.sevenths[4].roman").value("V7"));
        mvc.perform(get("/api/theory/keys").param("tonic", "G#").param("mode", "MAJOR"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].message", containsString("theoretical")));
    }

    @Test
    void analysesAProgression() throws Exception {
        postJson("/api/theory/analyze", "{" + PROGRESSION + "}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.chords[0].label").value("vi"))
                .andExpect(jsonPath("$.chords[3].label").value("V"))
                .andExpect(jsonPath("$.metrics.diatonicCount").value(4))
                .andExpect(jsonPath("$.metrics.cadence").value("half cadence (ends on V)"))
                .andExpect(jsonPath("$.transitions", hasSize(3)))
                .andExpect(jsonPath("$.transitions[0].voiceLeading.totalMovement").value(1))
                .andExpect(jsonPath("$.observations[0].kind").value("FACT"));
    }

    @Test
    void rejectsEmptyProgressionsAndMismatchedVoicings() throws Exception {
        postJson("/api/theory/analyze", "{\"key\":{\"tonic\":\"C\",\"mode\":\"MAJOR\"},\"chords\":[]}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("chords"));
        postJson("/api/theory/analyze", """
                {"key":{"tonic":"C","mode":"MAJOR"},"chords":[{"root":"C","quality":"MAJOR","voicing":[61,64,67]}]}""")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("chords[0].voicing"));
    }

    @Test
    void ranksVoiceLeadingCandidates() throws Exception {
        postJson("/api/theory/voice-leading", """
                {"fromVoicing":[60,64,67],"target":{"root":"F","quality":"MAJOR"},"limit":3}""")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.candidates", hasSize(3)))
                .andExpect(jsonPath("$.candidates[0].chord.voicing[1]").value(65))
                .andExpect(jsonPath("$.candidates[0].voiceLeading.totalMovement").value(3))
                .andExpect(jsonPath("$.costFunction", containsString("crossings")));
        postJson("/api/theory/voice-leading", """
                {"fromVoicing":[60,64,67],"target":{"root":"G","quality":"MAJOR"},"allowInversions":false,
                 "register":{"low":60,"high":72}}""")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Invalid musical input"));
    }

    @Test
    void spellsMotionsWithTheChordsOwnSpelling() throws Exception {
        postJson("/api/theory/voice-leading", """
                {"fromVoicing":[53,60,69],"fromChord":{"root":"F","quality":"MAJOR"},
                 "target":{"root":"E","quality":"DOMINANT7"},"limit":1}""")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.candidates[0].voiceLeading.motions[?(@.to == 68)].toNote").value("G#4"))
                .andExpect(jsonPath("$.candidates[0].voiceLeading.motions[0].fromNote").value("F3"));
    }

    @Test
    void optimisesWholeProgressions() throws Exception {
        postJson("/api/theory/voice-leading/optimize", """
                {"chords":[{"root":"C","quality":"MAJOR","voicing":[60,64,67]},{"root":"A","quality":"MINOR"},
                           {"root":"F","quality":"MAJOR"},{"root":"G","quality":"MAJOR"}]}""")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.chords", hasSize(4)))
                .andExpect(jsonPath("$.chords[0].voicing[0]").value(60));
    }

    @Test
    void suggestsExplainedAlternatives() throws Exception {
        postJson("/api/theory/suggestions", "{" + PROGRESSION + ",\"selectedIndex\":1,\"objective\":\"DIATONIC_ALTERNATIVES\",\"limit\":4}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.suggestions", hasSize(4)))
                .andExpect(jsonPath("$.suggestions[0].category").value("DIATONIC"))
                .andExpect(jsonPath("$.suggestions[0].reasons.length()").value(greaterThan(0)))
                .andExpect(jsonPath("$.message", containsString("heuristic")));
        postJson("/api/theory/suggestions", "{" + PROGRESSION + ",\"selectedIndex\":9}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("selectedIndex"));
    }

    @Test
    void generatesComparableAlternatives() throws Exception {
        postJson("/api/theory/alternatives", "{" + PROGRESSION + "}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.current.chordCount").value(4))
                .andExpect(jsonPath("$.alternatives[0].title").value("Smoothest voicings"))
                .andExpect(jsonPath("$.alternatives[0].metrics.totalVoiceMovement").exists());
    }
}
