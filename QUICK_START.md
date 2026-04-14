# ⚡ Quick Start Guide

## 🚀 Run Everything in 5 Minutes

### Step 1: Backend Setup (One-time)

```bash
# Navigate to backend
cd backend

# Create virtual environment (if not exists)
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Step 2: Frontend Setup (One-time)

```bash
# Navigate to project root
cd ..

# Install dependencies
npm install
```

### Step 3: Run Backend

```bash
# In backend folder, with venv activated
cd backend
python api_server.py
```

**✅ Backend running on:** `http://localhost:5000`

### Step 4: Run Frontend

```bash
# In project root (new terminal)
npm run dev
```

**✅ Frontend running on:** `http://localhost:3000`

### Step 5: Open Browser

1. Go to: `http://localhost:3000`
2. Register/Login
3. Go to **Monitoring** page
4. Click **Start Detection**

---

## 📝 Common Commands

### Backend
```bash
# Start backend
cd backend
venv\Scripts\activate  # Windows
python api_server.py

# Install new package
pip install <package-name>
pip freeze > requirements.txt
```

### Frontend
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Install new package
npm install <package-name>
```

### Both (Windows - Two Terminals)
```bash
# Terminal 1 - Backend
cd backend && venv\Scripts\activate && python api_server.py

# Terminal 2 - Frontend
npm run dev
```

---

## 🔧 Troubleshooting Quick Fixes

### Backend won't start?
```bash
# Check Python version
python --version  # Should be 3.8+

# Reinstall dependencies
pip install --upgrade pip
pip install -r requirements.txt
```

### Frontend won't start?
```bash
# Clear cache and reinstall
rm -rf node_modules .next
npm install
```

### Port already in use?
```bash
# Windows - Kill process on port 5000
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Linux/Mac - Kill process on port 5000
lsof -ti:5000 | xargs kill -9
```

### Camera not working?
```bash
# Test camera
python -c "import cv2; cap = cv2.VideoCapture(0); print('Camera OK' if cap.isOpened() else 'Camera Failed')"
```

---

## 📁 Important Files

- **Backend Config:** `backend/config.py`
- **API Server:** `backend/api_server.py`
- **Detection Service:** `backend/detection_service.py`
- **Frontend Config:** `.env.local`
- **Model:** `models/YOLO26M_L4_768_weights_best.pt`

---

## 🎯 What to Check

- ✅ Backend terminal shows: `Running on http://127.0.0.1:5000`
- ✅ Frontend terminal shows: `ready started server on 0.0.0.0:3000`
- ✅ Browser opens without errors
- ✅ Can login/register
- ✅ Detection starts successfully

---

*For detailed setup, see `COMPLETE_SETUP_GUIDE.md`*

