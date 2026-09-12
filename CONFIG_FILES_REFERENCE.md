# Configuration Files Reference - URLs, Ports & Redirections

## 🔧 ENVIRONMENT CONFIGURATION FILES

### Root Level
- **`.env.example`** [.env.example](.env.example)
  - `MONGO_URI=mongodb+srv://anikettiwari25000_db_user:sihhackathonforesite2026@cluster0.7kwyqof.mongodb.net/` (Local MongoDB)
  - `JWT_SECRET=supersecretjwtkey`
  - `PORT=5000` (Backend port)
  - `AI_SERVICE_URL=http://localhost:8000` (AI microservice)
  - `AI_SERVICE_API_KEY=dev-secret-key-change-in-production`
  - `CLIENT_URL=http://localhost:3000` (Frontend)

### Backend
- **`app/backend/.env`** [app/backend/.env](app/backend/.env)
  - `NEXT_PUBLIC_API_URL=/api` (Frontend-side API proxy)
  - `GROQ_API_KEY=...` (API key)
  - `GEMINI_API_KEY=...` (API key)
  - `MONGO_URI=...` (Cloud MongoDB)
  - `JWT_SECRET=...` (JWT secret)

- **`app/backend/.env.example`** [app/backend/.env.example](app/backend/.env.example)
  - `PORT=5000`
  - `AI_SERVICE_URL=http://localhost:8000`
  - `AI_SERVICE_API_KEY=dev-secret-key-change-in-production`
  - `CLIENT_URL=http://localhost:3000`

### AI Service
- **`ai-service/.env.example`** [ai-service/.env.example](ai-service/.env.example)
  - `PORT=8000` (AI service port)

---

## 🚀 SERVER STARTUP & PORT CONFIGURATION

### Backend API Server
**File:** [app/backend/src/server.js](app/backend/src/server.js)

**Port Configuration:**
```javascript
const PORT = process.env.PORT || 5000;  // Line 100
```

**CORS Configuration (Lines 26-44):**
```javascript
const allowedOrigins = [
  process.env.CLIENT_URL || "http://localhost:3000",
  "http://localhost:3000",
  "http://localhost:5173",  // Vite dev server fallback
];
```

**API Route Mounting (Lines 62-72):**
```javascript
app.use("/api/auth", authRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api", apiRoutes);
app.use("/", apiRoutes);
```

**Health Endpoint (Lines 74-84):**
```javascript
app.get("/api/health", async (req, res) => {
  // Returns: { status, timestamp, environment, aiService, aiModelLoaded }
});
```

**MongoDB Connection (Lines 110-120):**
```javascript
if (process.env.MONGO_URI) {
  await mongoose.connect(process.env.MONGO_URI);
}
```

**AI Service Reference (Line 127):**
```javascript
console.log(`   AI Service:  ${process.env.AI_SERVICE_URL || "http://localhost:8000"}`);
```

---

### AI Service Server
**File:** [ai-service/main.py](ai-service/main.py)

**Port Configuration:**
```python
from config import PORT  # Imports PORT from config.py
# Default: 8000
```

**Config File:** [ai-service/config.py](ai-service/config.py)
```python
PORT = int(os.getenv("PORT", "8000"))  # Line 8
AI_API_KEY = os.getenv("AI_API_KEY", "dev-secret-key-change-in-production")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
```

**CORS Setup:**
```python
CORS(app)  # Line 24 - Allows all origins
```

**Endpoints:**
```
GET  /health           - Health check
POST /analyze          - Analyze safety report
POST /transcribe       - Audio transcription
```

---

## 🌐 FRONTEND API CLIENT

**File:** [app/lib/api.ts](app/lib/api.ts)

**Base URL Configuration (Lines 6-10):**
```typescript
const BASE_URL =
  typeof window !== "undefined"
    ? "" // Client-side: use relative path (calls Next.js /api routes)
    : process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
```

**Key Features:**
- Client-side: Routes through `/api` (proxied by Next.js)
- Server-side: Uses `NEXT_PUBLIC_API_URL` env var
- All requests include JWT token from `localStorage.getItem("foresite_token")`

**API Endpoints Defined:**
```typescript
loginApi(email, password)              // POST /api/auth/login
registerApi(payload)                   // POST /api/auth/register
getMeApi()                             // GET /api/auth/me
submitReportApi(payload)               // POST /api/reports
getMyReportsApi(page)                  // GET /api/reports?page=X
getAllReportsApi(filters)              // GET /api/reports?filters
getReportByIdApi(id)                   // GET /api/reports/:id
updateReportStatusApi(id, status)      // PATCH /api/reports/:id
getAlertsApi(unacknowledgedOnly)       // GET /api/alerts
acknowledgeAlertApi(id, officerName)   // PATCH /api/alerts
getTasksApi(status)                    // GET /api/tasks
createTaskApi(payload)                 // POST /api/tasks
updateTaskStatusApi(id, status, note)  // PATCH /api/tasks/:id
getDashboardStatsApi()                 // GET /api/dashboard
```

