@echo off
echo ===================================================
echo MENJALANKAN LOKAL SERVER UNTUK APLIKASI ABSENSI
echo ===================================================
echo Memeriksa ketersediaan Python...
python -m http.server 8000
if %errorlevel% neq 0 (
    echo Python tidak ditemukan. Mencoba menggunakan Node.js (npx)...
    npx serve .
    if %errorlevel% neq 0 (
        echo.
        echo GAGAL: Anda tidak memiliki Python atau Node.js yang terinstal.
        echo Silakan buka aplikasi ini menggunakan ekstensi "Live Server" di VS Code,
        echo atau install Python/Node.js terlebih dahulu.
        pause
    )
)
pause
