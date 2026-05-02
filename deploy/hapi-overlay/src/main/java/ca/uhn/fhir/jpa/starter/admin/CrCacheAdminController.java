package ca.uhn.fhir.jpa.starter.admin;

import ca.uhn.fhir.context.support.IValidationSupport;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import ca.uhn.fhir.jpa.term.api.ITermReadSvc;
import org.opencds.cqf.fhir.cql.EvaluationSettings;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
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
 * <p>The CR engine reads ValueSet expansions through two layers, both of
 * which we have to clear:
 * <ol>
 * <li>cqf-fhir-cr's in-memory caches on {@link EvaluationSettings} —
 *     compiled CQL ELM, ValueSet expansion, model cache.</li>
 * <li>HAPI's own {@link ITermReadSvc} Caffeine cache — used by the
 *     terminology operations and {@code code:in=<canonical>} search
 *     resolution that the engine emits for retrieves like
 *     {@code [Condition: "Targeted"]}.</li>
 * </ol>
 *
 * <p>The {@code CodeCacheResourceChangeListener} that cqframework added
 * in clinical-reasoning v3.28.0 is supposed to invalidate (1) on PUT, but
 * in our deployment that listener bean does not register (no startup log
 * line, no invalidation traces) for reasons we couldn't pinpoint from
 * outside the JVM. (2) is independent of cqf and isn't touched by that
 * listener at all. Student edits to a ValueSet weren't reflected in CQL
 * retrieves until a full HAPI restart.
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
@ConditionalOnProperty(name = "hapi.fhir.cr.enabled", havingValue = "true")
public class CrCacheAdminController {

    private final EvaluationSettings evaluationSettings;
    private final ITermReadSvc termReadSvc;
    private final List<IValidationSupport> validationSupports;

    @Autowired
    public CrCacheAdminController(
            EvaluationSettings evaluationSettings,
            ITermReadSvc termReadSvc,
            List<IValidationSupport> validationSupports) {
        this.evaluationSettings = evaluationSettings;
        this.termReadSvc = termReadSvc;
        this.validationSupports = validationSupports;
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

        // HAPI's terminology service caches ValueSet expansions in its own
        // Caffeine cache (separate from cqf-fhir-cr's caches above), and the
        // CR engine reads `code:in=<canonical>` searches through that path.
        // Without this invalidation, a ValueSet edit doesn't affect what
        // $apply sees on the next call — empirically confirmed by the
        // round-trip integration test.
        try {
            termReadSvc.invalidateCaches();
            body.put("termReadSvcInvalidated", true);
        } catch (Exception e) {
            // Don't fail the whole flush if the term svc call throws — the
            // cqf caches are already cleared, which covers some scenarios.
            body.put("termReadSvcInvalidated", false);
            body.put("termReadSvcError", e.getMessage());
        }

        // Every IValidationSupport bean has its own caches (the chain has
        // a top-level Caffeine cache, individual chain members may have
        // their own). The bean injected into TokenPredicateBuilder for
        // `code:in=<canonical>` resolution might be a different IVS
        // instance than the chain root, so we iterate all of them and
        // call invalidateCaches() on each. Records each bean class for
        // diagnostics.
        List<String> invalidated = new ArrayList<>();
        List<Map<String, String>> failed = new ArrayList<>();
        for (IValidationSupport vs : validationSupports) {
            String className = vs.getClass().getName();
            try {
                vs.invalidateCaches();
                invalidated.add(className);
            } catch (Exception e) {
                Map<String, String> err = new LinkedHashMap<>();
                err.put("class", className);
                err.put("error", e.getMessage());
                failed.add(err);
            }
        }
        body.put("validationSupportsInvalidated", invalidated);
        if (!failed.isEmpty()) {
            body.put("validationSupportsFailed", failed);
        }

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
