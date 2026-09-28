Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "c:\My Project\Anideck"

' Check if port 5177 is already listening; if not, start Vite server silently
WshShell.Run "cmd /c netstat -ano | findstr :5177 >nul || start /b npm run dev", 0, False

WScript.Sleep 1500

' Open directly in Mozilla Firefox
WshShell.Run """C:\Program Files\Mozilla Firefox\firefox.exe"" ""http://localhost:5177""", 0, False
