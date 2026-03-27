import os
import psycopg2 # PostgreSQL database adapter for Python

# fastapi utilities used for building APIs
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
# pydantic models for reuest/response validation
from pydantic import BaseModel, EmailStr
# passwprd hashing utilities
from passlib.context import CryptContext
# jwt handling (encode and decode) tokens
from jose import jwt, JWTError
# date and time utilities for token expiration
from datetime import datetime, timedelta


# load database url and then get secret key for sigining JWT tokens 
DATABASE_URL = os.getenv("DATABASE_URL")
SECRET_KEY   = os.getenv("SECRET_KEY", "supersecretjwtkey")
ALGORITHM    = "HS256"
TOKEN_EXPIRE_HOURS = 24


# initilize with title and enable CORS 
# allow all origins/requests, methods, headers
app = FastAPI(title="User Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# password hashing configuration and http bearer authentication
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer      = HTTPBearer()


# get DB connection, open connection and provide to endpoint 
def get_db():
    conn = psycopg2.connect(DATABASE_URL)
    try:
        yield conn
    finally:
        conn.close()

# request models for user registeration, login and returning user data and authentication
class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    created_at: datetime

class TokenResponse(BaseModel):
    token: str
    user: UserResponse


# hash a plain password before storing it
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

# verifying password against a hashed passwork 
def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

# create a JWT token for each user 
def create_token(user_id: int, email: str) -> str:
    payload = {
        "sub": str(user_id),
        "email": email,
        "exp": datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

# decode and validate token 
def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        # raise an erorr if its invliad 
        raise HTTPException(status_code=401, detail="Invalid or expired token")

# extract current user ID from token 
def get_current_user_id(credentials: HTTPAuthorizationCredentials = Depends(bearer)) -> int:
    payload = decode_token(credentials.credentials)
    return int(payload["sub"])


# health check endpoint 
@app.get("/health")
def health():
    return {"status": "ok", "service": "user"}


# user registration endpoint
@app.post("/register", response_model=TokenResponse, status_code=201)
def register(body: RegisterRequest, conn=Depends(get_db)):
    with conn.cursor() as cur:
        # check if email already exists
        cur.execute("SELECT id FROM users WHERE email = %s", (body.email,))
        if cur.fetchone():
            raise HTTPException(status_code=409, detail="Email already registered")

        # insert new user
        cur.execute(
            """
            INSERT INTO users (name, email, password)
            VALUES (%s, %s, %s)
            RETURNING id, name, email, created_at
            """,
            (body.name, body.email, hash_password(body.password)),
        )
        row = cur.fetchone()
        conn.commit()

    # convert DB row into response model and return both tocken and user info
    user = UserResponse(id=row[0], name=row[1], email=row[2], created_at=row[3])
    return TokenResponse(token=create_token(user.id, user.email), user=user)


# login endpoint
@app.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, conn=Depends(get_db)):
    with conn.cursor() as cur:
        # fetch user by their email
        cur.execute(
            "SELECT id, name, email, password, created_at FROM users WHERE email = %s",
            (body.email,),
        )
        row = cur.fetchone()

    # validate creidentials
    if not row or not verify_password(body.password, row[3]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # build user repsonse and return its tocken and user info
    user = UserResponse(id=row[0], name=row[1], email=row[2], created_at=row[4])
    return TokenResponse(token=create_token(user.id, user.email), user=user)


# get currently logged in user's info 
@app.get("/users/me", response_model=UserResponse)
def get_me(user_id: int = Depends(get_current_user_id), conn=Depends(get_db)):
    with conn.cursor() as cur:
        # fetch user by its ID
        cur.execute(
            "SELECT id, name, email, created_at FROM users WHERE id = %s",
            (user_id,),
        )
        row = cur.fetchone()

    if not row:
        # if user is not found, raise error
        raise HTTPException(status_code=404, detail="User not found")
    # return user info 
    return UserResponse(id=row[0], name=row[1], email=row[2], created_at=row[3])


# get any user by their ID for other services
@app.get("/users/{user_id}", response_model=UserResponse)
def get_user(user_id: int, conn=Depends(get_db)):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, name, email, created_at FROM users WHERE id = %s",
            (user_id,),
        )
        row = cur.fetchone()

    if not row:
        # if user is not found
        raise HTTPException(status_code=404, detail="User not found")

    # return user data
    return UserResponse(id=row[0], name=row[1], email=row[2], created_at=row[3])