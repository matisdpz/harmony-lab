package com.harmonylab.project;

import com.harmonylab.TestcontainersConfiguration;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class ProjectApiIT {

    private static final String AM = """
            {"root":"A","quality":"MINOR","inversion":0,"voicing":[57,60,64],"durationBeats":4}""";
    private static final String F = """
            {"root":"F","quality":"MAJOR","inversion":0,"voicing":[53,57,60],"durationBeats":4}""";
    private static final String C = """
            {"root":"C","quality":"MAJOR","inversion":0,"voicing":[60,64,67],"durationBeats":4}""";
    private static final String G7_FIRST_INVERSION = """
            {"root":"G","quality":"DOMINANT7","inversion":1,"voicing":[59,62,65,67],"durationBeats":2}""";

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcTemplate jdbc;

    @BeforeEach
    void cleanDatabase() {
        jdbc.update("DELETE FROM projects");
    }

    private static String project(String name, Long version, String... chords) {
        return """
                {"name":"%s","key":{"tonic":"C","mode":"MAJOR"},"tempoBpm":96,
                 "register":{"low":45,"high":79},"chords":[%s]%s}"""
                .formatted(name, String.join(",", chords), version == null ? "" : ",\"version\":" + version);
    }

    private String create(String body) throws Exception {
        MvcResult result = mvc.perform(post("/api/projects").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andReturn();
        return result.getResponse().getContentAsString();
    }

    @Test
    void createsAndRetrievesAProjectWithDerivedChordData() throws Exception {
        String created = create(project("Night drive", null, AM, F, C, G7_FIRST_INVERSION));
        String id = JsonPath.read(created, "$.id");
        assertThat((Integer) JsonPath.read(created, "$.version")).isZero();

        mvc.perform(get("/api/projects/" + id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Night drive"))
                .andExpect(jsonPath("$.key.mode").value("MAJOR"))
                .andExpect(jsonPath("$.tempoBpm").value(96))
                .andExpect(jsonPath("$.chords", hasSize(4)))
                .andExpect(jsonPath("$.chords[0].symbol").value("Am"))
                .andExpect(jsonPath("$.chords[3].symbol").value("G7/B"))
                .andExpect(jsonPath("$.chords[3].notes[3]").value("F"))
                .andExpect(jsonPath("$.chords[3].voicing[0]").value(59))
                .andExpect(jsonPath("$.chords[3].durationBeats").value(2))
                .andExpect(jsonPath("$.createdAt").exists());
    }

    @Test
    void listsProjectsWithSummaries() throws Exception {
        create(project("First", null, AM));
        create(project("Second", null, C, F));
        mvc.perform(get("/api/projects"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].name").value("Second"))
                .andExpect(jsonPath("$[0].chordCount").value(2))
                .andExpect(jsonPath("$[0].preview[1]").value("F"))
                .andExpect(jsonPath("$[0].keyLabel").value("C major"));
    }

    @Test
    void persistsChordOrderExplicitlyAcrossReorderingUpdates() throws Exception {
        String created = create(project("Order", null, AM, F, C, G7_FIRST_INVERSION));
        String id = JsonPath.read(created, "$.id");

        String reordered = project("Order", 0L, G7_FIRST_INVERSION, C, AM, F);
        mvc.perform(put("/api/projects/" + id).contentType(MediaType.APPLICATION_JSON).content(reordered))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(1));

        mvc.perform(get("/api/projects/" + id))
                .andExpect(jsonPath("$.chords[0].symbol").value("G7/B"))
                .andExpect(jsonPath("$.chords[1].symbol").value("C"))
                .andExpect(jsonPath("$.chords[2].symbol").value("Am"))
                .andExpect(jsonPath("$.chords[3].symbol").value("F"));

        List<Integer> positions = jdbc.queryForList(
                "SELECT position FROM project_chords WHERE project_id = ?::uuid ORDER BY position", Integer.class, id);
        assertThat(positions).containsExactly(0, 1, 2, 3);

        // shrinking the progression removes trailing rows
        mvc.perform(put("/api/projects/" + id).contentType(MediaType.APPLICATION_JSON).content(project("Order", 1L, F)))
                .andExpect(status().isOk());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM project_chords WHERE project_id = ?::uuid", Integer.class, id))
                .isEqualTo(1);
    }

    @Test
    void rejectsStaleUpdatesWithoutLosingData() throws Exception {
        String id = JsonPath.read(create(project("Shared", null, AM, F)), "$.id");
        mvc.perform(put("/api/projects/" + id).contentType(MediaType.APPLICATION_JSON).content(project("Tab A", 0L, C)))
                .andExpect(status().isOk());

        mvc.perform(put("/api/projects/" + id).contentType(MediaType.APPLICATION_JSON).content(project("Tab B", 0L, AM)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value("Edit conflict"))
                .andExpect(jsonPath("$.currentVersion").value(1));

        mvc.perform(get("/api/projects/" + id))
                .andExpect(jsonPath("$.name").value("Tab A"))
                .andExpect(jsonPath("$.chords", hasSize(1)));
    }

    @Test
    void storesEachChordsPlaybackPatternAndDefaultsToBlock() throws Exception {
        String arpeggio = """
                {"root":"F","quality":"MAJOR","inversion":0,"voicing":[53,57,60],"durationBeats":4,"pattern":"ALBERTI"}""";
        String id = JsonPath.read(create(project("Patterns", null, AM, arpeggio)), "$.id");
        mvc.perform(get("/api/projects/" + id))
                .andExpect(jsonPath("$.chords[0].pattern").value("BLOCK"))
                .andExpect(jsonPath("$.chords[1].pattern").value("ALBERTI"));

        String copyId = JsonPath.read(mvc.perform(post("/api/projects/" + id + "/duplicate"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString(), "$.id");
        mvc.perform(get("/api/projects/" + copyId))
                .andExpect(jsonPath("$.chords[1].pattern").value("ALBERTI"));
    }

    @Test
    void storesExtendedChordsInHighInversions() throws Exception {
        String g13OverE = """
                {"root":"G","quality":"DOMINANT13","inversion":5,"voicing":[52,55,59,62,65,69],"durationBeats":4}""";
        String id = JsonPath.read(create(project("Jazz", null, g13OverE)), "$.id");
        mvc.perform(get("/api/projects/" + id))
                .andExpect(jsonPath("$.chords[0].symbol").value("G13/E"))
                .andExpect(jsonPath("$.chords[0].inversion").value(5));
    }

    @Test
    void storesProjectsInModalKeys() throws Exception {
        String body = """
                {"name":"Modal","key":{"tonic":"D","mode":"DORIAN"},"tempoBpm":100,"register":{"low":45,"high":79},
                 "chords":[{"root":"D","quality":"MINOR7","inversion":0,"voicing":[50,53,57,60]}]}""";
        String id = JsonPath.read(create(body), "$.id");
        mvc.perform(get("/api/projects/" + id)).andExpect(jsonPath("$.key.mode").value("DORIAN"));
        mvc.perform(get("/api/projects")).andExpect(jsonPath("$[0].keyLabel").value("D Dorian"));
    }

    @Test
    void rejectsAnUnknownPlaybackPattern() throws Exception {
        String bad = """
                {"root":"C","quality":"MAJOR","inversion":0,"voicing":[60,64,67],"pattern":"SWING"}""";
        mvc.perform(post("/api/projects").contentType(MediaType.APPLICATION_JSON).content(project("Bad", null, bad)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("chords[0].pattern"))
                .andExpect(jsonPath("$.errors[0].message", containsString("ARPEGGIO_UP")));
    }

    @Test
    void failedUpdateIsAtomic() throws Exception {
        String id = JsonPath.read(create(project("Atomic", null, AM, F)), "$.id");
        String invalidChord = """
                {"root":"C","quality":"MAJOR","inversion":0,"voicing":[60,63,67]}""";
        mvc.perform(put("/api/projects/" + id).contentType(MediaType.APPLICATION_JSON)
                        .content(project("Renamed in a bad update", 0L, C, invalidChord)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("chords[1].voicing"))
                .andExpect(jsonPath("$.errors[0].message", containsString("not a tone of C")));

        mvc.perform(get("/api/projects/" + id))
                .andExpect(jsonPath("$.name").value("Atomic"))
                .andExpect(jsonPath("$.version").value(0))
                .andExpect(jsonPath("$.chords[0].symbol").value("Am"));
    }

    @Test
    void renamesDuplicatesAndDeletes() throws Exception {
        String id = JsonPath.read(create(project("Draft", null, AM, F)), "$.id");
        mvc.perform(patch("/api/projects/" + id).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"  Final  \",\"version\":0}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Final"))
                .andExpect(jsonPath("$.version").value(1));

        MvcResult copy = mvc.perform(post("/api/projects/" + id + "/duplicate"))
                .andExpect(status().isCreated())
                .andExpect(header().exists("Location"))
                .andExpect(jsonPath("$.name").value("Final (copy)"))
                .andExpect(jsonPath("$.chords", hasSize(2)))
                .andReturn();
        String copyId = JsonPath.read(copy.getResponse().getContentAsString(), "$.id");
        assertThat(copyId).isNotEqualTo(id);

        mvc.perform(delete("/api/projects/" + id)).andExpect(status().isNoContent());
        mvc.perform(get("/api/projects/" + id)).andExpect(status().isNotFound());
        mvc.perform(delete("/api/projects/" + id)).andExpect(status().isNotFound());
        mvc.perform(get("/api/projects/" + copyId)).andExpect(status().isOk());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM project_chords WHERE project_id = ?::uuid", Integer.class, id)).isZero();
    }

    @Test
    void reportsValidationErrorsAsProblemDetails() throws Exception {
        String badRequest = """
                {"name":"  ","key":{"tonic":"H","mode":"MAJOR"},"tempoBpm":900,"chords":[]}""";
        mvc.perform(post("/api/projects").contentType(MediaType.APPLICATION_JSON).content(badRequest))
                .andExpect(status().isBadRequest())
                .andExpect(header().string("Content-Type", containsString("application/problem+json")))
                .andExpect(jsonPath("$.title").value("Validation failed"))
                .andExpect(jsonPath("$.errors[?(@.field == 'name')]").exists())
                .andExpect(jsonPath("$.errors[?(@.field == 'tempoBpm')]").exists())
                .andExpect(jsonPath("$.trace").doesNotExist());

        mvc.perform(post("/api/projects").contentType(MediaType.APPLICATION_JSON)
                        .content(project("Bad key", null, AM).replace("\"tonic\":\"C\"", "\"tonic\":\"H\"")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("key"))
                .andExpect(jsonPath("$.errors[0].message", containsString("Invalid note name")));

        String unsupportedQuality = """
                {"root":"C","quality":"MAJOR13","inversion":0,"voicing":[60,64,67]}""";
        mvc.perform(post("/api/projects").contentType(MediaType.APPLICATION_JSON).content(project("Q", null, unsupportedQuality)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("chords[0].quality"));

        String missingVoicing = """
                {"root":"C","quality":"MAJOR","inversion":0}""";
        mvc.perform(post("/api/projects").contentType(MediaType.APPLICATION_JSON).content(project("V", null, missingVoicing)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("chords[0].voicing"));

        mvc.perform(post("/api/projects").contentType(MediaType.APPLICATION_JSON).content("{not json"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Malformed request"));
    }

    @Test
    void updateRequiresAVersionAndAnExistingProject() throws Exception {
        String id = JsonPath.read(create(project("Versioned", null, AM)), "$.id");
        mvc.perform(put("/api/projects/" + id).contentType(MediaType.APPLICATION_JSON).content(project("No version", null, AM)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("version"));
        mvc.perform(put("/api/projects/" + UUID.randomUUID()).contentType(MediaType.APPLICATION_JSON).content(project("X", 0L, AM)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.title").value("Project not found"));
        mvc.perform(get("/api/projects/not-a-uuid"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail", containsString("UUID")));
    }

    @Test
    void allowsEmptyProgressionsForNewProjects() throws Exception {
        String created = create(project("Empty", null));
        assertThat((List<?>) JsonPath.read(created, "$.chords")).isEmpty();
    }

    @Test
    void databaseConstraintsProtectDataIntegrity() {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO projects (id, name, key_tonic, key_mode, tempo_bpm, register_low, register_high, created_at, updated_at)
                VALUES (?, 'Direct', 'C', 'MAJOR', 120, 45, 79, now(), now())""", id);
        jdbc.update("INSERT INTO project_chords VALUES (?, 0, 'C', 'MAJOR', 0, '60,64,67', 4)", id);
        assertThatThrownBy(() -> jdbc.update("INSERT INTO project_chords VALUES (?, 0, 'F', 'MAJOR', 0, '53,57,60', 4)", id))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update("INSERT INTO project_chords VALUES (?, 1, 'F', 'MAJOR', 0, 'not a voicing', 4)", id))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update("UPDATE projects SET tempo_bpm = 5 WHERE id = ?", id))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void healthEndpointReportsDatabaseStatus() throws Exception {
        mvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.database").value("UP"));
    }

    @Test
    void servesOpenApiDocumentation() throws Exception {
        mvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.info.title").value("Harmony Lab API"))
                .andExpect(jsonPath("$.paths['/api/projects/{id}']").exists())
                .andExpect(jsonPath("$.paths['/api/theory/suggestions']").exists());
    }
}
