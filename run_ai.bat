@echo off
if exist "C:\Users\%USERNAME%\anaconda3\python.exe" (
  "C:\Users\%USERNAME%\anaconda3\python.exe" ai-service\main.py
) else if exist "C:\Users\saura\anaconda3\python.exe" (
  "C:\Users\saura\anaconda3\python.exe" ai-service\main.py
) else (
  python ai-service\main.py
)
