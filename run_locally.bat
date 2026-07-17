@echo off
chcp 65001 >nul
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

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

echo [Warning / 警告] Node.js not found in PATH or common folders.  ^|  在 PATH 或常見安裝路徑找不到 Node.js。
echo Please enter the folder path that contains node.exe  ^|  請輸入含 node.exe 的資料夾完整路徑
set /p CUSTOM_NODE_PATH="Path (e.g. %USERPROFILE%\node) : "
if "%CUSTOM_NODE_PATH%"=="" (
    echo No path entered. Exiting.  ^|  未輸入路徑，結束。
    pause
    exit /b
)

set CUSTOM_NODE_PATH=%CUSTOM_NODE_PATH:"=%

if not exist "%CUSTOM_NODE_PATH%\node.exe" (
    echo node.exe not found in %CUSTOM_NODE_PATH%. Check path.  ^|  路徑中找不到 node.exe，請檢查。
    pause
    exit /b
)

:save_node_path
echo %CUSTOM_NODE_PATH%> .node_path
set "PATH=%CUSTOM_NODE_PATH%;%PATH%"
echo [Success / 完成] Saved Node folder to .node_path  ^|  已將 Node 路徑寫入 .node_path：%CUSTOM_NODE_PATH%

:node_found
echo Checking Node.js version...  ^|  檢查 Node.js 版本…
node -v
for /f "delims=" %%V in ('node -p "process.version"') do set "NODE_FULL=%%V"

:: Reinstall if missing folder OR critical packages (partial/failed install)
set "NEED_SERVER_INSTALL=0"
if not exist "server\node_modules" set "NEED_SERVER_INSTALL=1"
if not exist "server\node_modules\better-sqlite3" set "NEED_SERVER_INSTALL=1"
if not exist "server\node_modules\node-cron" set "NEED_SERVER_INSTALL=1"
if "!NEED_SERVER_INSTALL!"=="1" (
    echo Installing server dependencies... ^|  正在安裝後端套件…
    pushd "%~dp0server"
    call npm install
    set "INST=!ERRORLEVEL!"
    popd
    if not "!INST!"=="0" (
        echo.
        echo [ERROR / 錯誤] server npm install failed. Node 24 needs better-sqlite3 ^>=12, or install VS C++ Build Tools. ^|  後端套件安裝失敗。
        pause
        exit /b 1
    )
)

if not exist "client\node_modules" (
    echo Installing client dependencies... ^|  正在安裝前端套件…
    pushd "%~dp0client"
    call npm install
    popd
)

:: Match better-sqlite3 native binary to THIS Node.js
set "SKIP_REBUILD=0"
if exist "server\.node_abi_cache" (
    set /p ABI_CACHED=<"server\.node_abi_cache"
    if "!ABI_CACHED!"=="!NODE_FULL!" set "SKIP_REBUILD=1"
)
if "!SKIP_REBUILD!"=="1" (
    echo [OK] Skip better-sqlite3 rebuild — matches Node !NODE_FULL! ^|  略過 better-sqlite3 重建（已符合目前 Node 版本）
) else (
    echo Rebuilding better-sqlite3 for Node !NODE_FULL!... ^|  正為目前的 Node 重新編譯 better-sqlite3（換 Node 主版本後必做）…
    pushd "%~dp0server"
    call npm rebuild better-sqlite3
    set "RB=!ERRORLEVEL!"
    popd
    if not "!RB!"=="0" (
        echo.
        echo [ERROR / 錯誤] npm rebuild better-sqlite3 failed. Fix then retry from folder server ^|  rebuild 失敗，後端無法啟動。請於 server 目錄檢視錯誤後重試 npm rebuild better-sqlite3
        pause
        exit /b 1
    )
    node -e "require('fs').writeFileSync(require('path').join('server','.node_abi_cache'), process.version)"
)

echo Starting backend... ^|  啟動後端視窗…
start "WMS Backend" cmd /k "cd /d ""%~dp0server"" && npm start"

echo Starting frontend... ^|  啟動前端視窗…
start "WMS Frontend" cmd /k "cd /d ""%~dp0client"" && npm run dev"

echo.
echo System starting  ^|  系統啟動說明
echo Backend ^|  後端埠: http://localhost:3000
echo Frontend ^| 前端（Vite）：http://localhost:5173  （若為 --host，請以前端視窗實際 URL 為準）
echo Note ^|  說明: Vite proxy ECONNREFUSED = backend not listening ^|  若出現代理連線被拒，代表後端未成功啟動，請先看「WMS Backend」視窗（常見為 better-sqlite3 需 rebuild）。
echo Optionally ^|  另可於專案根目錄：npm install 後執行 npm run dev （單一終端並行）。
pause
exit /b 0
