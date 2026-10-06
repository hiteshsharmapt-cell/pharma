from pydantic import BaseModel, EmailStr, Field, field_validator

class ProductIn(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    composition: str | None = Field(default=None, max_length=1000)
    dosage_form: str | None = Field(default=None, max_length=80)
    pack_size: str | None = Field(default=None, max_length=80)

class SupplierRegister(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    mobile: str
    password: str = Field(min_length=8, max_length=128)
    company_name: str = Field(min_length=2, max_length=200)
    city_id: int
    state_id: int
    business_type: str = Field(min_length=2, max_length=80)
    products: list[ProductIn] = Field(default_factory=list, max_length=10)

    @field_validator("mobile")
    @classmethod
    def _mobile(cls, v):
        v = v.replace(" ", "").removeprefix("+91")
        if not (v.isdigit() and len(v) == 10 and v[0] in "6789"):
            raise ValueError("Enter a valid 10-digit Indian mobile number")
        return v

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    model_config = {"from_attributes": True}
    id: int; name: str; email: str; mobile: str; role: str

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
