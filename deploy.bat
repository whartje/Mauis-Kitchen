@echo off
title Maui's Kitchen — Deploy
color 0A

echo.
echo  ==============================================
echo   Maui's Kitchen — Deploy to Production
echo  ==============================================
echo.

:: ── 1. Generate Prisma client ─────────────────────────────────────────────
echo [1/4] Generating Prisma client...
call npx prisma generate
if %errorlevel% neq 0 (
    echo.
    echo  ERROR: Prisma generate failed. Fix the error above and try again.
    pause
    exit /b 1
)
echo  Done.
echo.

:: ── 2. Build locally to catch errors before pushing ───────────────────────
echo [2/4] Building app (catches errors before they reach Vercel)...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo  ERROR: Build failed. Fix the errors above and try again.
    pause
    exit /b 1
)
echo  Build passed.
echo.

:: ── 3. Stage all changes ──────────────────────────────────────────────────
echo [3/4] Staging changes...
git add .
git status
echo.

:: Ask for a commit message
set /p COMMIT_MSG= Enter commit message: 
if "%COMMIT_MSG%"=="" set COMMIT_MSG=Update

git commit -m "%COMMIT_MSG%"
echo.

:: ── 4. Push to GitHub → triggers Vercel auto-deploy ──────────────────────
echo [4/4] Pushing to GitHub (Vercel will deploy automatically)...
git push origin master
if %errorlevel% neq 0 (
    echo.
    echo  ERROR: Push failed. Check your internet connection or GitHub credentials.
    pause
    exit /b 1
)

echo.
echo  ==============================================
echo   Done! Vercel is deploying now.
echo   Check: https://vercel.com/dashboard
echo  ==============================================
echo.
pause
