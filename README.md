# Pharma B2B Marketplace — Milestone 1 (in progress)

Done so far: Steps 1-3 (structure, schema models, auth + RBAC).

## Backend setup
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # set DATABASE_URL and JWT_SECRET
createdb pharma_marketplace
alembic revision --autogenerate -m "initial schema"
alembic upgrade head
python create_admin.py "Admin" admin@example.com 9876543210 'StrongPass123'
uvicorn app.main:app --reload   # API docs: http://localhost:8000/docs
```

## Frontend setup
```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev     # http://localhost:3000
```
Backend must be running on port 8000. Add states/cities first (see backend step 4 of the run guide).
