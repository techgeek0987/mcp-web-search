@echo off
echo Installing dependencies for MCP Web Search server...
cd /d "%~dp0"
npm install
echo Setup complete! The MCP server is ready to use.
pause