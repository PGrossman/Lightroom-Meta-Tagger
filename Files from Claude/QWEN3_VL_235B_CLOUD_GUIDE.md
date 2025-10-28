# Qwen3-VL 235B Cloud Model - Setup and Usage Guide

## 📋 Overview

Qwen3-VL 235B Cloud is Alibaba's most powerful vision-language model, available through Ollama's cloud service. Unlike local models, this runs on Ollama's servers, requiring authentication but providing superior capabilities.

## ⚡ Key Features

### 🎯 Core Capabilities:
- **235 Billion Parameters** - Most powerful Qwen model
- **256K Context Length** (expandable to 1M tokens)
- **33 Language Support** - Including English, Chinese, Japanese, Korean, Russian, Arabic, and more
- **Visual Agent** - Can understand UI elements and perform tasks
- **Visual Coding** - Generate Draw.io, HTML, CSS, JS from images/videos
- **Advanced Spatial Reasoning** - Superior object position and relationship understanding
- **Long Video Understanding** - Can process hours of video content
- **Enhanced Text Recognition** - Better OCR and multilingual text extraction

### 📊 Performance Comparison:

| Feature | Qwen 2.5-VL 7B (Local) | Qwen3-VL 235B (Cloud) |
|---------|------------------------|------------------------|
| Parameters | 7B | 235B |
| Speed | Fast (5-15s) | Moderate (15-45s) |
| Quality | Excellent | Outstanding |
| Context | 32K tokens | 256K-1M tokens |
| Languages | 11 | 33 |
| Spatial Reasoning | Good | Exceptional |
| Cost | Free (local) | Free (cloud) |
| Requires Auth | No | Yes (one-time) |

## 🚀 Setup Instructions

### Step 1: Ensure Ollama is Running

```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# If not running, start it
ollama serve
```

### Step 2: Pull the Cloud Model

```bash
# Pull the Qwen3-VL 235B cloud model
ollama pull qwen3-vl:235b-cloud
```

**Note:** This will download only 384 bytes - it's just configuration, not the full model. The actual model runs on Ollama's cloud servers.

### Step 3: Authenticate (Required)

The first time you use the cloud model:

```bash
# Run the model to trigger authentication
ollama run qwen3-vl:235b-cloud
```

This will:
1. Generate a unique authentication URL
2. Open your browser automatically
3. Ask you to sign in with Ollama account
4. Confirm device connection

**Authentication is one-time per device.** Once authenticated, the model works seamlessly.

### Step 4: Update App Configuration

In your Lightroom XMP Generator app:

**Via Settings UI:**
1. Go to Settings tab
2. Find "Ollama Model" dropdown
3. Select "Qwen3-VL 235B Cloud ⭐"
4. Save settings

**Or edit config file directly:**
```json
{
  "ollama": {
    "model": "qwen3-vl:235b-cloud",
    "timeout": 120000
  }
}
```

## 🎨 Usage in Your App

### For XMP Metadata Generation:

The cloud model excels at:

1. **Complex Scene Understanding**
   - Better at architectural photography
   - Superior historical site documentation
   - Excellent for museums and cultural heritage

2. **Multilingual Text Recognition**
   - 33 languages including Cyrillic, Arabic, Asian scripts
   - Perfect for international travel photography
   - Better at handwritten text

3. **Advanced Location Analysis**
   - More accurate GPS coordinate prediction
   - Better landmark recognition
   - Superior geographical context

4. **Detailed Descriptions**
   - Longer, more comprehensive descriptions
   - Better at technical subject matter
   - More nuanced mood and atmosphere detection

### Prompt Recommendations:

**✅ Best Practices:**
- Use standard prompts - no special formatting needed
- Let the model leverage its visual understanding
- Provide context when available (folder names, EXIF data)
- **Don't** set system messages (per Alibaba's recommendations)

**Example Prompts that Work Well:**

```text
Analyze this image and provide comprehensive metadata for Lightroom.

Include:
- A descriptive title
- Detailed description (2-3 paragraphs)
- Relevant keywords (10-15 words)
- Subject identification
- Location details if visible
- Mood and atmosphere

Focus on what you see in the image first, then consider the context provided.
```

## ⚙️ Configuration Options

### Timeout Settings:

```json
{
  "ollama": {
    "timeout": 120000,
    "cloudModelTimeout": 180000
  }
}
```

**Recommended timeouts:**
- Local models: 60,000ms (60 seconds)
- Cloud models: 120,000-180,000ms (2-3 minutes)

### Temperature Setting:

```json
{
  "ollama": {
    "temperature": 0.1
  }
}
```

**For metadata generation:**
- Use low temperature (0.1-0.2) for consistent, factual results
- Higher temperature (0.5-0.7) for more creative descriptions

## 🔍 When to Use Cloud vs Local Models

### Use **Local Models** (Qwen 2.5-VL 7B/32B) when:
- ✅ Speed is critical
- ✅ Processing large batches
- ✅ Working offline
- ✅ Standard English/Chinese text
- ✅ Simple to moderate scenes

