"""
Drug Safety Router
Enhanced drug safety checking with comprehensive safety analysis
"""

from fastapi import APIRouter
from api.clinical.drug_interactions import router as drug_interactions_router

# Create main router
router = APIRouter(
    prefix="/api/clinical/drug-safety",
    tags=["drug-safety"]
)

# Include the drug interactions router
router.include_router(drug_interactions_router)