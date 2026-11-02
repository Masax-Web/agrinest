@echo off
setlocal
set "PROJECT_DIR=%~dp0"

if not exist "%PROJECT_DIR%package.json" (
  echo Could not find package.json in %PROJECT_DIR%
  pause
  exit /b 1
)

start "AGRI-NEST Backend (port 3000)" cmd /k "cd /d ""%PROJECT_DIR%"" && npm run api:start"
start "AGRI-NEST Frontend (port 3001)" cmd /k "cd /d ""%PROJECT_DIR%"" && set ""VITE_API_BASE_URL=http://localhost:3000"" && npm run dev -- --host 0.0.0.0 --port 3001"

start "" http://localhost:3001
endlocal
