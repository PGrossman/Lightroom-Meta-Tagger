# GPS Propagation - Testing Guide

## ✅ What Was Implemented

### 1. **Enhanced GPS Data Validation** (`formatGPSData()`)
- ✅ Type conversion: Handles both string and numeric GPS values
- ✅ NaN validation: Rejects invalid coordinates with warning logs
- ✅ Range validation: Ensures lat (-90 to 90), lon (-180 to 180)
- ✅ Altitude handling: Optional field with type conversion
- ✅ Graceful degradation: Returns empty string for invalid data

### 2. **GPS Priority System** (`generateXMPFiles()`)
Three-tier priority for GPS data sources:

**Priority 1: Manual GPS** (User edited on Visual Analysis page)
- Field: `metadata.gps.latitude/longitude`
- Source: "Manual Entry"
- User has full control via the GPS edit form

**Priority 2: AI Analysis GPS** (From balanced prompt)
- Field: `metadata.gpsAnalysis.latitude/longitude`
- Source: "AI Analysis"
- Extracted from AI-generated location data

**Priority 3: EXIF GPS** (From parent image)
- Field: `cluster.mainRep.gps.latitude/longitude`
- Source: "EXIF Data"
- Original GPS embedded in the image file

### 3. **Comprehensive Logging**
- 📍 GPS source identification (Manual/AI/EXIF)
- 📍 GPS coordinates logged for each cluster
- 📍 Image count showing propagation scope
- ⚠️ Warning logs for invalid GPS data

---

## 🧪 Testing Instructions

### Test 1: Manual GPS Entry
**Purpose:** Verify user can add/edit GPS coordinates

1. **Run the app** and process some images
2. **Go to AI Analysis tab** and select a cluster
3. **Click "📍 Add GPS Coordinates"**
4. **Enter test coordinates:**
   - Latitude: `51.389167` (Chernobyl)
   - Longitude: `30.099444`
   - Altitude: `100` (optional)
5. **Click "Save GPS"**
6. **Generate XMP files** for the cluster
7. **Verify in XMP file:**
   ```bash
   cat /path/to/image.xmp | grep -A 5 "GPS"
   ```
   **Expected output:**
   ```xml
   <exif:GPSLatitude>51.389167</exif:GPSLatitude>
   <exif:GPSLongitude>30.099444</exif:GPSLongitude>
   <exif:GPSVersionID>2.3.0.0</exif:GPSVersionID>
   <exif:GPSAltitude>100</exif:GPSAltitude>
   <exif:GPSAltitudeRef>0</exif:GPSAltitudeRef>
   ```

8. **Check console logs:**
   ```
   📍 Using manual GPS from metadata
   📍 GPS will be written to all cluster images
   ```

**✅ Success Criteria:**
- GPS appears in Visual Analysis page
- GPS saved with "Manual Entry" badge
- All cluster images receive the same GPS
- Console shows "Using manual GPS from metadata"

---

### Test 2: GPS from EXIF Data
**Purpose:** Verify GPS extraction from images with embedded GPS

1. **Use an image with EXIF GPS data** (e.g., from a phone camera)
2. **Process the image**
3. **Check Visual Analysis page** - GPS should auto-display
4. **Source badge should show:** "EXIF Data"
5. **Generate XMP** for the cluster
6. **Verify GPS propagates to all cluster images**

**✅ Success Criteria:**
- GPS auto-detected from EXIF
- Source badge: "EXIF Data"
- GPS copied to all cluster images
- Console: "Using GPS from EXIF"

---

### Test 3: GPS Priority Override
**Purpose:** Verify Manual GPS overrides EXIF GPS

1. **Use image with EXIF GPS** (e.g., lat: 40.7128, lon: -74.0060)
2. **Process and view in AI Analysis tab**
3. **GPS should show from EXIF** with correct coordinates
4. **Click "Edit" and change coordinates:**
   - New Lat: `51.389167`
   - New Lon: `30.099444`
5. **Save and generate XMP**
6. **Verify XMP uses MANUAL GPS**, not EXIF GPS

**✅ Success Criteria:**
- Original EXIF GPS displayed first
- Manual GPS overrides EXIF GPS
- XMP contains manual coordinates (51.389167, 30.099444)
- Console: "Using manual GPS from metadata"

---

### Test 4: GPS Validation (Invalid Coordinates)
**Purpose:** Verify validation rejects out-of-range GPS

1. **Add GPS with invalid latitude:**
   - Lat: `100` (out of range, should be -90 to 90)
   - Lon: `30.099444`
2. **Try to save**
3. **Should get error:** "Latitude must be between -90 and 90"

4. **Try invalid longitude:**
   - Lat: `51.389167`
   - Lon: `200` (out of range, should be -180 to 180)
5. **Should get error:** "Longitude must be between -180 and 180"

**✅ Success Criteria:**
- Invalid coordinates rejected at UI level
- Error messages guide user to correct values
- No invalid GPS written to XMP files

---

### Test 5: GPS Cluster Propagation
**Purpose:** Verify GPS written to ALL cluster images

1. **Select a cluster with multiple images:**
   - 1 parent representative
   - 4 bracketed images
   - 2 similar clusters (10 total images)
