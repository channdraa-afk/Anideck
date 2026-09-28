Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "c:\My Project\Anideck"

' Check if port 5177 is already listening; if not, start Vite server silently
WshShell.Run "cmd /c netstat -ano | findstr :5177 >nul || start /b npm run dev", 0, False

WScript.Sleep 1800

' Open in Standalone Desktop App Window mode (Edge App Mode)
WshShell.Run "cmd /c start msedge --app=http://localhost:5177", 0, False
