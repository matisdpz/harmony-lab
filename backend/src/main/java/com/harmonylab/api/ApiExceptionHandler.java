package com.harmonylab.api;

import com.harmonylab.music.InvalidMusicInputException;
import com.harmonylab.project.ProjectConflictException;
import com.harmonylab.project.ProjectNotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.transaction.TransactionException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.List;
import java.util.Map;

/**
 * Maps every error to an RFC 9457 problem response: {@code {type, title, status, detail, errors?}}.
 * Stack traces and internal messages are never sent to the client; unexpected errors are logged.
 */
@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ProblemDetail handleBeanValidation(MethodArgumentNotValidException ex) {
        List<Map<String, String>> errors = ex.getBindingResult().getFieldErrors().stream()
                .map(e -> Map.of("field", e.getField(), "message", String.valueOf(e.getDefaultMessage())))
                .toList();
        return validationProblem(errors);
    }

    @ExceptionHandler(HandlerMethodValidationException.class)
    ProblemDetail handleMethodValidation(HandlerMethodValidationException ex) {
        List<Map<String, String>> errors = ex.getParameterValidationResults().stream()
                .flatMap(r -> r.getResolvableErrors().stream().map(e -> Map.of(
                        "field", r.getMethodParameter().getParameterName() == null ? "request" : r.getMethodParameter().getParameterName(),
                        "message", String.valueOf(e.getDefaultMessage()))))
                .toList();
        return validationProblem(errors);
    }

    @ExceptionHandler(FieldValidationException.class)
    ProblemDetail handleFieldValidation(FieldValidationException ex) {
        return validationProblem(ex.errors().stream()
                .map(e -> Map.of("field", e.field(), "message", e.message())).toList());
    }

    @ExceptionHandler(InvalidMusicInputException.class)
    ProblemDetail handleMusicInput(InvalidMusicInputException ex) {
        return problem(HttpStatus.BAD_REQUEST, "Invalid musical input", ex.getMessage());
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ProblemDetail handleUnreadable(HttpMessageNotReadableException ex) {
        return problem(HttpStatus.BAD_REQUEST, "Malformed request", "The request body is missing or is not valid JSON of the expected shape.");
    }

    @ExceptionHandler({MethodArgumentTypeMismatchException.class, MissingServletRequestParameterException.class})
    ProblemDetail handleBadParameter(Exception ex) {
        String detail = ex instanceof MethodArgumentTypeMismatchException mismatch
                ? "Invalid value for '" + mismatch.getName() + "'" + ("id".equals(mismatch.getName()) ? ": project ids are UUIDs." : ".")
                : ex.getMessage();
        return problem(HttpStatus.BAD_REQUEST, "Invalid request parameter", detail);
    }

    @ExceptionHandler(ProjectNotFoundException.class)
    ProblemDetail handleNotFound(ProjectNotFoundException ex) {
        return problem(HttpStatus.NOT_FOUND, "Project not found", ex.getMessage());
    }

    @ExceptionHandler(ProjectConflictException.class)
    ProblemDetail handleConflict(ProjectConflictException ex) {
        ProblemDetail problem = problem(HttpStatus.CONFLICT, "Edit conflict", ex.getMessage());
        problem.setProperty("currentVersion", ex.currentVersion());
        return problem;
    }

    @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
    ProblemDetail handleOptimisticLock(ObjectOptimisticLockingFailureException ex) {
        return problem(HttpStatus.CONFLICT, "Edit conflict",
                "The project was modified concurrently. Reload it before saving again.");
    }

    @ExceptionHandler(NoResourceFoundException.class)
    ProblemDetail handleNoResource(NoResourceFoundException ex) {
        return problem(HttpStatus.NOT_FOUND, "Not found", "No endpoint at this path.");
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    ProblemDetail handleMethod(HttpRequestMethodNotSupportedException ex) {
        return problem(HttpStatus.METHOD_NOT_ALLOWED, "Method not allowed", ex.getMessage());
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    ProblemDetail handleMediaType(HttpMediaTypeNotSupportedException ex) {
        return problem(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Unsupported media type", "Send JSON with Content-Type: application/json.");
    }

    /** Database unreachable or failing: also covers failing to open a transaction (no connection available). */
    @ExceptionHandler({DataAccessException.class, TransactionException.class})
    ProblemDetail handleDatabase(Exception ex) {
        log.error("Database error", ex);
        return problem(HttpStatus.SERVICE_UNAVAILABLE, "Database unavailable",
                "The project database could not complete the request. Please try again shortly.");
    }

    @ExceptionHandler(Exception.class)
    ProblemDetail handleUnexpected(Exception ex) {
        log.error("Unexpected error", ex);
        return problem(HttpStatus.INTERNAL_SERVER_ERROR, "Unexpected error", "An unexpected error occurred.");
    }

    private static ProblemDetail validationProblem(List<Map<String, String>> errors) {
        String detail = errors.isEmpty() ? "The request is invalid."
                : errors.getFirst().get("field") + ": " + errors.getFirst().get("message")
                + (errors.size() > 1 ? " (and " + (errors.size() - 1) + " more)" : "");
        ProblemDetail problem = problem(HttpStatus.BAD_REQUEST, "Validation failed", detail);
        problem.setProperty("errors", errors);
        return problem;
    }

    private static ProblemDetail problem(HttpStatus status, String title, String detail) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setTitle(title);
        return problem;
    }
}