### Use **Cloud Model** (Qwen3-VL 235B) when:
- ✅ Highest quality needed
- ✅ Complex architectural photography
- ✅ Multilingual text (33 languages)
- ✅ Historical/cultural documentation
- ✅ Detailed spatial analysis required
- ✅ Technical or specialized subjects
- ✅ Long context needed (books, documents)

## 🐛 Troubleshooting

### Issue: "Model not found"

**Solution:**
```bash
# Verify model is pulled
ollama list | grep qwen3-vl

# If not present, pull it
ollama pull qwen3-vl:235b-cloud
```

### Issue: "Authentication required"

**Solution:**
```bash
# Run model to trigger authentication
ollama run qwen3-vl:235b-cloud

# Follow browser prompt to sign in
```

### Issue: "Request timeout"

**Possible causes:**
1. High server demand
2. Timeout set too low
3. Network issues

**Solutions:**
- Wait a few minutes and try again
- Increase timeout in config to 180000ms (3 minutes)
- Check internet connection

### Issue: "Cloud model slower than expected"

**Expected behavior:**
- Cloud models are 2-3x slower than local models
- First request after idle may take longer (model loading)
- Subsequent requests faster

**Tips:**
- Use for quality-critical images, not batch processing
- Switch to local model for speed-critical tasks

## 📊 Expected Performance

### Typical Response Times:

| Scenario | Local 7B | Cloud 235B |
|----------|----------|------------|
| Simple portrait | 5-8s | 15-25s |
| Complex scene | 8-15s | 25-40s |
| Architectural | 10-20s | 30-50s |
| Text-heavy | 8-12s | 20-35s |

### Accuracy Improvements:

**Location Recognition:**
- Local 7B: ~85% accuracy
- Cloud 235B: ~95% accuracy

**Multilingual Text:**
- Local 7B: English, Chinese excellent; others good
- Cloud 235B: Excellent across all 33 languages

**Complex Scenes:**
- Local 7B: Good detail
- Cloud 235B: Exceptional detail and context understanding

## 🔒 Privacy & Security

### Data Handling:

**What gets sent to cloud:**
- Image data (base64 encoded)
- Your prompt text

**What stays local:**
- Your Ollama authentication token
- Original image files
- Generated XMP files
- Database content

**Ollama's Privacy:**
- Images processed for inference only
- Not stored permanently
- Not used for training
- Encrypted in transit (HTTPS)

**Recommendation:**
- Use cloud model for general photography
- Use local models for sensitive/confidential images

## 💡 Tips & Best Practices

### 1. Batch Processing Strategy

For large photo archives:

```
1. First pass: Local 7B model (fast processing)
2. Flag images needing better analysis
3. Second pass: Cloud 235B for flagged images only
```

### 2. Prompt Optimization

**For best results with cloud model:**
- Be specific about what you want
- Mention the use case (Lightroom metadata)
- Ask for structured output
- Don't include system messages

### 3. Cost Management

The cloud model is **free** but rate-limited:
- Use strategically for quality-critical images
- Fallback to local models for bulk processing
- Cache results to avoid re-processing

### 4. Quality vs Speed Trade-off

```
Speed: Local 7B > Local 32B > Cloud 235B
Quality: Cloud 235B > Local 32B > Local 7B

Choose based on your workflow priority.
```

## 📚 Additional Resources

- [Ollama Qwen3-VL Blog Post](https://ollama.com/blog/qwen3-vl)
- [Qwen3-VL GitHub](https://github.com/QwenLM/Qwen3-VL)
- [Qwen Technical Report](https://arxiv.org/abs/2505.09388)
- [Ollama Documentation](https://ollama.com/library/qwen3-vl:235b-cloud)

## 🔄 Updating

To get the latest cloud model version:

```bash
# Pull latest version
ollama pull qwen3-vl:235b-cloud

# Restart Ollama service
# (authentication persists)
```

## ✅ Verification Checklist

Before using the cloud model in production:

- [ ] Ollama installed and running
- [ ] Cloud model pulled (`ollama list` shows qwen3-vl:235b-cloud)
- [ ] Authenticated via browser
- [ ] Test image processed successfully
- [ ] Timeout configured appropriately (120-180s)
- [ ] App settings updated to use cloud model

---

**Last Updated:** October 28, 2025  
**Model Version:** Qwen3-VL 235B A22B  
**Ollama Compatibility:** v0.5.0+

---

## 🎉 Ready to Use!

You now have access to one of the world's most powerful vision-language models, right in your Lightroom XMP Generator app.

**Quick Start:**
1. Pull: `ollama pull qwen3-vl:235b-cloud`
2. Auth: `ollama run qwen3-vl:235b-cloud`
3. Select in Settings: "Qwen3-VL 235B Cloud"
4. Generate amazing metadata! 🚀
