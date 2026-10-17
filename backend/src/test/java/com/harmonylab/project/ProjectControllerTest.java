package com.harmonylab.project;

import com.harmonylab.api.ApiExceptionHandler;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.CannotCreateTransactionException;

import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Error mapping for database failures, without needing a database. */
@WebMvcTest(ProjectController.class)
@Import(ApiExceptionHandler.class)
class ProjectControllerTest {

    @Autowired
    MockMvc mvc;

    @MockitoBean
    ProjectService service;

    @Test
    void unreachableDatabaseIsReportedAs503WithoutInternals() throws Exception {
        when(service.list()).thenThrow(new CannotCreateTransactionException("Could not open JPA EntityManager"));
        mvc.perform(get("/api/projects"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.title").value("Database unavailable"))
                .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("EntityManager"))));
    }

    @Test
    void dataAccessFailuresAreReportedAs503() throws Exception {
        when(service.get(any(UUID.class))).thenThrow(new DataAccessResourceFailureException("connection reset"));
        mvc.perform(get("/api/projects/" + UUID.randomUUID()))
                .andExpect(status().isServiceUnavailable());
    }

    @Test
    void unexpectedErrorsDoNotLeakDetails() throws Exception {
        when(service.list()).thenThrow(new IllegalStateException("secret internal detail"));
        mvc.perform(get("/api/projects"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.detail").value("An unexpected error occurred."))
                .andExpect(jsonPath("$.trace").doesNotExist());
    }
}