---

## 📄 NEXT.JS ROUTING & PAGES

### App Directory Structure
**Root Page:** [app/page.tsx](app/page.tsx)
- Home/Landing page with login/register forms
- Routes to worker/officer/maintenance portals

### Worker Portal
- **Layout:** [app/worker/layout.tsx](app/worker/layout.tsx)
- **Dashboard:** [app/worker/page.tsx](app/worker/page.tsx)
- **Pages:**
  - `/worker/login` → [app/worker/login/page.tsx](app/worker/login/page.tsx)
  - `/worker/profile` → [app/worker/profile/page.tsx](app/worker/profile/page.tsx)
  - `/worker/reports` → [app/worker/reports/page.tsx](app/worker/reports/page.tsx)
  - `/worker/reports/[id]` → [app/worker/reports/[id]/page.tsx](app/worker/reports/[id]/page.tsx)
  - `/worker/submit` → [app/worker/submit/page.tsx](app/worker/submit/page.tsx)

### Officer Portal
- **Layout:** [app/officer/layout.tsx](app/officer/layout.tsx)
- **Dashboard:** [app/officer/page.tsx](app/officer/page.tsx)
- **Pages:**
  - `/officer/alerts` → [app/officer/alerts/page.tsx](app/officer/alerts/page.tsx)
  - `/officer/analytics` → [app/officer/analytics/page.tsx](app/officer/analytics/page.tsx)
  - `/officer/heatmap` → [app/officer/heatmap/page.tsx](app/officer/heatmap/page.tsx)
  - `/officer/reports` → [app/officer/reports/page.tsx](app/officer/reports/page.tsx)
  - `/officer/reports/[id]` → [app/officer/reports/[id]/page.tsx](app/officer/reports/[id]/page.tsx)
  - `/officer/tasks` → [app/officer/tasks/page.tsx](app/officer/tasks/page.tsx)

### Maintenance Portal
- **Layout:** [app/maintenance/layout.tsx](app/maintenance/layout.tsx)
- **Dashboard:** [app/maintenance/page.tsx](app/maintenance/page.tsx)

### Root Layout
- **Layout:** [app/layout.tsx](app/layout.tsx) - Global styles & providers
- **Styles:** [app/globals.css](app/globals.css)

---

## 🔌 NEXT.JS API ROUTES (Backend-as-Service)

**Directory:** [app/api/](app/api/)

### Auth Endpoints
- `POST /api/auth/login` → [app/api/auth/login/route.ts](app/api/auth/login/route.ts)
- `POST /api/auth/register` → [app/api/auth/register/route.ts](app/api/auth/register/route.ts)
- `GET /api/auth/me` → [app/api/auth/me/route.ts](app/api/auth/me/route.ts)

### Data Endpoints
- `GET/POST /api/alerts` → [app/api/alerts/route.ts](app/api/alerts/route.ts)
- `GET/POST /api/dashboard` → [app/api/dashboard/route.ts](app/api/dashboard/route.ts)
- `GET/POST /api/reports` → [app/api/reports/route.ts](app/api/reports/route.ts)
- `GET /api/reports/[id]` → [app/api/reports/[id]/route.ts](app/api/reports/[id]/route.ts)
- `GET/POST /api/tasks` → [app/api/tasks/route.ts](app/api/tasks/route.ts)
- `GET /api/tasks/[id]` → [app/api/tasks/[id]/route.ts](app/api/tasks/[id]/route.ts)

### AI Integration
- `POST /api/analyze` → [app/api/analyze/route.ts](app/api/analyze/route.ts)
- `POST /api/transcribe` → [app/api/transcribe/route.ts](app/api/transcribe/route.ts)

---

## ⚙️ EXPRESS BACKEND ROUTES

**Directory:** [app/backend/src/routes/](app/backend/src/routes/)

- **Auth Routes:** [app/backend/src/routes/authRoutes.js](app/backend/src/routes/authRoutes.js)
  - `POST /register`
  - `POST /login`
  - `GET /me`
  - `POST /logout`

- **Report Routes:** [app/backend/src/routes/reportRoutes.js](app/backend/src/routes/reportRoutes.js)
  - `GET /` - List reports
  - `POST /` - Create report
  - `GET /:id` - Get report details
  - `PATCH /:id` - Update report

