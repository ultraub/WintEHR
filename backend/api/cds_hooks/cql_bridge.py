"""
CQL Bridge — production version of the POC at backend/scripts/cql_bridge_poc.py.

Responsibilities
----------------
1. Validate CQL text via HAPI's server-level `$cql` operation
2. Derive CDS Hooks prefetch templates from a Library's `$data-requirements`
3. Apply a PlanDefinition (`$apply`) for a given hook context, returning cards
4. Translate the `CarePlan` returned by `$apply` into CDS Hooks 2.0 `Card[]`

Design notes
------------
- This module talks to HAPI directly via httpx. The existing HAPIFHIRClient.operation()
  uses GET; CQL operations require POST with a Parameters body, so we don't reuse it.
- Translation handles cqf-fhir-cr-hapi's R4 shape: CarePlan with a contained
  RequestGroup whose action[] mirrors the matched PlanDefinition actions
  (after dynamicValue substitution). It also handles top-level RequestGroup
  responses and Bundle wrappers as fallback.
- OperationOutcome warnings inside CarePlan.contained[] are captured and logged
  but do not fail the response — they're surfaced to the caller via the
  `warnings` field on ApplyResult.
- The bridge is stateless; instantiate per-request or share across requests.

POC reference: see backend/scripts/cql_bridge_poc.py for the simplest working
end-to-end demonstration.
"""

from __future__ import annotations

import logging
import os
import re
import time
import uuid as _uuid
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import httpx

from .models import (
    Action,
    ActionType,
    Card,
    CDSHookRequest,
    CDSHookResponse,
    IndicatorType,
    Source,
    Suggestion,
)

# CQL libraries start with `library NAME version 'V'`. Anything matching this
# at the top of the input (after stripping leading whitespace and comments)
# is treated as a full library by validate_cql() — the $cql operation can't
# handle library-level constructs and produces confusing parser errors when
# given them, so we route library inputs through Library/$data-requirements
# instead (which forces a compile and surfaces the real diagnostics).
_LIBRARY_DIRECTIVE_RE = re.compile(r"\s*library\s+[A-Za-z][A-Za-z0-9_]*\s+version\s+'")
_COMMENT_STRIP_RE = re.compile(r"//[^\n]*\n|/\*.*?\*/", flags=re.DOTALL)


def _looks_like_full_library(cql_text: str) -> bool:
    """True if the input starts with a `library X version 'V'` directive.

    Robust to leading comments and whitespace — students often paste with
    a banner comment at the top.
    """
    if not cql_text:
        return False
    cleaned = _COMMENT_STRIP_RE.sub("", cql_text)
    return bool(_LIBRARY_DIRECTIVE_RE.match(cleaned))

logger = logging.getLogger(__name__)

HAPI_FHIR_BASE_URL = os.getenv("HAPI_FHIR_URL", "http://hapi-fhir:8080/fhir")

# Action.priority → CDS Hooks Card.indicator. cqf-fhir uses FHIR
# RequestPriority values: routine, urgent, asap, stat.
PRIORITY_TO_INDICATOR: Dict[str, IndicatorType] = {
    "routine": IndicatorType.INFO,
    "urgent": IndicatorType.WARNING,
    "asap": IndicatorType.WARNING,
    "stat": IndicatorType.CRITICAL,
}

# The maximum length CDS Hooks 2.0 allows for Card.summary.
SUMMARY_MAX_LENGTH = 140


@dataclass
class ValidationIssue:
    """One diagnostic from HAPI's $cql operation outcome."""
    severity: str  # "fatal" | "error" | "warning" | "information"
    diagnostics: Optional[str]


@dataclass
class ValidationResult:
    """Outcome of validate_cql()."""
    ok: bool
    issues: List[ValidationIssue] = field(default_factory=list)


@dataclass
class ApplyResult:
    """Outcome of apply()."""
    cards: List[Card]
    warnings: List[ValidationIssue]
    raw_response: Dict[str, Any]
    elapsed_ms: float


