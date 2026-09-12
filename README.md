# ForeSite — Industrial Safety & SIF Precursor Detection Platform

ForeSite is an AI-powered industrial safety intelligence system engineered for refineries, chemical complexes, and heavy manufacturing facilities. It analyzes unsafe-act, unsafe-condition, and near-miss reports using fine-tuned NLP models to detect Serious Injury & Fatality (SIF) precursors before incidents escalate.

---

## 🚀 Quick Start (Running on Any PC)

### Prerequisites
1. **Node.js**: v18+ or v20+ ([Download Node.js](https://nodejs.org/))
2. **Python**: v3.10+ ([Download Python](https://www.python.org/))

---

### Step 1: Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/ForeSite-new.git
cd ForeSite-new
```

---

### Step 2: Install Dependencies

#### 1. Web Application (Next.js)
```bash
npm install
```

#### 2. AI Microservice (Python)
```bash
cd ai-service
pip install -r requirements.txt
cd ..
```

---

### Step 3: Configure Environment Variables

1. Copy `.env.example` to `.env.local` in the root directory:
   ```bash
   cp .env.example .env.local
   ```
2. Copy `ai-service/.env.example` to `ai-service/.env`:
   ```bash
   cp ai-service/.env.example ai-service/.env
   ```
   *(Add your `GEMINI_API_KEY` in `ai-service/.env` if you wish to enable multimodal photo & audio hazard extraction).*

---

### Step 4: Run the Application

#### Option A: One Command for Both (Recommended)
```bash
npm run dev:all
```
This runs:
- **Next.js Web Frontend & API:** [http://localhost:3000](http://localhost:3000)
- **Python NLP AI Microservice:** [http://localhost:8000](http://localhost:8000)

#### Option B: Run in Separate Terminals
- **Terminal 1 (Web):**
  ```bash
  npm run dev
  ```
- **Terminal 2 (AI Service):**
  ```bash
  cd ai-service
  python main.py
  ```

---

## 🏭 Operational Portals

- **Worker Portal:** [http://localhost:3000/worker](http://localhost:3000/worker)
  - Quick hazard logging, speech-to-text recording, bilingual (Hindi / English) support, photo upload.
- **Safety Officer Command:** [http://localhost:3000/officer](http://localhost:3000/officer)
  - SIF precursor alerts, live triage, real-time spatial refinery heatmap, incident analytics.
- **Maintenance Operations:** [http://localhost:3000/maintenance](http://localhost:3000/maintenance)
  - Dispatched work orders, equipment telemetry status, LOTO permit isolation tracking.

---

## 🧠 AI Architecture
- **NLP Model:** Custom fine-tuned Sentence-Transformer (`custom-sif-minilm`) trained on 23 OSHA industrial hazard precursors.
- **Resilient Fallback:** If the AI microservice is not active, built-in deterministic heuristic scoring ensures seamless zero-crash demonstration.

