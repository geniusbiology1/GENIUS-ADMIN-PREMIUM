@echo off
chcp 65001 >nul
cd /d %~dp0
where node >nul 2>nul || (echo Node.js غير مثبت. ثبته ثم أعد التشغيل.&pause&exit /b 1)
echo [1] Installing packages...
npm install
if errorlevel 1 (echo فشل npm install.&pause&exit /b 1)
echo [2] Building web app...
npm run build
if errorlevel 1 (echo فشل build.&pause&exit /b 1)
echo [3] Creating Android project...
if not exist android npx cap add android
if errorlevel 1 (echo فشل إضافة Android.&pause&exit /b 1)
npx cap sync android
if errorlevel 1 (echo فشل المزامنة.&pause&exit /b 1)
npx cap open android