class CQLBridge:
    """Async bridge that connects FastAPI's CDS Hooks surface to HAPI's CR module."""

    def __init__(
        self,
        hapi_base_url: Optional[str] = None,
        timeout_seconds: float = 30.0,
    ) -> None:
        self.base_url = hapi_base_url or HAPI_FHIR_BASE_URL
        self.timeout_seconds = timeout_seconds

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def validate_cql(
        self,
        cql_text: str,
        subject_ref: Optional[str] = None,
    ) -> ValidationResult:
        """Validate CQL — auto-routes by input shape.

        - **Full library** (starts with ``library X version 'V'``): upload as
          a draft library and call ``Library/{id}/$data-requirements`` to
          force a compile. Compile diagnostics come back as OperationOutcome
          issues.
        - **Single expression** (``exists [Patient]``, etc.): forward to the
          server-level ``$cql`` operation as before.

        ``subject_ref`` is honored by the expression path; libraries don't
        need a subject for compile-time validation.
        """
        if _looks_like_full_library(cql_text):
            return await self._validate_library(cql_text)
        return await self._validate_expression(cql_text, subject_ref)

    async def _validate_expression(
        self,
        cql_expression: str,
        subject_ref: Optional[str],
    ) -> ValidationResult:
        """Run a CQL expression through HAPI's server-level ``$cql``."""
        params: Dict[str, Any] = {
            "resourceType": "Parameters",
            "parameter": [{"name": "expression", "valueString": cql_expression}],
        }
        if subject_ref:
            params["parameter"].append({"name": "subject", "valueString": subject_ref})

        try:
            response = await self._post_operation("/$cql", params)
        except httpx.HTTPStatusError as exc:
            issues = self._collect_outcome_issues(self._safe_json(exc.response))
            issues = issues or [ValidationIssue(
                severity="error",
                diagnostics=f"HAPI returned {exc.response.status_code}",
            )]
            return ValidationResult(ok=False, issues=issues)
        except httpx.RequestError as exc:
            return ValidationResult(
                ok=False,
                issues=[ValidationIssue(severity="error", diagnostics=str(exc))],
            )

        # `$cql` returns Parameters. Errors arrive either as a top-level
        # OperationOutcome resource or as a `return` parameter holding one.
        issues = self._collect_outcome_issues(response)
        ok = not any(i.severity in ("fatal", "error") for i in issues)
        return ValidationResult(ok=ok, issues=issues)

    async def _validate_library(self, cql_text: str) -> ValidationResult:
        """Compile-validate a full CQL library via ``$data-requirements``.

        The dev-helper upload is content-hashed, so repeated validations of
        the same text are idempotent in HAPI (no resource churn). The
        ``$data-requirements`` call is the simplest operation that forces
        HAPI's CR engine to actually compile the library — compile errors
        come back as OperationOutcome issues nested in the response.

        Imported lazily so the bridge doesn't have a circular dependency on
        cql_dev_helper.
        """
        from .cql_dev_helper import upload_dev_library

        # Phase 1: upload. Syntax errors that prevent the resource from being
        # accepted at all surface here.
        try:
            library_id, _ = await upload_dev_library(
                cql_text,
                base_name="ValidateProbe",
                hapi_base_url=self.base_url,
            )
        except httpx.HTTPStatusError as exc:
            issues = self._collect_outcome_issues(self._safe_json(exc.response))
            if not issues:
                issues = [ValidationIssue(
                    severity="error",
                    diagnostics=(
                        f"HAPI rejected the library on upload "
                        f"({exc.response.status_code}). The CQL probably has a "
                        f"top-level syntax error (check the `library`/`using`/"
                        f"`include` directives)."
                    ),
                )]
            return ValidationResult(ok=False, issues=issues)
        except httpx.RequestError as exc:
            return ValidationResult(
                ok=False,
                issues=[ValidationIssue(severity="error", diagnostics=str(exc))],
            )
        except ValueError as exc:
            # rewrite_cql_library_directive() raises ValueError if the input
            # doesn't have a recognizable `library` directive — students should
            # never hit this since _looks_like_full_library() already gated us
            # in, but defensively map it to a validation issue.
            return ValidationResult(
                ok=False,
                issues=[ValidationIssue(severity="error", diagnostics=str(exc))],
            )

        # Phase 2: force a compile via $data-requirements. This is the
        # cheapest operation that actually triggers the CR engine to compile
        # the CQL — `$evaluate` would also compile but requires a subject.
        path = f"/Library/{library_id}/$data-requirements"
        try:
            response = await self._post_operation(
                path,
                {"resourceType": "Parameters", "parameter": []},
            )
        except httpx.HTTPStatusError as exc:
            issues = self._collect_outcome_issues(self._safe_json(exc.response))
            if not issues:
                issues = [ValidationIssue(
                    severity="error",
                    diagnostics=f"$data-requirements returned {exc.response.status_code}",
                )]
            return ValidationResult(ok=False, issues=issues)
        except httpx.RequestError as exc:
            return ValidationResult(
                ok=False,
                issues=[ValidationIssue(severity="error", diagnostics=str(exc))],
            )

        issues = self._collect_outcome_issues(response)
        ok = not any(i.severity in ("fatal", "error") for i in issues)
        return ValidationResult(ok=ok, issues=issues)

    async def derive_data_requirements(
        self,
        library_id: str,
    ) -> List[Dict[str, Any]]:
        """Call `Library/{id}/$data-requirements`. Returns the DataRequirement[] array.

        cqf-fhir returns a Library wrapping a `dataRequirement` extension. We pull
        the array out so callers don't need to know the wrapping shape.
        """
        path = f"/Library/{library_id}/$data-requirements"
        response = await self._post_operation(path, {"resourceType": "Parameters", "parameter": []})

        # Response is typically a Library with dataRequirement[] in the top-level
        # field or in the contained[] entries. Walk both.
        requirements: List[Dict[str, Any]] = []
        if isinstance(response.get("dataRequirement"), list):
            requirements.extend(response["dataRequirement"])
        for contained in response.get("contained", []) or []:
            if isinstance(contained.get("dataRequirement"), list):
                requirements.extend(contained["dataRequirement"])
        return requirements

    async def apply(
        self,
        plan_definition_id: str,
        subject_ref: str,
        encounter_ref: Optional[str] = None,
        data_bundle: Optional[Dict[str, Any]] = None,
        source_label: str = "CQL Service",
    ) -> ApplyResult:
        """POST `PlanDefinition/{id}/$apply` and translate the response to Cards."""
        params: Dict[str, Any] = {
            "resourceType": "Parameters",
            "parameter": [{"name": "subject", "valueString": subject_ref}],
        }
        if encounter_ref:
            params["parameter"].append({"name": "encounter", "valueString": encounter_ref})
        if data_bundle:
            params["parameter"].append({"name": "data", "resource": data_bundle})

        path = f"/PlanDefinition/{plan_definition_id}/$apply"
        start = time.monotonic()
        response = await self._post_operation(path, params)
        elapsed_ms = (time.monotonic() - start) * 1000.0

        warnings = self._collect_outcome_issues(response)
        cards = self.request_orchestration_to_cards(response, source_label=source_label)

        logger.info(
            "$apply plan_definition=%s subject=%s elapsed=%.0fms cards=%d warnings=%d",
            plan_definition_id, subject_ref, elapsed_ms, len(cards), len(warnings),
        )
        for w in warnings:
            if w.severity in ("fatal", "error"):
                logger.warning("$apply outcome [%s]: %s", w.severity, w.diagnostics)

        return ApplyResult(
            cards=cards, warnings=warnings, raw_response=response, elapsed_ms=elapsed_ms
        )

    async def execute_for_hook(
        self,
        plan_definition_id: str,
        hook_request: CDSHookRequest,
        source_label: str = "CQL Service",
    ) -> CDSHookResponse:
        """High-level helper: extract subject from hook_request.context, call apply."""
        ctx = hook_request.context or {}
        patient_id = ctx.get("patientId")
        if not patient_id:
            raise ValueError("CDSHookRequest.context.patientId is required for $apply")

        subject_ref = patient_id if "/" in patient_id else f"Patient/{patient_id}"
        encounter_id = ctx.get("encounterId")
        encounter_ref = (
            encounter_id if (encounter_id and "/" in encounter_id)
            else f"Encounter/{encounter_id}" if encounter_id else None
        )

        # CDS Hooks 2.0 context-binding: surface `draftOrders` to CQL via the
        # $apply `data` parameter. cqf-fhir-cr-hapi merges these entries into
        # the data sources its CQL Data Provider consults — verified end-to-
        # end in spike #126 (T2 inline merge, T4 status filter, T5 strict
        # subject-context filter, T6 multi-retrieve consistency, T7 no
        # caching across calls). With this wiring, an order-select CQL rule
        # can write `[Immunization]` and see both persisted resources AND
        # the in-progress draft from `context.draftOrders` — without any
        # special parameters or platform-specific CQL.
        #
        # Skip empty / malformed bundles: sending Bundle{entry: []} is
        # legal but adds engine work for zero benefit, and a non-Bundle
        # value (or null) should never reach $apply as `data`.
        draft_orders = ctx.get("draftOrders")
        data_bundle = (
            draft_orders
            if isinstance(draft_orders, dict)
            and draft_orders.get("resourceType") == "Bundle"
            and draft_orders.get("entry")
            else None
        )

        result = await self.apply(
            plan_definition_id,
            subject_ref=subject_ref,
            encounter_ref=encounter_ref,
            data_bundle=data_bundle,
            source_label=source_label,
        )
        return CDSHookResponse(cards=result.cards, systemActions=None)

    # ------------------------------------------------------------------
    # Translator: $apply response → CDS Hooks Card[]
    # ------------------------------------------------------------------

    def request_orchestration_to_cards(
        self,
        response: Dict[str, Any],
        source_label: str = "CQL Service",
        source_url: Optional[str] = None,
    ) -> List[Card]:
        """Walk the response, extract materialized actions, build Card objects.

        Shapes handled:
        - CarePlan with contained RequestGroup (cqf-fhir-cr-hapi R4 default)
        - Top-level RequestGroup (some configurations)
        - Bundle wrapping CarePlan/RequestGroup (rare)
        - Empty response → empty card list
        """
        request_group = self._find_request_group(response)
        if not request_group:
            return []

        cards: List[Card] = []
        for action in request_group.get("action", []) or []:
            card = self._action_to_card(action, source_label, source_url)
            if card is not None:
                cards.append(card)
        return cards

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    def _find_request_group(self, resource: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Locate the RequestGroup with materialized actions, regardless of wrapping."""
        if not isinstance(resource, dict):
            return None
        rt = resource.get("resourceType")

        if rt == "RequestGroup":
            return resource

        if rt == "CarePlan":
            for contained in resource.get("contained", []) or []:
                if (contained or {}).get("resourceType") == "RequestGroup":
                    return contained
            # Some servers attach actions directly to CarePlan
            if resource.get("action"):
                return {"action": resource["action"]}

        if rt == "Bundle":
            for entry in resource.get("entry", []) or []:
                inner = self._find_request_group((entry or {}).get("resource") or {})
                if inner:
                    return inner

        return None

    def _action_to_card(
        self,
        action: Dict[str, Any],
        source_label: str,
        source_url: Optional[str],
    ) -> Optional[Card]:
        """Build a Card from one materialized RequestGroup.action[].

        Skips actions that have neither a title nor description (those typically
        represent a structural grouping rather than a user-facing recommendation).
        """
        title = action.get("title")
        description = action.get("description")
        if not title and not description:
            return None

        priority = (action.get("priority") or "routine").lower()
        indicator = PRIORITY_TO_INDICATOR.get(priority, IndicatorType.INFO)

        suggestions = self._collect_suggestions(action)

        summary = title or description or "CDS recommendation"
        if len(summary) > SUMMARY_MAX_LENGTH:
            summary = summary[: SUMMARY_MAX_LENGTH - 1] + "…"
        # Avoid duplicating description in detail when it was promoted to summary
        detail = description if (description and description != summary) else None

        return Card(
            uuid=str(_uuid.uuid4()),
            summary=summary,
            indicator=indicator,
            source=Source(label=source_label, url=source_url),
            detail=detail,
            suggestions=suggestions or None,
        )

    def _collect_suggestions(self, action: Dict[str, Any]) -> List[Suggestion]:
        """Map nested action.action[] → Suggestion[].

        cqf materializes ActivityDefinition.apply outputs as nested actions whose
        `resource` field is a Reference to the contained request resource. The
        resolution of that Reference (looking up the actual ServiceRequest etc.
        within CarePlan.contained[]) is left to a future enhancement; for now we
        pass through the reference and let the EHR resolve it.
        """
        suggestions: List[Suggestion] = []
        for sub in action.get("action", []) or []:
            actions: List[Action] = []
            resource_ref = sub.get("resource") or {}
            # If a concrete inline resource is present, surface it as a create
            inline_resource = resource_ref if (
                isinstance(resource_ref, dict) and resource_ref.get("resourceType")
            ) else None
            if inline_resource:
                actions.append(Action(
                    type=ActionType.CREATE,
                    description=sub.get("description"),
                    resource=inline_resource,
                ))

            label = sub.get("title") or sub.get("description") or "Suggestion"
            suggestions.append(Suggestion(
                label=label[:140],
                uuid=str(_uuid.uuid4()),
                actions=actions or None,
            ))
        return suggestions

    def _collect_outcome_issues(self, response: Any) -> List[ValidationIssue]:
        """Aggregate OperationOutcome.issue[] from anywhere in the response.

        $cql and $apply both can attach OperationOutcome either at the top level
        or inside `contained[]` (typical for $apply CarePlan responses) or as the
        resource of a return parameter. Walk all three.
        """
        issues: List[ValidationIssue] = []
        if not isinstance(response, dict):
            return issues

        def walk(node: Any) -> None:
            if isinstance(node, dict):
                if node.get("resourceType") == "OperationOutcome":
                    for issue in node.get("issue", []) or []:
                        diag = issue.get("diagnostics")
                        if not diag:
                            details = issue.get("details") or {}
                            diag = details.get("text")
                        issues.append(ValidationIssue(
                            severity=issue.get("severity", "information"),
                            diagnostics=diag,
                        ))
                    return  # don't recurse into the issues array
                for v in node.values():
                    walk(v)
            elif isinstance(node, list):
                for v in node:
                    walk(v)

        walk(response)
        return issues

    @staticmethod
    def _safe_json(response: httpx.Response) -> Dict[str, Any]:
        try:
            return response.json()
        except ValueError:
            return {}

    async def _post_operation(self, path: str, body: Dict[str, Any]) -> Dict[str, Any]:
        """POST a Parameters body to a HAPI operation endpoint, return parsed JSON."""
        url = f"{self.base_url}{path}"
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            response = await client.post(
                url,
                json=body,
                headers={
                    "Content-Type": "application/fhir+json",
                    "Accept": "application/fhir+json",
                },
            )
            response.raise_for_status()
            return response.json()


# Convenience for FastAPI dependency injection
def get_cql_bridge() -> CQLBridge:
    """Get a CQLBridge instance for FastAPI Depends()."""
    return CQLBridge()
