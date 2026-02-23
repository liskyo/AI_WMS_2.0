@echo off
setlocal

:: Read from config file if exists
if exist ".node_path" (
    set /p CUSTOM_NODE_PATH=<.node_path
    call set "PATH=%%CUSTOM_NODE_PATH%%;%%PATH%%"
)

:: Check if node works
node -v >nul 2>&1
if %errorlevel% equ 0 goto node_found

:: Try auto-detect (including the specific path mentioned by user)
if exist "%USERPROFILE%\node\node.exe" (
    set "CUSTOM_NODE_PATH=%USERPROFILE%\node"
    goto save_node_path
)
if exist "%ProgramFiles%\nodejs\node.exe" (
    set "CUSTOM_NODE_PATH=%ProgramFiles%\nodejs"
    goto save_node_path
)
if exist "%ProgramFiles(x86)%\nodejs\node.exe" (
    set "CUSTOM_NODE_PATH=%ProgramFiles(x86)%\nodejs"
    goto save_node_path
)

:: Prompt the user since we can't find it
echo [Warning] Node.js not found in standard PATH or common locations.
echo Please enter the full path to the folder containing node.exe
set /p CUSTOM_NODE_PATH="Path (e.g., %USERPROFILE%\node) : "
if "%CUSTOM_NODE_PATH%"=="" (
    echo No path entered. Exiting.
    pause
    exit /b
)

:: Trim quotes if the user dragged and dropped a folder
set CUSTOM_NODE_PATH=%CUSTOM_NODE_PATH:"=%

if not exist "%CUSTOM_NODE_PATH%\node.exe" (
    echo node.exe not found in %CUSTOM_NODE_PATH%. Please check the path and try again.
    pause
    exit /b
)

:save_node_path
echo %CUSTOM_NODE_PATH%> .node_path
set "PATH=%CUSTOM_NODE_PATH%;%PATH%"
echo [Success] Configured Node.js at %CUSTOM_NODE_PATH% and saved to .node_path for future use.

:node_found
echo Checking Node.js version...
node -v

if not exist "server\node_modules" (
    echo Installing Server Dependencies...
    cd server
    call npm install
    cd ..
)

if not exist "client\node_modules" (
    echo Installing Client Dependencies...
    cd client
    call npm install
    cd ..
)

echo Starting Backend Server...
start "WMS Backend" cmd /c "cd server && npm start"

echo Starting Frontend Client...
start "WMS Frontend" cmd /c "cd client && npm run dev"

echo System starting...
echo Backend: http://localhost:3000
echo Frontend: http://localhost:5173
pause
