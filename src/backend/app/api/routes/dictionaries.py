from fastapi import APIRouter

from app.api.deps import ApiKeyAuth
from app.api.schemas import ApiEnvelope
from app.services.dictionary_catalog import dictionary_catalog

router = APIRouter()


@router.get("/dictionaries/catalog", response_model=ApiEnvelope)
def get_dictionary_catalog(_: ApiKeyAuth) -> ApiEnvelope:
    return ApiEnvelope(data=dictionary_catalog())