- **Alert Routes:** [app/backend/src/routes/alertRoutes.js](app/backend/src/routes/alertRoutes.js)
  - `GET /` - List alerts
  - `PATCH /` - Acknowledge alert

- **Dashboard Routes:** [app/backend/src/routes/dashboardRoutes.js](app/backend/src/routes/dashboardRoutes.js)
  - `GET /` - Dashboard stats

- **Task Routes:** [app/backend/src/routes/taskRoutes.js](app/backend/src/routes/taskRoutes.js)
  - `GET /` - List tasks
  - `POST /` - Create task
  - `PATCH /:id` - Update task status

- **Admin Routes:** [app/backend/src/routes/adminRoutes.js](app/backend/src/routes/adminRoutes.js)
  - Admin-specific operations

- **AI Routes:** [app/backend/src/routes/aiRoutes.js](app/backend/src/routes/aiRoutes.js)
  - Proxy calls to AI microservice

- **API Routes (Legacy):** [app/backend/src/routes/apiRoutes.js](app/backend/src/routes/apiRoutes.js)
  - Legacy endpoints

---

## 🔗 AI SERVICE INTEGRATION

**File:** [app/backend/src/services/aiService.js](app/backend/src/services/aiService.js)

**Key Function:**
```javascript
checkAiHealth() // Calls: http://localhost:8000/health (or AI_SERVICE_URL)
analyzeReport() // Calls: http://localhost:8000/analyze (or AI_SERVICE_URL)
```

**AI Service URL Source:**
```
process.env.AI_SERVICE_URL || "http://localhost:8000"
```

---

## 📦 DEPLOYMENT CONFIGURATION

**File:** [render.yaml](render.yaml)

**Environment Variables:**
```yaml
- key: PORT
  value: 5000
```

---

## 🗂️ SUMMARY OF ALL CONFIGURATION FILES

| File | Purpose | Key Configs |
|------|---------|------------|
| `.env.example` | Root env template | MONGO_URI, PORT (5000), AI_SERVICE_URL, CLIENT_URL (3000) |
| `app/backend/.env` | Backend env | NEXT_PUBLIC_API_URL (/api), API keys |
| `app/backend/.env.example` | Backend template | PORT, AI_SERVICE_URL, CLIENT_URL |
| `ai-service/.env.example` | AI service template | PORT (8000) |
| `ai-service/config.py` | AI config | PORT=8000, API_KEY, GEMINI_API_KEY |
| `app/backend/src/server.js` | Express server | PORT=5000, CORS origins, route mounting |
| `ai-service/main.py` | AI server startup | CORS, Flask app |
| `app/lib/api.ts` | Frontend API client | BASE_URL, token handling, endpoints |
| `app/page.tsx` | Landing page | Home routing, auth forms |
| `render.yaml` | Production deploy | PORT configuration |

---

## 🔄 REDIRECT FLOW

1. **User visits:** `http://localhost:3000/`
2. **Landing page:** Calls `loginApi()` or `registerApi()` from [app/lib/api.ts](app/lib/api.ts)
3. **API Request:** Proxied through Next.js `/api` routes to Express backend
4. **Backend processes:** Connects to MongoDB, validates JWT
5. **Redirect after auth:**
   - Worker → `/worker` (dashboard)
   - Officer → `/officer` (dashboard)
   - Maintenance → `/maintenance` (dashboard)
6. **For data operations:**
   - Frontend calls API endpoints
   - Next.js routes proxy to Express `/api/*` endpoints
   - Express may call AI service at `http://localhost:8000`

---

## 🎯 QUICK REFERENCE: WHERE TO CONFIGURE

| Change Needed | File | Variable |
|---------------|------|----------|
| Change frontend port | `package.json` / `.env` | PORT in dev script |
| Change backend port | `app/backend/.env` OR `app/backend/src/server.js` | `process.env.PORT` or `5000` |
| Change AI service port | `ai-service/.env` OR `ai-service/config.py` | `PORT` |
| Change MongoDB | `.env.example` OR `app/backend/.env` | `MONGO_URI` |
| Change CORS origins | [app/backend/src/server.js](app/backend/src/server.js) | `allowedOrigins` array (lines 26-30) |
| Change API base URL | [app/lib/api.ts](app/lib/api.ts) | `BASE_URL` (lines 6-10) |
| Change AI service URL | `.env` or `app/backend/src/server.js` | `process.env.AI_SERVICE_URL` |
| Add new API route | [app/api/](app/api/) folder | Create `newfeature/route.ts` |
| Add new page | [app/](app/) folder | Create `newpage/page.tsx` |
