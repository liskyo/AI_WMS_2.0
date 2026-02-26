@echo off
setlocal
if exist ".node_path" (
    set /p CUSTOM_NODE_PATH=<.node_path
    call set "PATH=%%CUSTOM_NODE_PATH%%;%%PATH%%"
)
node server\find_letters.js
