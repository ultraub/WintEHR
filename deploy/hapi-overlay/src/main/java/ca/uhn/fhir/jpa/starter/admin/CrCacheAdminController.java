package ca.uhn.fhir.jpa.starter.admin;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;
import org.opencds.cqf.fhir.cql.EvaluationSettings;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Tiny admin surface for the cqf-fhir-cr in-memory caches.
 *
 * <p>cqf-fhir-cr-hapi caches compiled CQL ELM and ValueSet expansions in
 * JVM memory keyed by Library/ValueSet identifier (see {@link
 * EvaluationSettings#getValueSetCache()}, {@code getLibraryCache()}, {@code
 * getModelCache()}). The {@code CodeCacheResourceChangeListener} that
 * cqframework added in clinical-reasoning v3.28.0 is supposed to invalidate
 * these on PUT, but in our deployment the listener bean does not register
 * (no startup log line, no invalidation traces) for reasons we couldn't
 * pinpoint from outside the JVM. As a consequence, student edits to a
 * ValueSet weren't reflected in CQL retrieves until a full HAPI restart.
 *
 * <p>This controller exposes the same {@code .clear()} call the
 * out-of-process listener would have triggered, gated by a bearer token so
 * it can't be hit from outside the Docker network even by accident.
 *
 * <p>Bound to {@code /admin/cr/*}. Returns a small JSON summary of how
 * many entries were cleared, so the caller (the CDS Studio composer) can
 * log/observe the effect.
 */
@RestController
@RequestMapping("/admin/cr")
@ConditionalOnBean(EvaluationSettings.class)
public class CrCacheAdminController {

    private final EvaluationSettings evaluationSettings;

    @Autowired
    public CrCacheAdminController(EvaluationSettings evaluationSettings) {
        this.evaluationSettings = evaluationSettings;
    }

    /**
     * Snapshot of the three caches the CR engine maintains. Useful for
     * debugging "why isn't my ValueSet edit reflected" before reaching
     * for {@link #flushCaches()}.
     */
    @GetMapping(value = "/info", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> info() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("valueSetCacheSize", evaluationSettings.getValueSetCache().size());
        body.put("libraryCacheSize", evaluationSettings.getLibraryCache().size());
        body.put("modelCacheSize", evaluationSettings.getModelCache().size());
        return ResponseEntity.ok(body);
    }

    /**
     * Clears all three CR in-memory caches. Equivalent in effect to a
     * HAPI restart for cache purposes — sub-100ms vs ~60s.
     *
     * <p>Idempotent. Safe to call concurrently with {@code $apply}: in-flight
     * evaluations either see the old or new expansion, never a torn read,
     * because the underlying maps are {@link java.util.concurrent.ConcurrentHashMap}.
     */
    @PostMapping(value = "/flush-caches", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> flushCaches() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("valueSetCacheCleared", evaluationSettings.getValueSetCache().size());
        body.put("libraryCacheCleared", evaluationSettings.getLibraryCache().size());
        body.put("modelCacheCleared", evaluationSettings.getModelCache().size());

        evaluationSettings.getValueSetCache().clear();
        evaluationSettings.getLibraryCache().clear();
        evaluationSettings.getModelCache().clear();

        return ResponseEntity.ok(body);
    }

    /**
     * Bearer-token guard for the {@code /admin/cr/*} surface.
     *
     * <p>The endpoints don't expose any FHIR data — only cache mutation —
     * but cache flushing is a denial-of-service primitive (an attacker
     * spamming flush would force every subsequent {@code $apply} to
     * recompile). So we still gate with a static bearer token wired from
     * env var {@code HAPI_ADMIN_TOKEN}. The composer in the FastAPI
     * backend reads the same env var and sets the header on its calls.
     *
     * <p>If the token is unset, the endpoints respond {@code 503} —
     * fail-closed so a misconfigured deploy doesn't accidentally leave
     * the surface unguarded.
     */
    @Configuration
    static class AdminAuthConfig implements WebMvcConfigurer {

        private final String adminToken;

        AdminAuthConfig(@Value("${HAPI_ADMIN_TOKEN:}") String adminToken) {
            this.adminToken = adminToken == null ? "" : adminToken.trim();
        }

        @Override
        public void addInterceptors(InterceptorRegistry registry) {
            registry.addInterceptor(new HandlerInterceptor() {
                @Override
                public boolean preHandle(HttpServletRequest req, HttpServletResponse res, Object handler)
                        throws IOException {
                    if (adminToken.isEmpty()) {
                        res.sendError(HttpServletResponse.SC_SERVICE_UNAVAILABLE,
                                "HAPI_ADMIN_TOKEN is not configured on the server");
                        return false;
                    }
                    String header = req.getHeader("Authorization");
                    String expected = "Bearer " + adminToken;
                    if (header == null || !header.equals(expected)) {
                        res.sendError(HttpServletResponse.SC_UNAUTHORIZED, "missing or invalid bearer token");
                        return false;
                    }
                    return true;
                }
            }).addPathPatterns("/admin/cr/**");
        }
    }
}
