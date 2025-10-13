# CLIP Similarity Service Troubleshooting

## 🔍 Issue Summary

The CLIP service fails to start with `ModuleNotFoundError: No module named 'fastapi'` when launched from the Electron app, but works fine when run directly from the terminal.

**Error in logs:**
```
[ERROR]: [CLIP Service Error] {"error":"ModuleNotFoundError: No module named 'fastapi'\n"}
[ERROR]: ⚠️ CLIP service failed to start {"error":"CLIP service failed to start within timeout"}
```

## ✅ Confirmed Working

- ✅ AI Analysis Service v0.6 (prompt strategy implementation)
- ✅ FastAPI installed (`python3 -m pip show fastapi`)
- ✅ All dependencies available (transformers, torch, PIL, numpy)
- ✅ CLIP service runs fine from terminal
- ✅ Python can import all required modules

**The v0.6 prompt strategy changes are NOT affected by this issue.**

---

## 🛠️ Root Cause

When Electron spawns the Python process, it may use a different environment than your interactive shell. This can cause Python to not find user-installed packages.

**Two scenarios:**

### Scenario 1: Environment Mismatch
- Electron spawns Python without full shell environment
- User site-packages path not in `sys.path`
- Python can't find packages installed with `--user` flag

### Scenario 2: Different Python Interpreter
- Electron might find a different `python3` binary
- System Python vs. user Python
- Wrong Python version or location

---

## 🚀 Solutions (Try in Order)

### Solution 1: Disable CLIP Service (Quick Fix)

If you don't need visual similarity detection right now:

**Edit `config.json`:**
```json
{
  "similarity": {
    "enabled": false
  }
}
```

**Then restart the app.** ✅ CLIP errors will disappear.

---

### Solution 2: Install Dependencies System-Wide

Instead of `--user`, install packages globally:

```bash
# Remove user installations (optional)
python3 -m pip uninstall fastapi uvicorn transformers torch pillow numpy pydantic

# Install system-wide (may need sudo)
sudo python3 -m pip install fastapi uvicorn transformers torch pillow numpy pydantic
```

**Then restart the app.**

---

### Solution 3: Use Virtual Environment

Create a dedicated Python environment for the CLIP service:

```bash
# Create virtual environment
python3 -m venv venv

# Activate it
source venv/bin/activate

# Install all dependencies
pip install fastapi uvicorn transformers torch pillow numpy pydantic

# Deactivate
deactivate
```

**Then modify `src/services/clipServiceManager.js`:**
```javascript
// Line 32-35, change:
this.process = spawn('python3', ['-u', scriptPath], {
  cwd: process.cwd(),
  stdio: ['ignore', 'pipe', 'pipe']
});

// To:
const pythonBin = path.join(process.cwd(), 'venv', 'bin', 'python3');
this.process = spawn(pythonBin, ['-u', scriptPath], {
  cwd: process.cwd(),
  stdio: ['ignore', 'pipe', 'pipe']
});
```

**Restart the app.**

---

### Solution 4: Create requirements.txt

Ensure all dependencies are documented:

**Create `requirements.txt`:**
```txt
fastapi>=0.104.0
uvicorn>=0.24.0
transformers>=4.30.0
torch>=2.0.0
pillow>=10.0.0
numpy>=1.24.0
pydantic>=2.0.0
```

**Install:**
```bash
python3 -m pip install -r requirements.txt
```

**Restart the app.**

---

### Solution 5: Use Full Python Path

Find the exact Python binary and use it:

```bash
# Find Python path
which python3
# Output: /usr/bin/python3 (or similar)

# Verify it can import fastapi
/usr/bin/python3 -c "from fastapi import FastAPI; print('OK')"
```

**If that works, modify `src/services/clipServiceManager.js`:**
```javascript
// Line 32, change 'python3' to full path:
this.process = spawn('/usr/bin/python3', ['-u', scriptPath], {
```

**Restart the app.**

---

## 🧪 Verify Solution

After applying any solution, verify the CLIP service starts:

