"""
Clinical administration module — recording the *administration* events for
orders the Order Composer produced. The CPOE side of the loop lives in
`api/clinical/orders/`; this module is its counterpart.

#116 Phase 5.1: medications only (MAR time grid + quick-doc).
Later sub-phases extend to immunizations, specimens, and procedures.

Note: we deliberately don't re-export `router` here. Doing so shadows the
`.router` submodule for tools that resolve `api.clinical.administration.router`
via attribute lookup (notably `unittest.mock.patch`), which makes patching
HAPIFHIRClient inside the module a footgun. Callers should import the
APIRouter from the submodule directly: `from api.clinical.administration.router import router`.
"""
