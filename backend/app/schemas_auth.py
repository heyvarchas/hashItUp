from pydantic import BaseModel


class LoginRequest(BaseModel):
    service_number: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    expires_in_hours: int