### 1. Check app.log
```bash
tail -f "z_Logs and traces/app.log"
```

**Look for:**
```
[INFO]: Loading CLIP model...
[INFO]: CLIP model loaded on cpu
[INFO]: Uvicorn running on http://0.0.0.0:8765
[INFO]: CLIP service is ready
```

### 2. Test manually
```bash
# Start the service
python3 -u similarity_service.py

# Should see:
# Loading CLIP model...
# CLIP model loaded on cpu
# INFO: Uvicorn running on http://0.0.0.0:8765
```

### 3. Test from app
1. Start Lightroom Meta Tagger
2. Check logs - no CLIP errors ✅
3. Ingest images
4. Process with visual similarity enabled
5. Should see similar images grouped

---

## 📊 Current Status

**After v0.6.1 changes:**
- ✅ `aiAnalysisService.js` - Working perfectly
- ✅ Dual prompt strategy - Implemented
- ✅ Config updated - `"promptStrategy": "balanced"`
- ✅ CLIP service - **FIXED** with virtual environment (v0.6.1)

**CLIP is now FIXED and working!**

To enable CLIP similarity detection:
1. Ensure venv is set up: `./scripts/verify-clip-setup.sh`
2. Enable in config: `"similarity": { "enabled": true }`
3. Restart app
4. Check logs: "CLIP service is ready" ✅
5. Process images with visual similarity

**To test v0.6 AI features:**
1. Ingest images
2. Run AI Analysis
3. Check for new output fields:
   - `subjectDetection` with confidence
   - `gpsAnalysis` with validation/reasoning
   - Realistic confidence scores (60-90%)
   - Clean JSON output

---

## 🎉 SOLUTION IMPLEMENTED (v0.6.1)

**CLIP is now fixed with virtual environment!**

**Setup (already done in v0.6.1):**
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
deactivate
```

**Verify setup:**
```bash
./scripts/verify-clip-setup.sh
```

**Config (enable CLIP):**
```json
{
  "similarity": {
    "enabled": true  // ← CLIP now works!
  },
  "aiAnalysis": {
    "promptStrategy": "balanced"  // ← Use new strategy
  }
}
```

**Restart the app and everything works!** ✅

---

## 🐛 Still Having Issues?

### Debug Steps:

1. **Check which Python Electron uses:**
   ```javascript
   // Add to clipServiceManager.js before spawn:
   const { execSync } = require('child_process');
   const pythonPath = execSync('which python3').toString().trim();
   logger.info('Using Python:', pythonPath);
   ```

2. **Check Python sys.path from Electron:**
   ```javascript
   // Modify spawn to run a test command first:
   const testCmd = spawn('python3', ['-c', 'import sys; print("\\n".join(sys.path))']);
   testCmd.stdout.on('data', (data) => logger.info('Python path:', data.toString()));
   ```

3. **Enable verbose logging:**
   ```javascript
   // In clipServiceManager.js, line 49-51, change:
   this.process.stderr.on('data', (data) => {
     const error = data.toString();
     logger.error('[CLIP Service Error]', { error });
     console.error('[CLIP STDERR]', error); // ← Add this
   });
   ```

4. **Check if it's a permissions issue:**
   ```bash
   ls -la similarity_service.py
   # Should be readable: -rw-r--r-- or similar
   ```

---

## 📝 Next Steps

1. **Try Solution 1 first** (disable CLIP) to test v0.6 immediately
2. **Try Solution 2 or 3** to permanently fix CLIP
3. **Document which solution worked** for future reference
4. **Update this file** with your findings

---

## 🎉 Summary

- **v0.6 prompt strategy: WORKING** ✅
- **AI Analysis Service: WORKING** ✅
- **CLIP Service: Needs environment fix** ⚠️
- **Root cause: Python environment mismatch** (NOT code issue)
- **Quick fix: Disable CLIP in config** 
- **Permanent fix: Use virtual environment or system-wide install**

**The v0.6 changes are complete and functional!** 🚀

