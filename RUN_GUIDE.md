# How to Run Logicash Properly

To run the full application properly, you need **two separate terminal windows** open at the same time: one for the Python Backend and one for the Next.js Frontend.

## 1. Start the Backend (API & Engine)
Open a new terminal at the project root (`Logicash`) and run:
```powershell
cd backend
python main.py
```
*   **Verification**: You should see `INFO: Uvicorn running on http://0.0.0.0:8000`. 
*   **Note**: Keep this terminal open. Do NOT close it.

---

## 2. Start the Frontend (UI & PWA)
Open a **second** terminal window at the project root (`Logicash`) and run:

### Option A: Development Mode (Recommended for testing)
```powershell
cd frontend
npm run dev
```

### Option B: Production Mode (To test PWA features)
```powershell
cd frontend
npm run build
npm run start
```
*   **URL**: [http://localhost:3000](http://localhost:3000)

---

## ⚡ Troubleshooting
- **OneDrive Sync Issues**: If you see `errno: -4071` or `EPERM`, OneDrive might be locking files. Move the project to a non-synced folder (e.g., `C:\Logicash`) if errors persist.
- **Two Terminals**: You MUST use two terminals. You cannot run both in one terminal window unless you background the processes.
- **Port Conflict**: If Port 8000 or 3000 is in use, check for other running instances.
- **Node Modules**: If `npm` fails, run `npm install` in the `frontend` directory first.
- **Supabase**: Ensure `frontend/.env.local` has your Supabase keys.