2. **Add GPS coordinates**
3. **Generate XMP files**
4. **Check EVERY XMP file in the cluster:**
   ```bash
   # Parent rep
   cat _GP_0222.CR2.xmp | grep "GPSLatitude"
   
   # Bracketed image 1
   cat _GP_0219.CR2.xmp | grep "GPSLatitude"
   
   # Similar cluster rep
   cat _GP_0231.CR2.xmp | grep "GPSLatitude"
   ```
5. **Verify ALL show the same GPS coordinates**

**✅ Success Criteria:**
- GPS in parent representative: ✅
- GPS in all 4 bracketed images: ✅
- GPS in all 2 similar cluster reps: ✅
- GPS in all similar cluster children: ✅
- **Total: All 10+ images have identical GPS**

---

### Test 6: GPS Copy to Clipboard
**Purpose:** Verify convenience feature works

1. **Display cluster with GPS**
2. **Click "📋 Copy Coordinates"**
3. **Paste into text editor**
4. **Should see:** `51.389167, 30.099444`

**✅ Success Criteria:**
- Button changes to "✅ Copied!" briefly
- Clipboard contains GPS in standard format
- Can paste into Google Maps search bar

---

### Test 7: GPS Removal
**Purpose:** Verify user can remove GPS if needed

1. **Add GPS to a cluster**
2. **Click "Edit"**
3. **Clear latitude/longitude fields**
4. **Click "Save GPS"**
5. **GPS display should disappear**
6. **Generate XMP - should NOT contain GPS tags**

**✅ Success Criteria:**
- GPS cleared from UI
- "Add GPS Coordinates" button reappears
- XMP files generated without GPS tags
- No warnings in console

---

## 🔍 Log Output Examples

### Valid GPS (Manual Entry)
```
[INFO] 📍 Using manual GPS from metadata {
  latitude: 51.389167,
  longitude: 30.099444,
  altitude: 100,
  source: 'Manual Entry'
}
[INFO] 📍 GPS will be written to all cluster images {
  latitude: 51.389167,
  longitude: 30.099444,
  altitude: 100,
  source: 'Manual Entry',
  imageCount: 10
}
```

### GPS from EXIF
```
[INFO] 📍 Using GPS from EXIF {
  latitude: 40.7128,
  longitude: -74.0060,
  altitude: null,
  source: 'EXIF Data'
}
```

### Invalid GPS (Warning)
```
[WARN] GPS coordinates out of range {
  latitude: 100,
  longitude: 30.099444
}
```

---

## 📊 XMP Format Reference

### Complete GPS Section in XMP
```xml
<!-- GPS Coordinates -->
<exif:GPSLatitude>51.389167</exif:GPSLatitude>
<exif:GPSLongitude>30.099444</exif:GPSLongitude>
<exif:GPSVersionID>2.3.0.0</exif:GPSVersionID>
<exif:GPSAltitude>100</exif:GPSAltitude>
<exif:GPSAltitudeRef>0</exif:GPSAltitudeRef>
```

### XMP Without GPS (No GPS data)
```xml
<!-- GPS Coordinates -->

      
<!-- Metadata Date -->
```

---

## 🐛 Troubleshooting

### GPS Not Appearing in UI
**Problem:** GPS coordinates don't show on Visual Analysis page

**Check:**
1. Is `displayGPSSection()` being called?
2. Check browser console for errors
3. Verify `currentAnalysisData.metadata.gps` exists

### GPS Not in XMP Files
**Problem:** XMP files generated but no GPS tags

**Check:**
1. Console logs: "📍 GPS will be written..."
2. Verify `metadata.gps` exists before XMP generation
3. Check `formatGPSData()` returns non-empty string
4. Look for validation warnings in console

### GPS Priority Not Working
**Problem:** Wrong GPS source is being used

**Check:**
1. Console should show which priority was used
2. Verify priority order: Manual > AI > EXIF
3. Check if `metadata.gps` vs `metadata.gpsAnalysis` vs `cluster.mainRep.gps`

---

## ✅ Implementation Checklist

- [x] GPS formatting with validation (`formatGPSData()`)
- [x] GPS priority logic (Manual > AI > EXIF)
- [x] Type conversion (string → float)
- [x] Range validation (-90 to 90, -180 to 180)
- [x] NaN validation
- [x] Altitude handling (optional)
- [x] EXIF namespace in XMP (`xmlns:exif`)
- [x] GPS display on Visual Analysis page
- [x] GPS edit form with validation
- [x] GPS copy to clipboard
- [x] GPS source badges (Manual/AI/EXIF)
- [x] Comprehensive logging
- [x] Cluster-wide propagation
- [x] Derivatives included in propagation

---

## 📝 Notes

### GPS Format in XMP
- Uses **decimal degrees** (not degrees/minutes/seconds)
- **Positive latitude** = North, **Negative** = South
- **Positive longitude** = East, **Negative** = West
- **Altitude reference**: 0 = above sea level, 1 = below sea level

### Lightroom Compatibility
- GPS tags use standard EXIF namespace
- Lightroom automatically recognizes GPS coordinates
- Map module will show image locations
- Can export with GPS embedded in files

### Google Maps Integration
- Coordinates can be pasted into Google Maps
- Format: `latitude, longitude` (e.g., `51.389167, 30.099444`)
- Opens location directly

---

**STATUS:** ✅ GPS Propagation Feature Complete & Ready for Testing
**LAST UPDATED:** 2025-10-13

