from typing import Literal
from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy.orm import Session
from app.db.base import get_db
from app.models import Requirement

router = APIRouter(prefix="/api/requirements", tags=["requirements"])

class RequirementIn(BaseModel):
    buyer_name: str = Field(min_length=2, max_length=120)
    buyer_mobile: str
    buyer_email: EmailStr
    city_id: int
    state_id: int
    requirement_type: Literal["PCD Pharma Franchise", "Third Party Manufacturing", "Pharma Products",
                              "Distributor Requirement", "Other"]
    category_id: int | None = None
    drug_license_status: Literal["Yes", "No", "Applied"]
    gst_status: Literal["Yes", "No", "Applied"]
    message: str = Field(min_length=10, max_length=2000)
    website: str = ""  # honeypot: real users never fill this hidden field

    @field_validator("buyer_mobile")
    @classmethod
    def _mobile(cls, v):
        v = v.replace(" ", "").removeprefix("+91")
        if not (v.isdigit() and len(v) == 10 and v[0] in "6789"):
            raise ValueError("Enter a valid 10-digit Indian mobile number")
        return v

@router.post("", status_code=201)
def create_requirement(data: RequirementIn, db: Session = Depends(get_db)):
    if data.website:  # bot filled the honeypot: pretend success, save nothing
        return {"id": 0, "status": "NEW"}
    # Hook point for rate limiting / captcha verification later.
    req = Requirement(**data.model_dump(exclude={"website"}))  # status defaults to NEW; no auto-assignment
    db.add(req); db.commit()
    return {"id": req.id, "status": req.status.value}
