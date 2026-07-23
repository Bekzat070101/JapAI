@echo off
chcp 65001 >nul
echo ==========================================
echo   JapAI — 打包构建脚本
echo ==========================================
echo.

REM 清理旧构建文件
if exist build rmdir /s /q build
if exist dist rmdir /s /q dist
if exist __pycache__ rmdir /s /q __pycache__

echo [1/2] 正在打包...
pyinstaller --noconsole --onefile --name "JapAI" ^
    --add-data "static;static" ^
    --add-data "knowledge_base;knowledge_base" ^
    --hidden-import "prompts" ^
    --hidden-import "prompts.generate_questions" ^
    --hidden-import "prompts.grade_answer" ^
    --hidden-import "prompts.generate_summary" ^
    app.py

if %errorlevel% neq 0 (
    echo 打包失败！
    pause
    exit /b %errorlevel%
)

echo.
echo [2/2] 清理临时文件...
rmdir /s /q build
del /q JapAI.spec 2>nul

echo.
echo ==========================================
echo   打包完成！
echo   文件位置：dist\JapAI.exe
echo ==========================================
echo.
pause
