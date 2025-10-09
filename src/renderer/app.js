// ============================================
// DEBUG: Verify script loaded
// ============================================
console.log('====================================');
console.log('APP.JS LOADED - TIMESTAMP:', new Date().toISOString());
console.log('====================================');

let selectedDirectory = null;
let scanResults = null;

// Pagination state
let currentPage = 1;
let rowsPerPage = 10;
let allClusters = [];

// UI Elements - Will be initialized after DOM loads
let selectDirBtn;
let dropzone;
let resultsTable;
let resultsTableBody;
let processImagesBtn;
let totalFilesEl;
let filesToProcessEl;
let progressFill;
let progressText;

// ============================================
// Initialize after DOM is ready
// ============================================
window.addEventListener('DOMContentLoaded', () => {
  console.log('DOM Content Loaded - Now initializing elements...');
  
  // Get all DOM elements
  selectDirBtn = document.getElementById('selectDirBtn');
  dropzone = document.getElementById('dropzone');
  resultsTable = document.getElementById('resultsTable');
  resultsTableBody = document.getElementById('resultsTableBody');
  processImagesBtn = document.getElementById('processImagesBtn');
  totalFilesEl = document.getElementById('totalFiles');
  filesToProcessEl = document.getElementById('filesToProcess');
  progressFill = document.getElementById('progressFill');
  progressText = document.getElementById('progressText');

  console.log('DEBUG: Element check after DOM load:');
  console.log('  selectDirBtn:', selectDirBtn);
  console.log('  dropzone:', dropzone);
  console.log('  resultsTable:', resultsTable);
  
  // Initialize all event listeners
  initializeEventListeners();
  
  // Check database on startup
  checkDatabaseOnStartup();
});

// Initialize modal listeners AFTER full page load (including modal HTML)
window.addEventListener('load', () => {
  console.log('🎬 Full page loaded - Initializing modal listeners...');
  initializeModalListeners();
});

// ============================================
// Event Listener Initialization
// ============================================
function initializeEventListeners() {
  console.log('Initializing event listeners...');
  
  // Tab switching
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabPanels = document.querySelectorAll('.tab-panel');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.dataset.tab;
      
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabPanels.forEach(panel => panel.classList.remove('active'));
      
      button.classList.add('active');
      document.getElementById(`${tabName}-tab`).classList.add('active');
    });
  });

  // Select directory button
  if (selectDirBtn) {
    console.log('DEBUG: Adding click listener to selectDirBtn');
    selectDirBtn.addEventListener('click', async () => {
      console.log('==== BUTTON CLICKED ====');
      try {
        await selectAndScanDirectory();
      } catch (error) {
        console.error('ERROR in button click handler:', error);
      }
    });
    console.log('✅ Select button listener attached');
  } else {
    console.error('CRITICAL ERROR: selectDirBtn is NULL after DOM load!');
  }

  // Dropzone event listeners
  if (dropzone) {
    console.log('DEBUG: Adding event listeners to dropzone');
    
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
    
    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', async (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      
      const files = e.dataTransfer.files;
      
      if (files.length > 0) {
        // In Electron, files[0].path gives the absolute file system path
        const droppedPath = files[0].path;
        console.log('Dropped path:', droppedPath);
        
        // Determine if it's a directory or file (await since it's now an IPC call)
        let dirToScan;
        const isDir = await window.electronAPI.isDirectory(droppedPath);
        if (isDir) {
          dirToScan = droppedPath;
          console.log('Directory dropped, scanning:', dirToScan);
        } else {
          dirToScan = await window.electronAPI.getParentDir(droppedPath);
          console.log('File dropped, scanning parent directory:', dirToScan);
        }
        
        // Scan the directory
        await selectAndScanDirectory(dirToScan);
      }
    });

    dropzone.addEventListener('click', async (e) => {
      console.log('Dropzone clicked, target:', e.target.id);
      if (e.target.id !== 'selectDirBtn') {
        console.log('Triggering selectAndScanDirectory from dropzone click');
        await selectAndScanDirectory();
      }
    });
    console.log('✅ Dropzone listeners attached');
  } else {
    console.error('CRITICAL ERROR: dropzone is NULL after DOM load!');
  }
  
  // Process Images button
  if (processImagesBtn) {
    processImagesBtn.addEventListener('click', async () => {
      await processImages();
    });
    console.log('✅ Process button listener attached');
  }
  
  // Settings tab event listeners
  const selectDbBtn = document.getElementById('selectDbBtn');
  const clearDbBtn = document.getElementById('clearDbBtn');
  const settingsTab = document.querySelector('[data-tab="settings"]');
  
  if (selectDbBtn) {
    selectDbBtn.addEventListener('click', handleSelectDatabase);
    console.log('✅ Settings database button listener attached');
  }
  
  if (clearDbBtn) {
    clearDbBtn.addEventListener('click', handleClearDatabase);
    console.log('✅ Clear database button listener attached');
  }
  
  if (settingsTab) {
    settingsTab.addEventListener('click', () => {
      loadSettings();
    });
    console.log('✅ Settings tab listener attached');
  }

  // Results tab event listeners
  const resultsTab = document.querySelector('[data-tab="results"]');
  if (resultsTab) {
    resultsTab.addEventListener('click', () => {
      loadProcessedResults();
    });
    console.log('✅ Results tab listener attached');
  }
  
  // AI Settings event listeners
  const saveAISettingsBtn = document.getElementById('saveAISettingsBtn');
  const testGoogleVisionBtn = document.getElementById('testGoogleVisionBtn');
  const toggleApiKeyVisibility = document.getElementById('toggleApiKeyVisibility');

  if (saveAISettingsBtn) {
    saveAISettingsBtn.addEventListener('click', handleSaveAISettings);
    console.log('✅ Save AI settings button listener attached');
  }

  if (testGoogleVisionBtn) {
    testGoogleVisionBtn.addEventListener('click', handleTestGoogleVision);
    console.log('✅ Test Google Vision button listener attached');
  }

  if (toggleApiKeyVisibility) {
    toggleApiKeyVisibility.addEventListener('click', () => {
      const apiKeyInput = document.getElementById('googleVisionApiKey');
      if (apiKeyInput) {
        apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
      }
    });
    console.log('✅ Toggle API key visibility listener attached');
  }

  // Personal Data tab listener
  const personalDataTab = document.querySelector('[data-tab="personal-data"]');
  if (personalDataTab) {
    personalDataTab.addEventListener('click', () => {
      console.log('✅ Personal Data tab clicked');
      loadPersonalData(); // Load saved data when tab opens
    });
    console.log('✅ Personal Data tab listener attached');
  }

  // Save Personal Data button
  const savePersonalDataBtn = document.getElementById('savePersonalDataBtn');
  if (savePersonalDataBtn) {
    savePersonalDataBtn.addEventListener('click', savePersonalData);
    console.log('✅ Save Personal Data button listener attached');
  }
  
  // Run Analysis button (Visual Analysis tab)
  const runAnalysisBtn = document.getElementById('runAnalysisBtn');
  if (runAnalysisBtn) {
    runAnalysisBtn.addEventListener('click', async () => {
      if (!allProcessedImages || allProcessedImages.length === 0) {
        alert('No processed images available to analyze');
        return;
      }
      
      
      // Disable button during analysis
      runAnalysisBtn.disabled = true;
      runAnalysisBtn.textContent = 'Analyzing...';
      
      // Batch analyze all clusters
      await batchAnalyzeAllClusters();
      
      // Re-enable button
      runAnalysisBtn.disabled = false;
      runAnalysisBtn.innerHTML = `
        <svg class="ai-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5"/>
          <path d="M2 12l10 5 10-5"/>
        </svg>
        Run AI Analysis
      `;
      
      // Switch to AI Analysis tab to view results
      const aiAnalysisTab = document.querySelector('[data-tab="ai-analysis"]');
      if (aiAnalysisTab) {
        aiAnalysisTab.click();
      }
    });
    console.log('✅ Run Analysis button listener attached');
  }
  
  // Initialize AI Analysis listeners
  initializeAIAnalysisListeners();
  
  console.log('✅ All event listeners initialized successfully!');
}

// ============================================
// Main Scan Function
// ============================================
async function selectAndScanDirectory(dirPath = null) {
  console.log('==== selectAndScanDirectory CALLED ====');
  
  try {
    // If dirPath is provided (from drag & drop), use it directly
    if (dirPath) {
      console.log('Using provided directory path:', dirPath);
      selectedDirectory = dirPath;
    } else {
      // Otherwise, show directory selection dialog
      console.log('Step 1: Calling selectDirectory...');
      const result = await window.electronAPI.selectDirectory();
      console.log('Step 2: Directory result:', result);
      
      if (result.canceled) {
        console.log('Step 3: User canceled selection');
        return;
      }
      
      selectedDirectory = result.path;
      console.log('Step 4: Selected directory:', selectedDirectory);
    }
    
    // Update status
    console.log('Step 5: Updating UI status...');
    updateStatus('Scanning directory and analyzing timestamps...', 'scanning');
    showProgress(10);
    
    console.log('Step 6: Starting scan with clustering...');
    
    // Perform scan WITH CLUSTERING (5 second threshold)
    const response = await window.electronAPI.scanDirectoryWithClustering(
      selectedDirectory,
      5  // 5 second threshold for bracketed shots
    );
    
    console.log('Step 7: Scan response received:', response);
    
    showProgress(100);
    
    if (!response.success) {
      throw new Error(response.error);
    }
    
    scanResults = response.results;
    const summary = response.summary;
    
    // Store globally for processing
    window.scanResults = scanResults;
    window.selectedDirectory = selectedDirectory;
    
    console.log('Step 8: Scan results:', scanResults);
    console.log('Step 9: Summary:', summary);
    console.log('Step 9b: Stored globally:', { 
      hasScanResults: !!window.scanResults, 
      hasSelectedDir: !!window.selectedDirectory 
    });
    
    // Update UI with results
    displayScanResults(summary);
    populateResultsTableWithClusters(scanResults);
    
    updateStatus('Scan complete with timestamp clustering!', 'ready');
    
    // Enable the process button
    if (processImagesBtn) {
      processImagesBtn.disabled = false;
    }
    
    console.log('Step 10: UI updated successfully!');
    
  } catch (error) {
    console.error('ERROR in selectAndScanDirectory:', error);
    updateStatus(`Error: ${error.message}`, 'error');
    showProgress(0);
  }
}

// ============================================
// Helper Functions
// ============================================

// Update status display
function updateStatus(message, status = 'pending') {
  console.log(`[${status}] ${message}`);
}

// Update progress bar
function showProgress(percent) {
  progressFill.style.width = `${percent}%`;
  progressText.textContent = `${percent}%`;
}

// Display scan summary in status panel
function displayScanResults(summary) {
  // DEBUG: Log what we're receiving
  console.log('displayScanResults summary:', summary);
  console.log('totalFiles:', summary.totalFiles, 'type:', typeof summary.totalFiles);
  console.log('totalBaseImages:', summary.totalBaseImages, 'type:', typeof summary.totalBaseImages);
  console.log('totalDerivatives:', summary.totalDerivatives, 'type:', typeof summary.totalDerivatives);
  
  // Ensure numeric addition, not string concatenation
  const totalFiles = Number(summary.totalFiles) || (Number(summary.totalBaseImages) + Number(summary.totalDerivatives));
  console.log('Calculated totalFiles:', totalFiles);
  totalFilesEl.textContent = totalFiles;
  filesToProcessEl.textContent = summary.totalClusters || summary.totalBaseImages;
  
  // Add clustering info if available
  if (summary.totalClusters) {
    // Check if cluster info already exists
    let clusterInfo = document.querySelector('.cluster-info');
    if (!clusterInfo) {
      clusterInfo = document.createElement('div');
      clusterInfo.className = 'cluster-info';
      document.querySelector('.status-grid').appendChild(clusterInfo);
    }
    
    clusterInfo.innerHTML = `
      <div class="status-item">
        <span class="status-label">Bracketed Groups:</span>
        <span class="status-value">${summary.bracketedClusters}</span>
      </div>
      <div class="status-item">
        <span class="status-label">Single Images:</span>
        <span class="status-value">${summary.singletonClusters}</span>
      </div>
    `;
  }
  
  // Show the results table
  resultsTable.style.display = 'block';
}

// ============================================
// PHASE 2: Process Images Function
// ============================================
async function processImages() {
  try {
    console.log('Process Images clicked!');
    
    // Validate that we have scan results
    if (!window.scanResults || !window.selectedDirectory) {
      alert('Please scan a directory first before processing images.');
      return;
    }

    // Disable button during processing
    if (processImagesBtn) {
      processImagesBtn.disabled = true;
      processImagesBtn.style.display = 'flex';
      processImagesBtn.textContent = 'Processing...';
    }

    // Update progress
    updateStatus('Processing images...', 'processing');
    showProgress(0);

    console.log('Starting image processing...', {
      clusters: window.scanResults.clusters?.length,
      directory: window.selectedDirectory
    });

    // Call the backend processing pipeline
    console.log('=== CALLING processImages IPC ===');
    console.log('Arguments:', { scanResults: !!window.scanResults, dirPath: window.selectedDirectory });
    
    const result = await window.electronAPI.processImages(
      window.scanResults,
      window.selectedDirectory
    );
    
    console.log('=== processImages IPC COMPLETED ===');

    console.log('Processing complete:', result);

    if (result.success) {
      updateStatus('Processing complete!', 'complete');
      showProgress(100);
      
      // Store processed clusters and similarity results globally for Results tab
      window.processedClusters = result.processedClusters;
      window.similarityResults = result.similarityResults || [];
      
      // 🔍 DEBUG: Log similarity data stored in window
      console.log('🔍 ===== SIMILARITY DATA STORED IN WINDOW =====');
      console.log(`📊 window.similarityResults length: ${window.similarityResults?.length || 0}`);
      if (window.similarityResults && window.similarityResults.length > 0) {
        console.log('📋 First pair:', window.similarityResults[0]);
      }
      console.log('🔍 ==========================================\n');
      
      // Switch to Results tab directly (no alert popup)
      const resultsTab = document.querySelector('[data-tab="results"]');
      if (resultsTab) {
        resultsTab.click();
      }

    } else {
      throw new Error(result.error || 'Processing failed');
    }

  } catch (error) {
    console.error('Process images failed:', error);
    updateStatus(`Processing failed: ${error.message}`, 'error');
    alert(`Processing failed: ${error.message}`);
  } finally {
    // Re-enable button
    if (processImagesBtn) {
      processImagesBtn.disabled = false;
      processImagesBtn.innerHTML = `
        <svg class="process-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 6v6l4 2"/>
        </svg>
        Process Images
      `;
    }
  }
}

// Listen for progress updates from backend
if (window.electronAPI && window.electronAPI.onProgress) {
  window.electronAPI.onProgress((progressData) => {
    console.log('Progress update:', progressData);
    
    if (progressData.percent !== undefined) {
      showProgress(progressData.percent);
    }
    
    if (progressData.message) {
      updateStatus(progressData.message, progressData.stage || 'processing');
    }
  });
}

// Populate the results table (fallback method for non-clustered data)
function populateResultsTable(results) {
  resultsTableBody.innerHTML = '';
  
  const sortedBases = Object.keys(results.derivatives).sort();
  
  sortedBases.forEach(baseImage => {
    const derivatives = results.derivatives[baseImage];
    const row = createTableRow(baseImage, derivatives);
    resultsTableBody.appendChild(row);
  });
  
  // Show table wrapper, hide pagination controls
  document.getElementById('tableWrapper').style.display = 'block';
  document.getElementById('paginationTop').style.display = 'none';
  document.getElementById('paginationBottom').style.display = 'none';
}

// Create a simple table row
function createTableRow(baseImagePath, derivatives) {
  const row = document.createElement('tr');
  
  const pathParts = baseImagePath.split('/');
  const filename = pathParts[pathParts.length - 1];
  const directory = pathParts.slice(0, -1).join('/');
  
  // Parent Image column
  const parentCell = document.createElement('td');
  
  // Filename on first line
  const parentText = document.createElement('div');
  parentText.className = 'parent-image';
  parentText.textContent = filename;
  
  // Count on second line (if derivatives exist)
  if (derivatives.length > 0) {
    const countDiv = document.createElement('div');
    countDiv.className = 'parent-count';
    countDiv.textContent = `${derivatives.length} derivative${derivatives.length > 1 ? 's' : ''}`;
    parentCell.appendChild(parentText);
    parentCell.appendChild(countDiv);
  } else {
    parentCell.appendChild(parentText);
  }
  
  // Child Images column
  const childCell = document.createElement('td');
  childCell.className = 'child-images';
  
  if (derivatives.length === 0) {
    childCell.textContent = '—';
  } else {
    derivatives.forEach(derivPath => {
      const derivName = derivPath.split('/').pop();
      const badge = document.createElement('span');
      badge.className = 'child-image-item derivative-badge';
      badge.textContent = derivName;
      badge.title = 'Edited derivative';
      childCell.appendChild(badge);
    });
  }
  
  // GPS Data column
  const gpsCell = document.createElement('td');
  const gpsSpan = document.createElement('span');
  gpsSpan.className = 'gps-status';
  gpsSpan.textContent = '— No GPS';
  gpsSpan.style.color = '#6c757d'; // Gray
  gpsCell.appendChild(gpsSpan);
  
  // Status column
  const statusCell = document.createElement('td');
  const statusBadge = document.createElement('span');
  statusBadge.className = 'status-badge status-ready';
  statusBadge.textContent = 'Ready';
  statusCell.appendChild(statusBadge);
  
  // Append all cells
  row.appendChild(parentCell);
  row.appendChild(childCell);
  row.appendChild(gpsCell);
  row.appendChild(statusCell);
  
  return row;
}

// Populate the results table with clustered data
function populateResultsTableWithClusters(results) {
  console.log('=== POPULATE TABLE DEBUG ===');
  console.log('Total clusters received:', results.clusters ? results.clusters.length : 0);
  
  // Debug: Show first cluster sample
  if (results.clusters && results.clusters.length > 0) {
    console.log('First cluster sample:', results.clusters[0]);
    console.log('Representative field:', results.clusters[0].representative);
    console.log('ImagePaths field:', results.clusters[0].imagePaths);
    console.log('Images field:', results.clusters[0].images);
  }
  
  // Store scan results globally for pagination
  window.scanResults = results;
  allClusters = results.clusters || [];
  currentPage = 1;
  
  if (allClusters.length === 0) {
    console.log('No clusters found, using fallback table method');
    populateResultsTable(results);
    return;
  }
  
  console.log('Starting paginated rendering...');
  
  // Render first page
  renderPage();
  setupPaginationControls();
  
  // Show pagination and table
  document.getElementById('paginationTop').style.display = 'flex';
  document.getElementById('paginationBottom').style.display = 'flex';
  document.getElementById('tableWrapper').style.display = 'block';
  
  console.log('=== END TABLE DEBUG ===');
}

// Render current page of results
function renderPage() {
  resultsTableBody.innerHTML = '';
  
  const start = (currentPage - 1) * rowsPerPage;
  const end = Math.min(start + rowsPerPage, allClusters.length);
  const pageRows = allClusters.slice(start, end);
  
  console.log(`Rendering page ${currentPage}: rows ${start + 1} to ${end}`);
  
  // Enhanced debug logging
  console.log('=== RENDERING DEBUG ===');
  pageRows.forEach((cluster, idx) => {
    console.log(`Row ${idx}:`, {
      representative: cluster.representative,
      imageCount: cluster.imageCount,
      images: cluster.images,
      isBracketed: cluster.isBracketed
    });
  });
  
  pageRows.forEach(cluster => {
    const row = createClusterTableRow(cluster, window.scanResults || { derivatives: {} });
    console.log('Row created, HTML length:', row.outerHTML.length);
    console.log('Row HTML preview:', row.outerHTML.substring(0, 200));
    resultsTableBody.appendChild(row);
  });
  
  console.log('Total rows in tbody after render:', resultsTableBody.children.length);
  console.log('Tbody display style:', resultsTableBody.parentElement.style.display);
  console.log('=== END RENDERING ===');
  
  updatePaginationInfo();
}

// Update pagination display
function updatePaginationInfo() {
  const start = (currentPage - 1) * rowsPerPage + 1;
  const end = Math.min(currentPage * rowsPerPage, allClusters.length);
  const total = allClusters.length;
  const info = `Showing ${start}-${end} of ${total}`;
  
  document.getElementById('pageInfoTop').textContent = info;
  document.getElementById('pageInfoBottom').textContent = info;
  
  const totalPages = Math.ceil(total / rowsPerPage);
  
  // Enable/disable buttons
  ['Top', 'Bottom'].forEach(suffix => {
    document.getElementById(`firstPage${suffix}`).disabled = currentPage === 1;
    document.getElementById(`prevPage${suffix}`).disabled = currentPage === 1;
    document.getElementById(`nextPage${suffix}`).disabled = currentPage === totalPages;
    document.getElementById(`lastPage${suffix}`).disabled = currentPage === totalPages;
  });
}

// Setup pagination button handlers
function setupPaginationControls() {
  ['Top', 'Bottom'].forEach(suffix => {
    document.getElementById(`firstPage${suffix}`).onclick = () => {
      currentPage = 1;
      renderPage();
    };
    
    document.getElementById(`prevPage${suffix}`).onclick = () => {
      if (currentPage > 1) {
        currentPage--;
        renderPage();
      }
    };
    
    document.getElementById(`nextPage${suffix}`).onclick = () => {
      const totalPages = Math.ceil(allClusters.length / rowsPerPage);
      if (currentPage < totalPages) {
        currentPage++;
        renderPage();
      }
    };
    
    document.getElementById(`lastPage${suffix}`).onclick = () => {
      currentPage = Math.ceil(allClusters.length / rowsPerPage);
      renderPage();
    };
  });
}

// Create a table row for a cluster
function createClusterTableRow(cluster, allResults) {
  const row = document.createElement('tr');
  
  if (cluster.isBracketed) {
    row.classList.add('bracketed-row');
  }
  
  // Extract just the filename from the full path
  const representativePath = cluster.representative;
  const representativeFilename = representativePath.split('/').pop();
  
  // Pre-calculate derivatives for ALL images in cluster (used in multiple places)
  const allDerivatives = [];
  cluster.imagePaths.forEach(imagePath => {
    const derivs = allResults.derivatives[imagePath] || [];
    allDerivatives.push(...derivs);
  });
  
  // Parent Image column
  const parentCell = document.createElement('td');
  
  // Filename on first line
  const parentText = document.createElement('div');
  parentText.className = 'parent-image';
  parentText.textContent = representativeFilename;
  
  // Count bracketed images and derivatives
  const bracketedCount = cluster.imageCount > 1 ? cluster.imageCount : 0;
  const derivativeCount = allDerivatives.length;
  
  // Build count string
  const countParts = [];
  if (bracketedCount > 0) {
    countParts.push(`${bracketedCount} bracketed`);
  }
  if (derivativeCount > 0) {
    countParts.push(`${derivativeCount} derivatives`);
  }
  
  // Count on second line
  if (countParts.length > 0) {
    const countDiv = document.createElement('div');
    countDiv.className = 'parent-count';
    countDiv.textContent = countParts.join(', ');
    parentCell.appendChild(parentText);
    parentCell.appendChild(countDiv);
  } else {
    parentCell.appendChild(parentText);
  }
  
  // Child Images column
  const childCell = document.createElement('td');
  childCell.className = 'child-images';
  
  if (cluster.isBracketed) {
    // ✅ FIX: Use imagePaths and extract just the filename
    const imagesToDisplay = cluster.imagePaths || cluster.images;
    
    imagesToDisplay.forEach(imagePath => {
      // Skip the representative
      if (imagePath === cluster.representative || imagePath === cluster.representativePath) {
        return;
      }
      
      const badge = document.createElement('span');
      badge.className = 'child-image-item bracketed-badge';
      badge.textContent = imagePath.split('/').pop(); // ✅ Extract just filename
      badge.title = 'Bracketed shot';
      childCell.appendChild(badge);
    });
  }
  
  // Render derivative badges (allDerivatives already calculated above)
  if (allDerivatives.length > 0) {
    allDerivatives.forEach(derivPath => {
      const derivName = derivPath.split('/').pop();
      const badge = document.createElement('span');
      badge.className = 'child-image-item derivative-badge';
      badge.textContent = derivName;
      badge.title = 'Edited derivative';
      childCell.appendChild(badge);
    });
  }
  
  if (!cluster.isBracketed && allDerivatives.length === 0) {
    childCell.textContent = '—';
  }
  
  // GPS Data column
  const gpsCell = document.createElement('td');
  const gpsSpan = document.createElement('span');
  gpsSpan.className = 'gps-status';
  
  // Check if GPS data exists (will be populated when backend GPS extraction is implemented)
  if (cluster.hasGPS) {
    gpsSpan.textContent = '✓ GPS Available';
    gpsSpan.style.color = '#10b981'; // Green
  } else {
    gpsSpan.textContent = '— No GPS';
    gpsSpan.style.color = '#6c757d'; // Gray
  }
  
  gpsCell.appendChild(gpsSpan);
  
  // Status column
  const statusCell = document.createElement('td');
  const statusBadge = document.createElement('span');
  statusBadge.className = 'status-badge status-ready';
  statusBadge.textContent = cluster.isBracketed ? 'Bracketed Ready' : 'Ready';
  statusCell.appendChild(statusBadge);
  
  // Append all cells
  row.appendChild(parentCell);
  row.appendChild(childCell);
  row.appendChild(gpsCell);
  row.appendChild(statusCell);
  
  return row;
}

// ============================================
// Settings Tab Functionality
// ============================================

async function loadSettings() {
  try {
    const settings = await window.electronAPI.getAllSettings();
    
    // Database settings
    const dbPathInput = document.getElementById('dbPath');
    if (settings.databasePath && dbPathInput) {
      dbPathInput.value = settings.databasePath;
    }
    
    const thresholdInput = document.getElementById('timestampThreshold');
    if (thresholdInput) {
      thresholdInput.value = settings.timestampThreshold || 5;
    }
    
    // AI Analysis settings
    const ollamaEndpoint = document.getElementById('ollamaEndpoint');
    const ollamaModel = document.getElementById('ollamaModel');
    const confidenceThreshold = document.getElementById('confidenceThreshold');
    const googleVisionApiKey = document.getElementById('googleVisionApiKey');
    
    if (ollamaEndpoint) ollamaEndpoint.value = settings.ollama?.endpoint || 'http://localhost:11434';
    if (ollamaModel) ollamaModel.value = settings.ollama?.model || 'qwen2.5vl:latest';
    if (confidenceThreshold) confidenceThreshold.value = settings.aiAnalysis?.confidenceThreshold || 85;
    if (googleVisionApiKey) googleVisionApiKey.value = settings.googleVision?.apiKey || '';
    
    await loadDatabaseStats();
    
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
}

async function loadDatabaseStats() {
  try {
    const response = await window.electronAPI.getDatabaseStats();
    
    if (response.success && response.stats) {
      document.getElementById('statImages').textContent = response.stats.images;
      document.getElementById('statDerivatives').textContent = response.stats.derivatives;
      document.getElementById('statClusters').textContent = response.stats.clusters;
      document.getElementById('statAnalyzed').textContent = response.stats.analyzed;
      document.getElementById('statFileSize').textContent = response.fileSize;
    }
  } catch (error) {
    console.error('Failed to load database stats:', error);
  }
}

async function handleSelectDatabase() {
  try {
    const result = await window.electronAPI.selectDatabaseLocation();
    
    if (result.canceled) {
      return;
    }
    
    const response = await window.electronAPI.setDatabasePath(result.path);
    
    if (response.success) {
      const dbPathInput = document.getElementById('dbPath');
      if (dbPathInput) {
        dbPathInput.value = response.dbPath;
      }
      await loadDatabaseStats();
      alert('Database location set successfully!');
    } else {
      alert(`Failed to set database location: ${response.error}`);
    }
    
  } catch (error) {
    console.error('Error setting database location:', error);
    alert(`Error: ${error.message}`);
  }
}

async function handleClearDatabase() {
  const confirmed = confirm(
    '⚠️ WARNING: This will delete ALL records from the database.\n\n' +
    'This action cannot be undone!\n\n' +
    'Are you sure you want to continue?'
  );
  
  if (!confirmed) {
    return;
  }
  
  try {
    const response = await window.electronAPI.clearDatabase();
    
    if (response.success) {
      await loadDatabaseStats();
      alert('Database cleared successfully!');
    } else {
      alert(`Failed to clear database: ${response.error}`);
    }
    
  } catch (error) {
    console.error('Error clearing database:', error);
    alert(`Error: ${error.message}`);
  }
}

async function checkDatabaseOnStartup() {
  try {
    const status = await window.electronAPI.checkDatabaseStatus();
    
    if (status.needsSetup) {
      const setupNow = confirm(
        'Database not found!\n\n' +
        'Please select an existing database or choose a location to create a new one.\n\n' +
        'Click OK to set up database now, or Cancel to set it up later in Settings.'
      );
      
      if (setupNow) {
        const settingsTab = document.querySelector('[data-tab="settings"]');
        if (settingsTab) {
          settingsTab.click();
        }
        
        const selectDbBtn = document.getElementById('selectDbBtn');
        setTimeout(() => {
          if (selectDbBtn) {
            selectDbBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            selectDbBtn.style.animation = 'pulse 1s ease-in-out 3';
          }
        }, 500);
      }
    }
  } catch (error) {
    console.error('Failed to check database status:', error);
  }
}

// ============================================
// Results Tab - Load Processed Data
// ============================================
let resultsCurrentPage = 1;
let resultsRowsPerPage = 10;
let allProcessedImages = [];

/**
 * Build similarity groups using Union-Find algorithm
 * Groups connected clusters together and picks the best representative
 */
function buildSimilarityGroups(clusters, similarityResults) {
  console.log('🔗 Building similarity groups...');
  console.log('Input clusters:', clusters.length);
  console.log('Similarity pairs:', similarityResults.length);
  
  // Create a map of cluster path to cluster object
  const clusterMap = new Map();
  clusters.forEach(cluster => {
    clusterMap.set(cluster.representativePath, cluster);
  });
  
  // Union-Find data structure
  const parent = new Map();
  const rank = new Map();
  
  // Initialize each cluster as its own parent
  clusters.forEach(cluster => {
    parent.set(cluster.representativePath, cluster.representativePath);
    rank.set(cluster.representativePath, 0);
  });
  
  // Find with path compression
  function find(x) {
    if (parent.get(x) !== x) {
      parent.set(x, find(parent.get(x)));
    }
    return parent.get(x);
  }
  
  // Union by rank
  function union(x, y) {
    const rootX = find(x);
    const rootY = find(y);
    
    if (rootX === rootY) return;
    
    const rankX = rank.get(rootX);
    const rankY = rank.get(rootY);
    
    if (rankX < rankY) {
      parent.set(rootX, rootY);
    } else if (rankX > rankY) {
      parent.set(rootY, rootX);
    } else {
      parent.set(rootY, rootX);
      rank.set(rootX, rankX + 1);
    }
  }
  
  // Union all similar pairs
  similarityResults.forEach(sim => {
    union(sim.rep1, sim.rep2);
  });
  
  // Group clusters by their root parent
  const groups = new Map();
  clusters.forEach(cluster => {
    const root = find(cluster.representativePath);
    if (!groups.has(root)) {
      groups.set(root, []);
    }
    groups.get(root).push(cluster);
  });
  
  console.log(`📦 Created ${groups.size} groups from ${clusters.length} clusters`);
  
  // Build final group objects
  const similarityGroups = [];
  
  groups.forEach((groupClusters, root) => {
    // Count similarity connections for each cluster in this group
    const connectionCounts = new Map();
    
    groupClusters.forEach(cluster => {
      const connections = similarityResults.filter(
        sim => sim.rep1 === cluster.representativePath || sim.rep2 === cluster.representativePath
      );
      connectionCounts.set(cluster.representativePath, connections.length);
    });
    
    // Pick the cluster with the most connections as main representative
    let mainRep = groupClusters[0];
    let maxConnections = connectionCounts.get(mainRep.representativePath) || 0;
    
    groupClusters.forEach(cluster => {
      const count = connectionCounts.get(cluster.representativePath) || 0;
      if (count > maxConnections) {
        maxConnections = count;
        mainRep = cluster;
      }
    });
    
    // Get all similar representatives (others in the group)
    const similarReps = groupClusters
      .filter(c => c.representativePath !== mainRep.representativePath)
      .map(c => {
        // Find the similarity score between mainRep and this cluster
        const simPair = similarityResults.find(
          sim => (sim.rep1 === mainRep.representativePath && sim.rep2 === c.representativePath) ||
                 (sim.rep2 === mainRep.representativePath && sim.rep1 === c.representativePath)
        );
        
        return {
          cluster: c,
          similarityPercent: simPair ? simPair.similarityPercent : 0
        };
      });
    
    const group = {
      mainRep: mainRep,
      similarReps: similarReps,
      allClusters: groupClusters,
      connectionCount: maxConnections
    };
    
    similarityGroups.push(group);
    
    console.log(`  Group: ${mainRep.representativeFilename} (${maxConnections} connections) + ${similarReps.length} similar`);
  });
  
  // Sort groups by connection count (most connected first)
  similarityGroups.sort((a, b) => b.connectionCount - a.connectionCount);
  
  console.log('✅ Similarity groups built successfully');
  console.log('🔍 DEBUG: Final group count:', similarityGroups.length);
  console.log('🔍 DEBUG: Final groups:');
  similarityGroups.forEach((g, idx) => {
    console.log(`  ${idx}: ${g.mainRep.representativeFilename} + ${g.similarReps.length} similar`);
  });
  
  return similarityGroups;
}

async function loadProcessedResults() {
  try {
    console.log('Loading processed clusters from memory...');
    
    const resultsContent = document.getElementById('resultsContent');
    const resultsTableContainer = document.getElementById('resultsTableContainer');
    
    // Check if we have processed clusters from the last processing run
    if (!window.processedClusters || window.processedClusters.length === 0) {
      resultsContent.innerHTML = `
        <div class="no-results">
          <h3>No Processed Results</h3>
          <p>No images have been processed yet. Scan a directory and process some images to see results here.</p>
          <button onclick="document.querySelector('[data-tab=\\"ingest\\"]').click()" class="select-btn">
            Go to Ingest Tab
          </button>
        </div>
      `;
      resultsContent.style.display = 'block';
      resultsTableContainer.style.display = 'none';
      return;
    }

    // Build similarity groups if we have similarity results
    if (window.similarityResults && window.similarityResults.length > 0) {
      console.log('Building similarity groups...');
      const groups = buildSimilarityGroups(window.processedClusters, window.similarityResults);
      
      // ✅ DEDUPLICATE - Remove groups with same mainRep
      const seenPaths = new Set();
      const uniqueGroups = [];
      
      groups.forEach((group, idx) => {
        const repPath = group.mainRep.representativePath;
        if (!seenPaths.has(repPath)) {
          seenPaths.add(repPath);
          uniqueGroups.push(group);
          console.log(`✅ Keep group ${idx}: ${group.mainRep.representativeFilename}`);
        } else {
          console.log(`❌ Skip duplicate group ${idx}: ${group.mainRep.representativeFilename}`);
        }
      });
      
      allProcessedImages = uniqueGroups;
      console.log(`Loaded ${uniqueGroups.length} unique similarity groups (removed ${groups.length - uniqueGroups.length} duplicates)`);
    } else {
      // No similarity results, treat each cluster as its own group
      allProcessedImages = window.processedClusters.map(cluster => ({
        mainRep: cluster,
        similarReps: [],
        allClusters: [cluster],
        connectionCount: 0
      }));
      console.log('Loaded processed clusters (no similarity grouping):', allProcessedImages.length);
    }

    // Hide empty state, show table
    resultsContent.style.display = 'none';
    resultsTableContainer.style.display = 'block';

    // Reset to first page
    resultsCurrentPage = 1;

    // Render table - ✅ ADD AWAIT
    await renderResultsPage();
    setupResultsPaginationControls();
    
    // Similarity summary removed - grouping in table is sufficient

  } catch (error) {
    console.error('Failed to load processed results:', error);
    const resultsContent = document.getElementById('resultsContent');
    if (resultsContent) {
      resultsContent.style.display = 'block';
      document.getElementById('resultsTableContainer').style.display = 'none';
      resultsContent.innerHTML = `
        <div class="error-state">
          <h3>Error Loading Results</h3>
          <p>Failed to load processed results: ${error.message}</p>
          <button onclick="loadProcessedResults()" class="select-btn">
            Try Again
          </button>
        </div>
      `;
    }
  }
}

// Render current page of results
async function renderResultsPage() {
  const tbody = document.getElementById('processedResultsTableBody'); // CHANGED ID
  if (!tbody) {
    console.error('ERROR: processedResultsTableBody not found!');
    return;
  }

  tbody.innerHTML = '';

  const start = (resultsCurrentPage - 1) * resultsRowsPerPage;
  const end = Math.min(start + resultsRowsPerPage, allProcessedImages.length);
  const pageGroups = allProcessedImages.slice(start, end);

  console.log(`Rendering results page ${resultsCurrentPage}: rows ${start + 1} to ${end}`);
  console.log('Groups to render:', pageGroups.length);

  // ✅ FIX: Use Promise.all to wait for all async row creations
  const rows = await Promise.all(
    pageGroups.map(group => createResultsTableRowFromGroup(group))
  );
  
  // Append all rows at once
  rows.forEach(row => {
    tbody.appendChild(row);
  });

  console.log('Rows added to tbody:', tbody.children.length);

  updateResultsPaginationInfo();
}

// Create a table row for a similarity group
async function createResultsTableRowFromGroup(group) {
  console.log('📋 Creating row for group:', {
    mainRep: group.mainRep.representativeFilename,
    similarCount: group.similarReps.length,
    totalClusters: group.allClusters.length
  });

  const cluster = group.mainRep; // Use the main representative for the row
  const row = document.createElement('tr');

  // Column 1: Thumbnail + Parent Image Name (vertical layout)
  const thumbCell = document.createElement('td');
  thumbCell.style.width = '200px';
  thumbCell.style.verticalAlign = 'top';
  
  // Container for thumbnail + info (vertical layout)
  const thumbContainer = document.createElement('div');
  thumbContainer.className = 'parent-thumbnail-container';
  
  // Thumbnail
  const thumbnail = document.createElement('img');
  thumbnail.className = 'parent-thumbnail';
  thumbnail.alt = cluster.representativeFilename;
  thumbnail.title = 'Click to preview';
  
  // Set placeholder first
  thumbnail.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 24 24" fill="none" stroke="%236c757d" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
  
  // Load actual thumbnail
  const thumbPath = cluster.representativePath || cluster.representative;
  loadThumbnail(thumbPath, thumbnail);
  
  // Make thumbnail clickable
  thumbnail.style.cursor = 'pointer';
  thumbnail.onclick = () => {
    showImagePreview(
      cluster.representativePath,
      cluster.representativeFilename
    );
  };
  
  // Info below thumbnail
  const infoDiv = document.createElement('div');
  infoDiv.className = 'parent-info';
  
  // Similar count (if any)
  if (group.similarReps.length > 0) {
    const similarCountDiv = document.createElement('div');
    similarCountDiv.className = 'similar-count';
    similarCountDiv.textContent = `🔗 ${group.similarReps.length} similar cluster${group.similarReps.length > 1 ? 's' : ''}`;
    infoDiv.appendChild(similarCountDiv);
  }
  
  // Filename
  const fileName = document.createElement('div');
  fileName.className = 'parent-filename';
  fileName.textContent = cluster.representativeFilename || cluster.representative || 'Unknown';
  infoDiv.appendChild(fileName);
  
  // Bracketed count
  if (cluster.isBracketed) {
    const countDiv = document.createElement('div');
    countDiv.className = 'parent-count';
    countDiv.textContent = `${cluster.imageCount} bracketed images`;
    infoDiv.appendChild(countDiv);
  }
  
  thumbContainer.appendChild(thumbnail);
  thumbContainer.appendChild(infoDiv);
  thumbCell.appendChild(thumbContainer);

  // Column 2: Similar Parent Representatives (show OTHER clusters in the group)
  const similarCell = document.createElement('td');
  similarCell.className = 'child-images';

  if (group.similarReps.length > 0) {
    const thumbnailGrid = document.createElement('div');
    thumbnailGrid.className = 'similar-thumbnails-grid';
    thumbnailGrid.style.display = 'grid';
      thumbnailGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(100px, 1fr))';
      thumbnailGrid.style.gap = '5px'; // ✅ 5px gap
    thumbnailGrid.style.marginBottom = '8px';
    
    // Show thumbnails for all OTHER representatives in the group
    group.similarReps.forEach((simRep) => {
      const thumbContainer = document.createElement('div');
      thumbContainer.style.position = 'relative';
      thumbContainer.style.display = 'flex';
      thumbContainer.style.flexDirection = 'column';
      thumbContainer.style.alignItems = 'center';
      thumbContainer.style.gap = '4px';
      
      // Thumbnail image for OTHER cluster representative
      const thumbnail = document.createElement('img');
      thumbnail.style.objectFit = 'cover';
      thumbnail.style.borderRadius = '4px';
      thumbnail.style.backgroundColor = '#e9ecef';
      thumbnail.style.border = '2px solid #0066cc';
      thumbnail.style.cursor = 'pointer';
      thumbnail.title = `${simRep.cluster.representativeFilename} - ${simRep.similarityPercent}% match`;
      
      // Placeholder
      thumbnail.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="%236c757d" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
      
      // Load actual thumbnail of OTHER representative
      loadThumbnail(simRep.cluster.representativePath, thumbnail);
      
      // Make thumbnail clickable
      thumbnail.onclick = () => {
        showImagePreview(
          simRep.cluster.representativePath,
          simRep.cluster.representativeFilename,
          simRep.similarityPercent
        );
      };
      
      // Filename label
      const label = document.createElement('div');
      label.style.fontSize = '10px';
      label.style.color = '#6c757d';
      label.style.textAlign = 'center';
      label.style.wordBreak = 'break-all';
      label.style.maxWidth = '80px';
      label.textContent = simRep.cluster.representativeFilename;
      
      thumbContainer.appendChild(thumbnail);
      thumbContainer.appendChild(label);
      
      thumbnailGrid.appendChild(thumbContainer);
    });
    
    similarCell.appendChild(thumbnailGrid);
    
  } else {
    similarCell.textContent = '—';
  }

  // Column 3: Keywords (editable with delete buttons)
  const keywordsCell = document.createElement('td');
  keywordsCell.className = 'keywords-cell';
  
  if (cluster.keywords && cluster.keywords.length > 0) {
    const keywordsList = document.createElement('div');
    keywordsList.className = 'keywords-list';

    cluster.keywords.forEach(keyword => {
      const keywordItem = document.createElement('div');
      keywordItem.className = 'keyword-item';
      
      // Delete button (X)
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'keyword-delete-btn';
      deleteBtn.textContent = '×';
      deleteBtn.title = 'Remove keyword';
      deleteBtn.onclick = (e) => {
        e.stopPropagation();
        removeKeyword(group.mainRep.representativePath, keyword, keywordItem);
      };
      
      // Editable keyword text
      const keywordText = document.createElement('span');
      keywordText.className = 'keyword-text';
      keywordText.textContent = keyword;
      keywordText.contentEditable = true;
      keywordText.spellcheck = false;
      keywordText.onclick = (e) => {
        e.stopPropagation();
        keywordText.focus();
      };
      keywordText.onblur = () => {
        const newValue = keywordText.textContent.trim();
        if (newValue && newValue !== keyword) {
          updateKeyword(group.mainRep.representativePath, keyword, newValue);
        } else if (!newValue) {
          keywordText.textContent = keyword; // Revert if empty
        }
      };
      keywordText.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          keywordText.blur();
        }
        if (e.key === 'Escape') {
          keywordText.textContent = keyword; // Revert
          keywordText.blur();
        }
      };
      
      keywordItem.appendChild(deleteBtn);
      keywordItem.appendChild(keywordText);
      keywordsList.appendChild(keywordItem);
    });

    keywordsCell.appendChild(keywordsList);
  } else {
    keywordsCell.textContent = '—';
  }

  // Column 4: GPS Coordinates
  const gpsCell = document.createElement('td');
  gpsCell.className = 'gps-cell';

  // Check if any image in the group has GPS data
  const hasGPS = cluster.gps || group.similarReps?.some(sim => sim.cluster.gps);

  if (hasGPS) {
    const gpsValue = cluster.gps || group.similarReps.find(sim => sim.cluster.gps)?.cluster.gps;
    
    const gpsDisplay = document.createElement('div');
    gpsDisplay.className = 'gps-display';
    gpsDisplay.textContent = `${gpsValue.latitude}, ${gpsValue.longitude}`;
    gpsDisplay.title = 'Click to edit GPS coordinates';
    gpsCell.appendChild(gpsDisplay);
    
    // Make editable
    gpsDisplay.contentEditable = true;
    gpsDisplay.spellcheck = false;
    gpsDisplay.onclick = (e) => {
      e.stopPropagation();
      gpsDisplay.focus();
    };
    gpsDisplay.onblur = () => {
      updateGPS(group.mainRep.representativePath, gpsDisplay.textContent.trim());
    };
    gpsDisplay.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        gpsDisplay.blur();
      }
      if (e.key === 'Escape') {
        gpsDisplay.textContent = `${gpsValue.latitude}, ${gpsValue.longitude}`;
        gpsDisplay.blur();
      }
    };
  } else {
    // No GPS - show "no gps" text that disappears on click
    const gpsInput = document.createElement('input');
    gpsInput.type = 'text';
    gpsInput.className = 'gps-input gps-input-empty';
    gpsInput.value = 'no gps';
    gpsInput.title = 'Click to enter GPS coordinates (latitude, longitude)';
    
    // Clear text on focus
    gpsInput.onfocus = () => {
      if (gpsInput.value === 'no gps') {
        gpsInput.value = '';
        gpsInput.classList.remove('gps-input-empty');
      }
    };
    
    // Restore "no gps" if empty on blur
    gpsInput.onblur = () => {
      const trimmed = gpsInput.value.trim();
      if (trimmed && trimmed !== 'no gps') {
        updateGPS(group.mainRep.representativePath, trimmed);
        // Replace input with display after successful update
        const gpsDisplay = document.createElement('div');
        gpsDisplay.className = 'gps-display';
        gpsDisplay.textContent = trimmed;
        gpsDisplay.contentEditable = true;
        gpsDisplay.spellcheck = false;
        gpsDisplay.onclick = (e) => {
          e.stopPropagation();
          gpsDisplay.focus();
        };
        gpsDisplay.onblur = () => {
          updateGPS(group.mainRep.representativePath, gpsDisplay.textContent.trim());
        };
        gpsCell.innerHTML = '';
        gpsCell.appendChild(gpsDisplay);
      } else {
        // Restore "no gps" if empty
        gpsInput.value = 'no gps';
        gpsInput.classList.add('gps-input-empty');
      }
    };
    
    gpsInput.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        gpsInput.blur();
      }
      if (e.key === 'Escape') {
        gpsInput.value = 'no gps';
        gpsInput.classList.add('gps-input-empty');
        gpsInput.blur();
      }
    };
    
    gpsCell.appendChild(gpsInput);
  }

  // Add similarity group indicator
  if (group.similarReps.length > 0) {
    row.title = `Similarity group with ${group.similarReps.length} other cluster(s)`;
    row.style.borderLeft = '4px solid #0066cc';
  }

  // Append all cells
  row.appendChild(thumbCell);
  row.appendChild(similarCell);
  row.appendChild(keywordsCell);
  row.appendChild(gpsCell);

  return row;
}

/**
 * Remove a keyword from a cluster
 */
function removeKeyword(clusterPath, keyword, keywordElement) {
  console.log('🗑️ Removing keyword:', { cluster: clusterPath, keyword });
  
  // Find the cluster in allProcessedImages (the actual display data)
  const group = allProcessedImages.find(g => 
    g.mainRep && g.mainRep.representativePath === clusterPath
  );
  
  if (group && group.mainRep && group.mainRep.keywords) {
    // Remove keyword from array
    group.mainRep.keywords = group.mainRep.keywords.filter(kw => kw !== keyword);
    
    // Also update in window.processedClusters if it exists
    if (window.processedClusters) {
      const windowCluster = window.processedClusters.find(c => 
        c.representativePath === clusterPath
      );
      if (windowCluster && windowCluster.keywords) {
        windowCluster.keywords = windowCluster.keywords.filter(kw => kw !== keyword);
      }
    }
    
    // Remove from DOM
    keywordElement.remove();
    
    console.log('✅ Keyword removed successfully');
  } else {
    console.error('❌ Could not find cluster to remove keyword from');
  }
}

/**
 * Update a keyword in a cluster
 */
function updateKeyword(clusterPath, oldKeyword, newKeyword) {
  // Find the cluster in processedClusters
  const cluster = window.processedClusters.find(c => c.mainRep && c.mainRep.representativePath === clusterPath);
  
  if (cluster && cluster.mainRep && cluster.mainRep.keywords) {
    // Update keyword in array
    const index = cluster.mainRep.keywords.indexOf(oldKeyword);
    if (index !== -1) {
      cluster.mainRep.keywords[index] = newKeyword;
      console.log('Keyword updated:', { 
        cluster: cluster.mainRep.representativeFilename, 
        old: oldKeyword, 
        new: newKeyword 
      });
    }
  }
}

/**
 * Update GPS coordinates for a cluster
 */
function updateGPS(clusterPath, gpsString) {
  // Parse GPS string (format: "lat, lon")
  const parts = gpsString.split(',').map(s => s.trim());
  
  if (parts.length !== 2) {
    alert('Invalid GPS format. Use: latitude, longitude (e.g., 51.3887624, 30.1038694)');
    return false;
  }
  
  const latitude = parseFloat(parts[0]);
  const longitude = parseFloat(parts[1]);
  
  if (isNaN(latitude) || isNaN(longitude)) {
    alert('Invalid GPS coordinates. Must be numbers.');
    return false;
  }
  
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    alert('GPS coordinates out of range.\nLatitude: -90 to 90\nLongitude: -180 to 180');
    return false;
  }
  
  // Find and update the cluster
  const cluster = window.processedClusters.find(c => c.mainRep && c.mainRep.representativePath === clusterPath);
  
  if (cluster && cluster.mainRep) {
    cluster.mainRep.gps = { latitude, longitude };
    console.log('GPS updated:', { 
      cluster: cluster.mainRep.representativeFilename, 
      gps: cluster.mainRep.gps 
    });
    return true;
  }
  
  return false;
}

// Create a table row for a processed cluster (OLD - kept for compatibility)
async function createResultsTableRow(cluster) {
  // ✅ ADD: Debug what we're receiving
  console.log('📋 Creating row for cluster:', {
    representative: cluster.representative,
    representativePath: cluster.representativePath,
    representativeFilename: cluster.representativeFilename,
    imagePaths: cluster.imagePaths,
    isBracketed: cluster.isBracketed,
    imageCount: cluster.imageCount
  });

  const row = document.createElement('tr');

  // Column 1: Thumbnail + Parent Image Name
  const thumbCell = document.createElement('td');
  thumbCell.style.width = '200px';
  
  const thumbContainer = document.createElement('div');
  thumbContainer.style.display = 'flex';
  thumbContainer.style.alignItems = 'center';
  thumbContainer.style.gap = '12px';
  
  // Thumbnail
  const thumbnail = document.createElement('img');
  thumbnail.style.width = '60px';
  thumbnail.style.height = '60px';
  thumbnail.style.objectFit = 'cover';
  thumbnail.style.borderRadius = '4px';
  thumbnail.style.flexShrink = '0';
  thumbnail.style.backgroundColor = '#e9ecef';
  thumbnail.title = 'Loading...';
  
  // Set placeholder first
  thumbnail.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="%236c757d" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
  
  // Load actual thumbnail asynchronously
  // ✅ ADD: Fallback if representativePath is undefined
  const thumbPath = cluster.representativePath || cluster.representative;
  console.log('🎯 Using thumbnail path:', thumbPath);
  console.log('🎯 Full cluster object:', JSON.stringify(cluster, null, 2)); // ADD THIS LINE
  loadThumbnail(thumbPath, thumbnail);
  
  // Image name
  const nameDiv = document.createElement('div');
  nameDiv.style.flex = '1';
  
  const fileName = document.createElement('div');
  fileName.className = 'parent-image';
  fileName.textContent = cluster.representativeFilename || cluster.representative || 'Unknown';
  
  const countDiv = document.createElement('div');
  countDiv.className = 'parent-count';
  if (cluster.isBracketed) {
    countDiv.textContent = `${cluster.imageCount} bracketed images`;
  }
  
  nameDiv.appendChild(fileName);
  if (cluster.isBracketed) {
    nameDiv.appendChild(countDiv);
  }
  
  thumbContainer.appendChild(thumbnail);
  thumbContainer.appendChild(nameDiv);
  thumbCell.appendChild(thumbContainer);

  // Column 2: Similar Parent Representatives
  const similarCell = document.createElement('td');
  similarCell.className = 'child-images';

  // Find OTHER parent representatives that are visually similar to THIS parent
  console.log('🔍 ===== FINDING SIMILAR FOR CLUSTER =====');
  console.log('📂 Current cluster rep:', cluster.representativePath);
  console.log('📊 Available similarityResults:', window.similarityResults?.length || 0);
  const similarReps = findSimilarForCluster(cluster.representativePath, window.similarityResults || []);
  console.log('✅ Found', similarReps.length, 'similar representatives');
  if (similarReps.length > 0) {
    console.log('📋 Similar reps:', similarReps.map(s => s.otherFileName));
  }
  console.log('🔍 ======================================\n');

  if (similarReps.length > 0) {
    const thumbnailGrid = document.createElement('div');
    thumbnailGrid.className = 'similar-thumbnails-grid';
    thumbnailGrid.style.display = 'grid';
      thumbnailGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(100px, 1fr))';
      thumbnailGrid.style.gap = '5px'; // ✅ 5px gap
    thumbnailGrid.style.marginBottom = '8px';
    
    similarReps.forEach((sim) => {
      const thumbContainer = document.createElement('div');
      thumbContainer.style.position = 'relative';
      thumbContainer.style.display = 'flex';
      thumbContainer.style.flexDirection = 'column';
      thumbContainer.style.alignItems = 'center';
      thumbContainer.style.gap = '4px';
      
      // Thumbnail image for OTHER cluster representative
      const thumbnail = document.createElement('img');
      thumbnail.style.objectFit = 'cover';
      thumbnail.style.borderRadius = '4px';
      thumbnail.style.backgroundColor = '#e9ecef';
      thumbnail.style.border = '2px solid #0066cc';
      thumbnail.style.cursor = 'pointer';
      thumbnail.title = `${sim.otherFileName} - ${sim.similarityPercent}% match`;
      
      // Placeholder
      thumbnail.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="%236c757d" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
      
      // Load actual thumbnail of OTHER representative
      loadThumbnail(sim.otherRep, thumbnail);
      
      // Filename label
      const label = document.createElement('div');
      label.style.fontSize = '10px';
      label.style.color = '#6c757d';
      label.style.textAlign = 'center';
      label.style.wordBreak = 'break-all';
      label.style.maxWidth = '80px';
      label.textContent = sim.otherFileName;
      
      // Similarity score badge
      const scoreBadge = document.createElement('span');
      scoreBadge.textContent = `${sim.similarityPercent}%`;
      scoreBadge.style.fontSize = '9px';
      scoreBadge.style.fontWeight = 'bold';
      scoreBadge.style.color = 'white';
      scoreBadge.style.backgroundColor = sim.similarityPercent >= 95 ? '#28a745' : '#ffc107';
      scoreBadge.style.padding = '2px 6px';
      scoreBadge.style.borderRadius = '3px';
      scoreBadge.style.marginTop = '2px';
      scoreBadge.style.display = 'inline-block';
        
        thumbContainer.appendChild(thumbnail);
        thumbContainer.appendChild(label);
      thumbContainer.appendChild(scoreBadge);
      
      thumbnailGrid.appendChild(thumbContainer);
    });
    
    similarCell.appendChild(thumbnailGrid);
    
  } else {
    similarCell.textContent = '—';
  }

  // Column 3: Keywords (unchanged)
  const keywordsCell = document.createElement('td');
  keywordsCell.className = 'child-images';
  
  if (cluster.keywords && cluster.keywords.length > 0) {
    const displayKeywords = cluster.keywords.slice(0, 5);
    
    displayKeywords.forEach(keyword => {
      const badge = document.createElement('span');
      badge.className = 'child-image-item';
      badge.textContent = keyword;
      keywordsCell.appendChild(badge);
    });
    
    if (cluster.keywords.length > 5) {
      const moreBadge = document.createElement('span');
      moreBadge.className = 'child-image-item';
      moreBadge.style.backgroundColor = '#f1f3f5';
      moreBadge.textContent = `+${cluster.keywords.length - 5} more`;
      keywordsCell.appendChild(moreBadge);
    }
  } else {
    keywordsCell.textContent = '—';
  }

  // Column 4: Status (unchanged)
  const statusCell = document.createElement('td');
  const statusBadge = document.createElement('span');
  statusBadge.className = 'status-badge';
  
  if (cluster.analysisCount > 0) {
    statusBadge.classList.add('status-complete');
    statusBadge.textContent = `✓ ${cluster.analysisCount} analysis`;
  } else if (cluster.processed) {
    statusBadge.classList.add('status-ready');
    statusBadge.textContent = 'Metadata extracted';
  } else {
    statusBadge.classList.add('status-pending');
    statusBadge.textContent = 'Pending';
  }
  
  statusCell.appendChild(statusBadge);

  // NEW: Add similarity information if available
  if (window.similarityResults && window.similarityResults.length > 0) {
    const similarReps = findSimilarForCluster(cluster.representativePath, window.similarityResults);
    if (similarReps.length > 0) {
      // Add similarity info to the row title
      row.title = `Similar to: ${similarReps.map(s => s.otherFileName).join(', ')}`;
      row.style.borderLeft = '4px solid #0066cc';
    }
  }

  // Append all cells
  row.appendChild(thumbCell);
  row.appendChild(similarCell);
  row.appendChild(keywordsCell);
  row.appendChild(statusCell);

  return row;
}

// Helper function to load thumbnails asynchronously
async function loadThumbnail(imagePath, imgElement) {
  // ✅ ADD: Debug logging
  console.log('🖼️ Loading thumbnail for:', imagePath);
  
  try {
    // ✅ ADD: Validate input
    if (!imagePath) {
      console.error('❌ loadThumbnail called with empty imagePath!');
      imgElement.title = 'No path provided';
      return;
    }

    const result = await window.electronAPI.getPreviewImage(imagePath);
    
    console.log('📥 Thumbnail result:', { 
      path: imagePath, 
      success: result.success,
      hasDataUrl: !!result.dataUrl,
      error: result.error
    });
    
    if (result.success) {
      imgElement.src = result.dataUrl;
      imgElement.title = imagePath.split('/').pop();
      console.log('✅ Thumbnail loaded successfully:', imagePath.split('/').pop());
    } else {
      // Keep placeholder on error
      imgElement.title = 'Preview not available: ' + (result.error || 'Unknown error');
      console.warn('⚠️ Failed to load thumbnail:', imagePath, result.error);
    }
  } catch (error) {
    console.error('❌ Error loading thumbnail:', error);
    console.error('   Path was:', imagePath);
    imgElement.title = 'Error loading preview: ' + error.message;
  }
}

// Update pagination info display
function updateResultsPaginationInfo() {
  const start = (resultsCurrentPage - 1) * resultsRowsPerPage + 1;
  const end = Math.min(resultsCurrentPage * resultsRowsPerPage, allProcessedImages.length);
  const total = allProcessedImages.length;
  const info = `Showing ${start}-${end} of ${total}`;

  document.getElementById('resultsPageInfoTop').textContent = info;
  document.getElementById('resultsPageInfoBottom').textContent = info;

  const totalPages = Math.ceil(total / resultsRowsPerPage);

  // Enable/disable buttons
  ['Top', 'Bottom'].forEach(suffix => {
    document.getElementById(`resultsFirstPage${suffix}`).disabled = resultsCurrentPage === 1;
    document.getElementById(`resultsPrevPage${suffix}`).disabled = resultsCurrentPage === 1;
    document.getElementById(`resultsNextPage${suffix}`).disabled = resultsCurrentPage === totalPages;
    document.getElementById(`resultsLastPage${suffix}`).disabled = resultsCurrentPage === totalPages;
  });
}

// Setup pagination button handlers
function setupResultsPaginationControls() {
  ['Top', 'Bottom'].forEach(suffix => {
    document.getElementById(`resultsFirstPage${suffix}`).onclick = async () => {
      resultsCurrentPage = 1;
      await renderResultsPage();
    };

    document.getElementById(`resultsPrevPage${suffix}`).onclick = async () => {
      if (resultsCurrentPage > 1) {
        resultsCurrentPage--;
        await renderResultsPage();
      }
    };

    document.getElementById(`resultsNextPage${suffix}`).onclick = async () => {
      const totalPages = Math.ceil(allProcessedImages.length / resultsRowsPerPage);
      if (resultsCurrentPage < totalPages) {
        resultsCurrentPage++;
        await renderResultsPage();
      }
    };

    document.getElementById(`resultsLastPage${suffix}`).onclick = async () => {
      resultsCurrentPage = Math.ceil(allProcessedImages.length / resultsRowsPerPage);
      await renderResultsPage();
    };
  });
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// ============================================
// Similarity Detection Functions
// ============================================

// Store merged clusters
let mergedClusters = new Map(); // Maps original cluster IDs to merged group ID

// Helper function to find similar representatives for a cluster
function findSimilarForCluster(clusterRep, similarityResults) {
  return similarityResults.filter(
    sim => sim.rep1 === clusterRep || sim.rep2 === clusterRep
  ).map(sim => ({
    ...sim,
    otherRep: sim.rep1 === clusterRep ? sim.rep2 : sim.rep1,
    otherFileName: sim.rep1 === clusterRep ? sim.fileName2 : sim.fileName1
  }));
}

// Helper: Get CSS class for similarity score
function getScoreClass(percent) {
  if (percent >= 95) return 'high';
  if (percent >= 90) return 'medium';
  return '';
}

// Helper: Get filename from path
function getFileName(path) {
  return path ? path.split('/').pop() : '';
}

// Helper: Get thumbnail path (placeholder for now)
function getThumbnailPath(imagePath) {
  // This should use the existing thumbnail loading system
  return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="%236c757d" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
}

// Render similarity section for a cluster
function renderSimilaritySection(similarReps, currentRep) {
  if (!similarReps || similarReps.length === 0) {
    return ''; // Don't show section if no similar representatives
  }

  return `
    <div class="similarity-section">
      <h4>⚡ Similar Representatives Detected (${similarReps.length})</h4>
      <p style="font-size: 12px; color: #6c757d; margin: 5px 0;">
        This cluster's representative is visually similar to:
      </p>
      
      <div class="similar-reps-grid">
        ${similarReps.map(sim => `
          <div class="similar-rep-card" 
               onclick="jumpToCluster('${sim.otherRep}')"
               title="Click to view this cluster">
            <img src="${getThumbnailPath(sim.otherRep)}" 
                 class="similar-rep-thumbnail"
                 alt="${sim.otherFileName}">
            <div class="similar-rep-info">
              <p class="similar-rep-name">${sim.otherFileName}</p>
              <p class="similarity-score ${getScoreClass(sim.similarityPercent)}">
                ${sim.similarityPercent}% match
              </p>
            </div>
          </div>
        `).join('')}
      </div>

      <button class="merge-btn" onclick="mergeClusters('${currentRep}', ${JSON.stringify(similarReps.map(s => s.otherRep))})">
        🔗 Merge Similar Clusters
      </button>
    </div>
  `;
}

// Helper: Jump to another cluster's card
function jumpToCluster(repPath) {
  const cards = document.querySelectorAll('.cluster-card');
  for (const card of cards) {
    const img = card.querySelector('.representative-thumb');
    if (img && img.src.includes(getFileName(repPath))) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.style.animation = 'highlight 1s';
      setTimeout(() => card.style.animation = '', 1000);
      break;
    }
  }
}

// Merge clusters functionality
async function mergeClusters(mainRep, similarReps) {
  console.log('Merging clusters:', mainRep, similarReps);
  
  // Find all cluster cards to merge
  const mainCard = findClusterCardByRep(mainRep);
  const similarCards = similarReps.map(rep => findClusterCardByRep(rep));
  
  if (!mainCard || similarCards.some(c => !c)) {
    console.error('Could not find all clusters to merge');
    return;
  }
  
  // Create merged cluster
  const mergedData = {
    id: `merged_${Date.now()}`,
    mainRepresentative: mainRep,
    subRepresentatives: similarReps,
    allMembers: [], // Collect all members
    merged: true
  };
  
  // Collect members from all clusters
  const allClusters = [mainCard, ...similarCards];
  allClusters.forEach(card => {
    const membersDiv = card.querySelector('.members-section');
    if (membersDiv) {
      const members = Array.from(membersDiv.querySelectorAll('.member-item'))
        .map(item => item.dataset.path);
      mergedData.allMembers.push(...members);
    }
  });
  
  // Store merge info
  mergedClusters.set(mergedData.id, mergedData);
  
  // UI: Update main card to show merged state
  mainCard.classList.add('merged-cluster');
  mainCard.querySelector('.cluster-header h3').textContent += ' (Merged)';
  
  // Update member count
  mainCard.querySelector('.image-count').textContent = `${mergedData.allMembers.length} images (merged)`;
  
  // Hide similar clusters
  similarCards.forEach(card => {
    card.style.display = 'none';
    card.dataset.mergedInto = mergedData.id;
  });
  
  // Add unmerge button
  const mergeBtn = mainCard.querySelector('.merge-btn');
  if (mergeBtn) {
    mergeBtn.textContent = '↩️ Unmerge Clusters';
    mergeBtn.onclick = () => unmergeClusters(mergedData.id);
  }
  
  // Show success message
  showNotification(`Merged ${allClusters.length} clusters successfully`);
}

// Unmerge clusters functionality
function unmergeClusters(mergedId) {
  const mergedData = mergedClusters.get(mergedId);
  if (!mergedData) return;
  
  // Show hidden clusters again
  const hiddenCards = document.querySelectorAll(`[data-merged-into="${mergedId}"]`);
  hiddenCards.forEach(card => {
    card.style.display = '';
    delete card.dataset.mergedInto;
  });
  
  // Reset main card
  const mainCard = findClusterCardByRep(mergedData.mainRepresentative);
  if (mainCard) {
    mainCard.classList.remove('merged-cluster');
    mainCard.querySelector('.cluster-header h3').textContent = 
      mainCard.querySelector('.cluster-header h3').textContent.replace(' (Merged)', '');
  }
  
  // Remove merge data
  mergedClusters.delete(mergedId);
  
  showNotification('Clusters unmerged');
}

// Find cluster card by representative path
function findClusterCardByRep(repPath) {
  const cards = document.querySelectorAll('.cluster-card');
  for (const card of cards) {
    const img = card.querySelector('.representative-thumb');
    if (img && img.src.includes(getFileName(repPath))) {
      return card;
    }
  }
  return null;
}

// Show notification
function showNotification(message) {
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 20px;
    background: #28a745;
    color: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    z-index: 10000;
    animation: slideIn 0.3s;
  `;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Render similarity summary section - DISABLED (grouping in table is clearer)
// function renderSimilaritySummary() {
//   const resultsTableContainer = document.getElementById('resultsTableContainer');
//   
//   // Check if similarity summary already exists
//   if (document.getElementById('similaritySummary')) {
//     return;
//   }
//   
//   const summaryDiv = document.createElement('div');
//   summaryDiv.id = 'similaritySummary';
//   summaryDiv.className = 'similarity-section';
//   summaryDiv.style.marginBottom = '20px';
//   
//   summaryDiv.innerHTML = `
//     <h4>🔍 Visual Similarity Analysis Complete</h4>
//     <p style="font-size: 14px; color: #6c757d; margin: 10px 0;">
//       Found ${window.similarityResults.length} similar representative pairs.
//       Rows with blue left border indicate clusters with similar representatives.
//       Hover over rows to see similarity details.
//     </p>
//     <div style="display: flex; gap: 15px; flex-wrap: wrap; margin-top: 10px;">
//       ${window.similarityResults.map(sim => `
//         <div style="padding: 8px 12px; background: white; border: 1px solid #dee2e6; border-radius: 6px; font-size: 13px;">
//           <strong>${sim.fileName1}</strong> ↔ <strong>${sim.fileName2}</strong><br>
//           <span style="color: ${sim.similarityPercent >= 95 ? '#28a745' : sim.similarityPercent >= 90 ? '#ffc107' : '#0066cc'}; font-weight: bold;">
//             ${sim.similarityPercent}% match
//           </span>
//         </div>
//       `).join('')}
//     </div>
//   `;
//   
//   // Insert before the table
//   resultsTableContainer.insertBefore(summaryDiv, resultsTableContainer.firstChild);
// }

// ============================================
// Image Preview Modal
// ============================================

/**
 * Show image preview modal
 */
async function showImagePreview(imagePath, filename, similarityPercent = null) {
  const modal = document.getElementById('imagePreviewModal');
  const previewImg = document.getElementById('previewImage');
  const filenameEl = document.getElementById('previewFilename');
  const similarityEl = document.getElementById('previewSimilarity');
  
  // Load thumbnail
  const result = await window.electronAPI.getPreviewImage(imagePath);
  
  if (result.success) {
    previewImg.src = result.dataUrl;
    filenameEl.textContent = filename;
    
    if (similarityPercent) {
      similarityEl.textContent = `${similarityPercent}% match`;
      similarityEl.style.display = 'block';
    } else {
      similarityEl.style.display = 'none';
    }
    
    modal.style.display = 'flex';
  } else {
    console.error('Failed to load preview:', result.error);
    alert('Failed to load image preview');
  }
}

/**
 * Close image preview modal
 */
function closeImagePreview() {
  console.log('🔴 closeImagePreview called');
  const modal = document.getElementById('imagePreviewModal');
  if (modal) {
    modal.style.display = 'none';
    console.log('✅ Modal closed');
  } else {
    console.error('❌ Modal element not found');
  }
}

/**
 * Initialize modal event listeners
 */
function initializeModalListeners() {
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalBackdrop = document.getElementById('modalBackdrop');
  
  if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', (e) => {
      console.log('🔴 Close button clicked');
      e.stopPropagation();
      closeImagePreview();
    });
    console.log('✅ Modal close button listener attached');
  } else {
    console.error('❌ modalCloseBtn not found');
  }
  
  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', (e) => {
      console.log('🔴 Backdrop clicked');
      e.stopPropagation();
      closeImagePreview();
    });
    console.log('✅ Modal backdrop listener attached');
  } else {
    console.error('❌ modalBackdrop not found');
  }
  
  // Close modal on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      console.log('🔴 Escape key pressed');
      closeImagePreview();
    }
  });
  console.log('✅ Escape key listener attached');
}

// ============================================
// AI Settings Handlers
// ============================================

async function handleSaveAISettings() {
  try {
    const settings = {
      ollamaEndpoint: document.getElementById('ollamaEndpoint').value,
      ollamaModel: document.getElementById('ollamaModel').value,
      confidenceThreshold: parseInt(document.getElementById('confidenceThreshold').value),
      googleVisionApiKey: document.getElementById('googleVisionApiKey').value
    };
    
    const response = await window.electronAPI.saveAISettings(settings);
    
    if (response.success) {
      alert('✅ AI settings saved successfully!');
    } else {
      alert(`❌ Failed to save settings: ${response.error}`);
    }
    
  } catch (error) {
    console.error('Error saving AI settings:', error);
    alert(`Error: ${error.message}`);
  }
}

async function handleTestGoogleVision() {
  const statusDiv = document.getElementById('googleVisionStatus');
  const apiKey = document.getElementById('googleVisionApiKey').value;
  
  if (!apiKey) {
    statusDiv.style.display = 'block';
    statusDiv.style.color = '#e74c3c';
    statusDiv.textContent = '⚠️ Please enter an API key first';
    return;
  }
  
  try {
    statusDiv.style.display = 'block';
    statusDiv.style.color = '#666';
    statusDiv.textContent = '🔄 Testing connection...';
    
    const response = await window.electronAPI.testGoogleVisionAPI(apiKey);
    
    if (response.success) {
      statusDiv.style.color = '#28a745';
      statusDiv.textContent = '✅ Google Vision API connection successful!';
    } else {
      statusDiv.style.color = '#e74c3c';
      statusDiv.textContent = `❌ Connection failed: ${response.error}`;
    }
    
  } catch (error) {
    console.error('Error testing Google Vision:', error);
    statusDiv.style.display = 'block';
    statusDiv.style.color = '#e74c3c';
    statusDiv.textContent = `❌ Error: ${error.message}`;
  }
}

// ============================================
// AI Analysis Tab Functions
// ============================================

let currentAnalysisData = null; // Store current analysis for editing
let allClustersForAnalysis = [];
let analyzedClusters = new Map(); // clusterIndex → metadata
let currentClusterIndex = null;

// ============================================
// Cluster Management for AI Analysis
// ============================================

/**
 * Batch analyze all clusters with AI
 */
async function batchAnalyzeAllClusters() {
  console.log('🚀 === BATCH ANALYSIS DEBUG ===');
  console.log('Raw allProcessedImages:', allProcessedImages.length);
  
  // Log each item with full details
  allProcessedImages.forEach((group, idx) => {
    console.log(`\n[${idx}]:`, {
      mainRep: group.mainRep?.representativeFilename,
      mainRepPath: group.mainRep?.representativePath,
      hasSimilarReps: !!group.similarReps,
      similarCount: group.similarReps?.length || 0
    });
  });
  
  console.log('\n🚀 Starting batch AI analysis...');
  
  // ✅ FIX: Deduplicate FIRST before analyzing
  const uniqueClusters = [];
  const seenPaths = new Set();
  
  allProcessedImages.forEach(group => {
    const repPath = group.mainRep?.representativePath;
    if (!seenPaths.has(repPath)) {
      seenPaths.add(repPath);
      uniqueClusters.push(group);
      console.log(`✅ Will analyze: ${group.mainRep?.representativeFilename}`);
    } else {
      console.log(`❌ Skip duplicate: ${group.mainRep?.representativeFilename}`);
    }
  });
  
  console.log(`📊 Analyzing ${uniqueClusters.length} unique clusters (removed ${allProcessedImages.length - uniqueClusters.length} duplicates)`);
  
  // Clear previous analysis
  analyzedClusters.clear();
  allClustersForAnalysis = uniqueClusters;
  
  // Analyze each cluster
  for (let i = 0; i < uniqueClusters.length; i++) {
    const group = uniqueClusters[i];
    const clusterName = group.mainRep?.representativeFilename || `Cluster ${i + 1}`;
    
    try {
      console.log(`🔍 Analyzing [${i + 1}/${uniqueClusters.length}]: ${clusterName}`);
      
      updateStatus(`Analyzing cluster ${i + 1} of ${uniqueClusters.length}: ${clusterName}...`, 'processing');
      showProgress(Math.round(((i + 1) / uniqueClusters.length) * 100));
      
      // Call backend AI analysis
      const result = await window.electronAPI.analyzeClusterWithAI(group);
      
      if (result.success) {
        // Store metadata in the Map
        analyzedClusters.set(i, result.data.metadata);
        console.log(`✅ Analysis complete for: ${clusterName}`);
      } else {
        console.error(`❌ Analysis failed for: ${clusterName}`, result.error);
        alert(`Analysis failed for ${clusterName}: ${result.error}`);
      }
      
    } catch (error) {
      console.error(`❌ Error analyzing ${clusterName}:`, error);
      alert(`Error analyzing ${clusterName}: ${error.message}`);
    }
  }
  
  console.log('✅ Batch analysis complete!');
  updateStatus('All clusters analyzed!', 'complete');
  showProgress(100);
  
  // Load the cluster grid to display results
  loadClustersForAnalysis();
}

/**
 * Load all clusters into AI Analysis tab with thumbnail grid
 */
function loadClustersForAnalysis() {
  // Check if we have clusters (either from batch analysis or from allProcessedImages)
  const sourceClusters = allClustersForAnalysis.length > 0 ? allClustersForAnalysis : allProcessedImages;
  const generateBtn = document.getElementById('generateAllXMPBtn');
  
  if (!sourceClusters || sourceClusters.length === 0) {
    // Show empty state, hide button
    document.getElementById('aiAnalysisEmpty').style.display = 'block';
    document.getElementById('clusterSelectionSection').style.display = 'none';
    if (generateBtn) generateBtn.style.display = 'none';
    return;
  }
  
  // ✅ DEDUPLICATE - Remove duplicate super clusters
  const uniqueClusters = [];
  const seenPaths = new Set();
  
  sourceClusters.forEach(group => {
    const repPath = group.mainRep?.representativePath;
    if (repPath && !seenPaths.has(repPath)) {
      seenPaths.add(repPath);
      uniqueClusters.push(group);
    }
  });
  
  allClustersForAnalysis = uniqueClusters;
  
  console.log(`✅ Loaded ${uniqueClusters.length} unique super clusters (${analyzedClusters.size} analyzed)`);
  
  // Show cluster grid and button
  document.getElementById('aiAnalysisEmpty').style.display = 'none';
  document.getElementById('clusterSelectionSection').style.display = 'block';
  if (generateBtn) generateBtn.style.display = 'block';
  document.getElementById('aiAnalysisResults').style.display = 'none';
  
  // Hide confidence badge when showing cluster grid
  const confidenceInline = document.getElementById('aiConfidenceInline');
  if (confidenceInline) confidenceInline.style.display = 'none';
  
  renderClusterThumbnailGrid();
}

/**
 * Render thumbnail grid of all clusters
 */
async function renderClusterThumbnailGrid() {
  const grid = document.getElementById('clusterThumbnailGrid');
  
  // ✅ FORCE CLEAR - Remove all children completely
  while (grid.firstChild) {
    grid.removeChild(grid.firstChild);
  }
  
  console.log('🎨 === RENDERING THUMBNAIL GRID ===');
  console.log('📊 allClustersForAnalysis.length:', allClustersForAnalysis.length);
  console.log('📋 allClustersForAnalysis:', allClustersForAnalysis.map(g => g.mainRep?.representativeFilename));
  
  for (let i = 0; i < allClustersForAnalysis.length; i++) {
    const group = allClustersForAnalysis[i];
    console.log(`  Rendering card ${i}: ${group.mainRep?.representativeFilename}`);
    
    const card = document.createElement('div');
    card.className = 'cluster-thumbnail-card';
    
    if (analyzedClusters.has(i)) {
      card.classList.add('analyzed');
    }
    
    if (i === currentClusterIndex) {
      card.classList.add('current');
    }
    
    // Thumbnail
    const img = document.createElement('img');
    img.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 24 24" fill="none" stroke="%236c757d" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
    
    // Load actual thumbnail
    const repPath = group.mainRep.representativePath;
    const result = await window.electronAPI.getPreviewImage(repPath);
    if (result.success) {
      img.src = result.dataUrl;
    }
    
    // Info
    const info = document.createElement('div');
    info.className = 'cluster-thumbnail-info';
    info.textContent = group.mainRep.representativeFilename;
    
    card.appendChild(img);
    card.appendChild(info);
    
    // Click handler
    card.onclick = () => selectCluster(i);
    
    grid.appendChild(card);
    console.log(`  ✅ Card ${i} appended to grid`);
  }
  
  console.log(`🎨 Total cards in grid: ${grid.children.length}`);
  console.log('🎨 === END RENDERING ===\n');
  
  // Update "Generate All" button state
  updateGenerateAllButtonState();
}

/**
 * Select a cluster for analysis/editing
 */
async function selectCluster(clusterIndex) {
  console.log('🎯 selectCluster called with index:', clusterIndex);
  
  // ✅ SIMPLE FIX: Save current cluster FIRST before doing anything else
  if (currentClusterIndex !== null && currentClusterIndex !== clusterIndex) {
    try {
      console.log('💾 Auto-saving current cluster', currentClusterIndex, 'before switching');
      
      // Force blur on ANY active element to ensure values are committed to DOM
      if (document.activeElement) {
        document.activeElement.blur();
      }
      
      // Wait 50ms for blur to complete and DOM to update
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Now collect metadata
      const editedMetadata = collectMetadataFromForm();
      analyzedClusters.set(currentClusterIndex, editedMetadata);
      
      console.log('✅ Auto-saved metadata:', editedMetadata);
    } catch (error) {
      console.error('❌ Failed to auto-save metadata:', error);
    }
  }
  
  // Now proceed with switching
  currentClusterIndex = clusterIndex;
  const group = allClustersForAnalysis[clusterIndex];
  
  if (!group) {
    console.error('❌ No cluster found at index:', clusterIndex);
    return;
  }
  
  // Check if analyzed
  if (!analyzedClusters.has(clusterIndex)) {
    alert('This cluster has not been analyzed yet. Please run "Run AI Analysis" first.');
    return;
  }
  
  // Load metadata for selected cluster
  const savedMetadata = analyzedClusters.get(clusterIndex);
  
  console.log('✅ Loading metadata for:', group.mainRep?.representativeFilename);
  
  displayAIAnalysisResults({
    cluster: group,
    metadata: savedMetadata,
    affectedImages: getAllAffectedPaths(group),
    imageCount: countTotalImages(group),
    breakdown: {
      parents: 1 + (group.similarReps?.length || 0),
      children: countChildren(group)
    }
  });
  
  // Show results
  document.getElementById('aiAnalysisResults').style.display = 'block';
  
  // Update visual selection
  updateThumbnailSelection(clusterIndex);
  
  console.log('✅ Selection complete, currentClusterIndex:', currentClusterIndex);
}

/**
 * Update thumbnail selection visual state
 */
function updateThumbnailSelection(selectedIndex) {
  const cards = document.querySelectorAll('.cluster-thumbnail-card');
  cards.forEach((card, idx) => {
    if (idx === selectedIndex) {
      card.classList.add('current');
    } else {
      card.classList.remove('current');
    }
  });
}

/**
 * Save current metadata (called when switching between clusters)
 */
function backToClusterSelection() {
  // Save current metadata if edited
  if (currentClusterIndex !== null) {
    const editedMetadata = collectMetadataFromForm();
    analyzedClusters.set(currentClusterIndex, editedMetadata);
    console.log(`💾 Auto-saved metadata for cluster ${currentClusterIndex}`);
  }
  
  // Update button states
  updateGenerateAllButtonState();
}

/**
 * Save metadata for current cluster
 */
function saveCurrentClusterMetadata() {
  if (currentClusterIndex === null) return;
  
  const metadata = collectMetadataFromForm();
  analyzedClusters.set(currentClusterIndex, metadata);
  
  alert('✅ Metadata saved for this cluster!');
  
  // Update button states
  updateGenerateAllButtonState();
  
  // Re-render thumbnails to update status
  renderClusterThumbnailGrid();
  
  // ❌ DON'T GO BACK - stay on current cluster (thumbnails always visible)
}

/**
 * Update "Generate All XMP" button state
 */
function updateGenerateAllButtonState() {
  const btn = document.getElementById('generateAllXMPBtn');
  const status = document.getElementById('xmpGenerationStatus');
  
  if (!btn || !status) return;
  
  const totalClusters = allClustersForAnalysis.length;
  const analyzedCount = analyzedClusters.size;
  
  if (analyzedCount === 0) {
    btn.disabled = true;
    status.textContent = `No clusters analyzed yet (0/${totalClusters})`;
  } else if (analyzedCount < totalClusters) {
    btn.disabled = false;
    status.textContent = `Ready to generate for ${analyzedCount}/${totalClusters} clusters`;
    status.style.color = '#ffc107';
  } else {
    btn.disabled = false;
    status.textContent = '';
    status.style.color = '#28a745';
  }
}

/**
 * Generate XMP for all analyzed clusters
 */
async function generateAllXMPFiles() {
  if (analyzedClusters.size === 0) {
    alert('No clusters have been analyzed yet.');
    return;
  }
  
  const confirmed = confirm(
    `Generate XMP files for ${analyzedClusters.size} cluster(s)?\n\n` +
    `This will create XMP sidecar files for all analyzed images.`
  );
  
  if (!confirmed) return;
  
  const btn = document.getElementById('generateAllXMPBtn');
  const status = document.getElementById('xmpGenerationStatus');
  
  btn.disabled = true;
  btn.textContent = '⏳ Generating XMP Files...';
  
  let successCount = 0;
  let failCount = 0;
  
  for (const [clusterIndex, metadata] of analyzedClusters.entries()) {
    const group = allClustersForAnalysis[clusterIndex];
    
    try {
      status.textContent = `Processing cluster ${successCount + failCount + 1}/${analyzedClusters.size}...`;
      
      const result = await window.electronAPI.generateXMPFiles({
        cluster: group,
        metadata: metadata,
        affectedImages: getAllAffectedPaths(group)
      });
      
      if (result.success) {
        successCount++;
      } else {
        failCount++;
      }
      
    } catch (error) {
      console.error('XMP generation failed for cluster:', error);
      failCount++;
    }
  }
  
  btn.disabled = false;
  btn.textContent = '✅ Generate XMP Files for All Clusters';
  
  alert(
    `XMP Generation Complete!\n\n` +
    `✅ Success: ${successCount} cluster(s)\n` +
    `❌ Failed: ${failCount} cluster(s)`
  );
  
  status.textContent = `Last generation: ${successCount} succeeded, ${failCount} failed`;
}

/**
 * Helper: Get all image paths affected by a cluster
 */
function getAllAffectedPaths(group) {
  const paths = [group.mainRep.representativePath];
  if (group.mainRep.imagePaths) {
    paths.push(...group.mainRep.imagePaths.filter(p => p !== group.mainRep.representativePath));
  }
  if (group.similarReps) {
    group.similarReps.forEach(sim => {
      paths.push(sim.cluster.representativePath);
      if (sim.cluster.imagePaths) {
        paths.push(...sim.cluster.imagePaths);
      }
    });
  }
  return [...new Set(paths)];
}

/**
 * Helper: Count total images in a cluster
 */
function countTotalImages(group) {
  return getAllAffectedPaths(group).length;
}

/**
 * Helper: Count child images in a cluster
 */
function countChildren(group) {
  let total = 0;
  if (group.mainRep.isBracketed && group.mainRep.imageCount) {
    total += group.mainRep.imageCount - 1;
  }
  if (group.similarReps) {
    group.similarReps.forEach(sim => {
      if (sim.cluster.isBracketed && sim.cluster.imageCount) {
        total += sim.cluster.imageCount;
      }
    });
  }
  return total;
}

/**
 * Trigger AI analysis from Visual Analysis tab
 * Called when user clicks "Analyze with AI" button on a cluster
 */
async function analyzeClusterWithAI(clusterGroup) {
  try {
    console.log('Starting AI analysis for cluster:', clusterGroup.mainRep.representativeFilename);
    
    // Find and disable the button that triggered this (visual feedback)
    const buttons = document.querySelectorAll('.analyze-ai-btn');
    buttons.forEach(btn => {
      btn.disabled = true;
      btn.classList.add('loading');
      btn.innerHTML = `
        <svg class="ai-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 6v6l4 2"/>
        </svg>
        Analyzing...
      `;
    });
    
    // Show loading state
    updateStatus('Analyzing with AI...', 'processing');
    showProgress(0);
    
    // Call backend AI analysis
    const result = await window.electronAPI.analyzeClusterWithAI(clusterGroup);
    
    showProgress(100);
    
    if (result.success) {
      console.log('AI analysis complete:', result.data);
      
      // Store analysis data globally
      currentAnalysisData = result.data;
      
      // Display results in AI Analysis tab
      displayAIAnalysisResults(result.data);
      
      // Switch to AI Analysis tab
      const aiAnalysisTab = document.querySelector('[data-tab="ai-analysis"]');
      if (aiAnalysisTab) {
        aiAnalysisTab.click();
      }
      
      updateStatus('AI analysis complete!', 'complete');
      
    } else {
      throw new Error(result.error || 'AI analysis failed');
    }
    
  } catch (error) {
    console.error('AI analysis failed:', error);
    updateStatus(`AI analysis failed: ${error.message}`, 'error');
    alert(`AI analysis failed: ${error.message}`);
  } finally {
    // Re-enable all buttons
    const buttons = document.querySelectorAll('.analyze-ai-btn');
    buttons.forEach(btn => {
      btn.disabled = false;
      btn.classList.remove('loading');
      btn.innerHTML = `
        <svg class="ai-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5"/>
          <path d="M2 12l10 5 10-5"/>
        </svg>
        Analyze with AI
      `;
    });
  }
}

/**
 * Display AI analysis results in the UI
 */
function displayAIAnalysisResults(analysisData) {
  console.log('Displaying AI analysis results');
  
  // Hide empty state, show results
  document.getElementById('aiAnalysisEmpty').style.display = 'none';
  document.getElementById('aiAnalysisResults').style.display = 'block';
  
  // Update inline confidence indicator
  const confidenceInline = document.getElementById('aiConfidenceInline');
  if (confidenceInline && analysisData.metadata.confidence) {
    const confidence = analysisData.metadata.confidence;
    const provider = analysisData.metadata.provider === 'google_vision' ? 'Google' : 'Ollama';
    
    confidenceInline.textContent = `${provider}: ${confidence}%`;
    
    // Color based on confidence
    if (confidence >= 90) {
      confidenceInline.style.background = '#d4edda';
      confidenceInline.style.color = '#155724';
    } else if (confidence >= 80) {
      confidenceInline.style.background = '#d1ecf1';
      confidenceInline.style.color = '#0c5460';
    } else {
      confidenceInline.style.background = '#fff3cd';
      confidenceInline.style.color = '#856404';
    }
    
    confidenceInline.style.display = 'inline-block';
  }
  
  // Populate metadata fields
  populateMetadataFields(analysisData.metadata);
  
  // Display static metadata
  displayStaticMetadata(analysisData);
  
  // Show/hide low confidence warning
  const threshold = 85; // Get from config
  if (analysisData.metadata.confidence < threshold) {
    showLowConfidenceWarning(analysisData.metadata.confidence, threshold);
  } else {
    document.getElementById('lowConfidenceWarning').style.display = 'none';
  }
}

/**
 * Display preview image
 */
async function displayPreviewImage(analysisData) {
  const previewImg = document.getElementById('aiPreviewImage');
  const filenameEl = document.getElementById('aiPreviewFilename');
  const imageCountEl = document.getElementById('aiPreviewImageCount');
  
  // Get representative image path
  const repPath = analysisData.cluster.mainRep.representativePath;
  const filename = repPath.split('/').pop();
  
  // Load thumbnail
  const result = await window.electronAPI.getPreviewImage(repPath);
  if (result.success) {
    previewImg.src = result.dataUrl;
  }
  
  // Display filename
  filenameEl.textContent = filename;
  
  // Display image count
  const totalImages = analysisData.imageCount;
  const parents = analysisData.breakdown.parents;
  const children = analysisData.breakdown.children;
  
  imageCountEl.textContent = `📦 This XMP will be applied to ${totalImages} images (${parents} parent${parents > 1 ? 's' : ''}, ${children} child${children !== 1 ? 'ren' : ''})`;
}

/**
 * Display confidence score with color coding
 */
function displayConfidenceScore(metadata) {
  const confidenceSection = document.getElementById('confidenceSection');
  const providerEl = document.getElementById('confidenceProvider');
  const scoreEl = document.getElementById('confidenceScore');
  const fillEl = document.getElementById('confidenceFill');
  const messageEl = document.getElementById('confidenceMessage');
  
  const confidence = metadata.confidence;
  
  // Set provider icon and name
  const providerIcon = metadata.provider === 'google_vision' ? '🌐' : '🤖';
  const providerName = metadata.provider === 'google_vision' ? 'Google Vision' : 'Ollama';
  providerEl.textContent = `${providerIcon} ${providerName}`;
  
  // Set confidence score
  scoreEl.textContent = `${confidence}%`;
  
  // Set progress bar width
  fillEl.style.width = `${confidence}%`;
  
  // Determine confidence level and apply styling
  let level, message;
  
  if (confidence >= 90) {
    level = 'excellent';
    message = '✅ Excellent confidence - Results are highly accurate';
  } else if (confidence >= 80) {
    level = 'good';
    message = 'ℹ️ Good confidence - Results are likely accurate';
  } else if (confidence >= 70) {
    level = 'fair';
    message = '⚠️ Fair confidence - Review results carefully';
  } else {
    level = 'poor';
    message = '❌ Low confidence - Consider using Google Vision or manual editing';
  }
  
  // Apply confidence class
  confidenceSection.className = `confidence-indicator confidence-${level}`;
  fillEl.className = `confidence-fill ${level}`;
  messageEl.textContent = message;
}

/**
 * Show low confidence warning
 */
function showLowConfidenceWarning(confidence, threshold) {
  const warningDiv = document.getElementById('lowConfidenceWarning');
  warningDiv.style.display = 'block';
  
  const warningText = warningDiv.querySelector('p:nth-of-type(2)');
  warningText.textContent = `Analysis confidence (${confidence}%) is below the threshold (${threshold}%). You can:`;
}

/**
 * Populate all metadata fields
 */
function populateMetadataFields(metadata) {
  // Title
  document.getElementById('metaTitle').value = metadata.title || '';
  
  // Description
  document.getElementById('metaDescription').value = metadata.description || '';
  
  // Caption
  document.getElementById('metaCaption').value = metadata.caption || '';
  
  // Keywords
  populateKeywords(metadata.keywords || []);
  
  // Category & Scene Type
  document.getElementById('metaCategory').value = metadata.category || '';
  document.getElementById('metaSceneType').value = metadata.sceneType || '';
  
  // Mood
  document.getElementById('metaMood').value = metadata.mood || '';
  
  // Location
  if (metadata.location) {
    document.getElementById('metaCity').value = metadata.location.city || '';
    document.getElementById('metaState').value = metadata.location.state || '';
    document.getElementById('metaCountry').value = metadata.location.country || '';
    document.getElementById('metaSpecificLocation').value = metadata.location.specificLocation || '';
  }
  
  // GPS coordinates (if available)
  if (currentAnalysisData?.cluster?.mainRep?.gps) {
    const gps = currentAnalysisData.cluster.mainRep.gps;
    document.getElementById('gpsDisplaySection').style.display = 'block';
    document.getElementById('gpsCoordinates').textContent = `${gps.latitude}, ${gps.longitude}`;
  } else {
    document.getElementById('gpsDisplaySection').style.display = 'none';
  }
  
  // Hashtags
  const hashtags = metadata.hashtags || [];
  document.getElementById('metaHashtags').value = hashtags.join(' ');
  
  // Alt Text
  document.getElementById('metaAltText').value = metadata.altText || '';
}

/**
 * Populate keywords as tags
 */
function populateKeywords(keywords) {
  const container = document.getElementById('keywordsContainer');
  container.innerHTML = '';
  
  keywords.forEach(keyword => {
    const tag = createKeywordTag(keyword);
    container.appendChild(tag);
  });
}

/**
 * Create a keyword tag element
 */
function createKeywordTag(keyword) {
  const tag = document.createElement('div');
  tag.className = 'keyword-tag';
  
  const text = document.createElement('span');
  text.textContent = keyword;
  
  const remove = document.createElement('span');
  remove.className = 'keyword-remove';
  remove.textContent = '×';
  remove.onclick = () => tag.remove();
  
  tag.appendChild(text);
  tag.appendChild(remove);
  
  return tag;
}

/**
 * Display static metadata (creator, copyright, date)
 */
function displayStaticMetadata(analysisData) {
  // Extract year from EXIF or use current year
  const year = new Date().getFullYear(); // TODO: Extract from EXIF
  
  const copyrightEl = document.getElementById('copyrightDisplay');
  copyrightEl.textContent = `© ${year} Philip Ethan Grossman. All Rights Reserved.`;
  
  const dateEl = document.getElementById('dateCreatedDisplay');
  dateEl.textContent = 'From EXIF DateTimeOriginal';
}

/**
 * Add keyword from input
 */
function addKeyword() {
  const input = document.getElementById('newKeywordInput');
  const keyword = input.value.trim();
  
  if (!keyword) return;
  
  // Check if keyword already exists
  const existingKeywords = Array.from(document.querySelectorAll('.keyword-tag span:first-child'))
    .map(span => span.textContent);
  
  if (existingKeywords.includes(keyword)) {
    alert('This keyword already exists');
    return;
  }
  
  // Add keyword tag
  const container = document.getElementById('keywordsContainer');
  const tag = createKeywordTag(keyword);
  container.appendChild(tag);
  
  // Clear input
  input.value = '';
}

/**
 * Collect edited metadata from form
 */
function collectMetadataFromForm() {
  // Collect all field values
  const metadata = {
    title: document.getElementById('metaTitle')?.value || '',
    description: document.getElementById('metaDescription')?.value || '',
    caption: document.getElementById('metaCaption')?.value || '',
    category: document.getElementById('metaCategory')?.value || '',
    sceneType: document.getElementById('metaSceneType')?.value || '',
    mood: document.getElementById('metaMood')?.value || '',
    altText: document.getElementById('metaAltText')?.value || '',
    
    // Location
    location: {
      city: document.getElementById('metaCity')?.value || '',
      state: document.getElementById('metaState')?.value || '',
      country: document.getElementById('metaCountry')?.value || '',
      specificLocation: document.getElementById('metaSpecificLocation')?.value || ''
    },
    
    // Keywords - collect from the keywords container
    keywords: [],
    
    // Subjects - collect from subjects container
    subjects: [],
    
    // Hashtags - collect from hashtags container
    hashtags: [],
    
    // Preserve confidence and provider info
    confidence: currentAnalysisData?.metadata?.confidence || 85,
    provider: currentAnalysisData?.metadata?.provider || 'ollama'
  };
  
  // ✅ Collect keywords from .keyword-tag elements in AI Analysis tab
  const keywordTags = document.querySelectorAll('#keywordsContainer .keyword-tag span:first-child');
  keywordTags.forEach(span => {
    const keyword = span.textContent.trim();
    if (keyword) {
      metadata.keywords.push(keyword);
    }
  });
  
  // Collect hashtags (split by space)
  const hashtagsText = document.getElementById('metaHashtags')?.value || '';
  metadata.hashtags = hashtagsText.split(/[\s,]+/).filter(tag => tag.trim());
  
  console.log('📦 Collected metadata:', metadata);
  return metadata;
}

/**
 * Generate XMP files
 */
async function generateXMPFiles() {
  if (!currentAnalysisData) {
    alert('No analysis data available');
    return;
  }
  
  try {
    console.log('Generating XMP files...');
    
    // Collect edited metadata from form
    const editedMetadata = collectMetadataFromForm();
    
    // Show progress
    updateStatus('Generating XMP files...', 'processing');
    showProgress(0);
    
    // Call backend to generate XMP
    const result = await window.electronAPI.generateXMPFiles({
      cluster: currentAnalysisData.cluster,
      metadata: editedMetadata,
      affectedImages: currentAnalysisData.affectedImages
    });
    
    showProgress(100);
    
    if (result.success) {
      updateStatus('XMP files generated successfully!', 'complete');
      alert(`✅ Success! Generated ${result.count} XMP files.`);
      
      // Clear current analysis
      currentAnalysisData = null;
      
      // Return to Visual Analysis tab
      const resultsTab = document.querySelector('[data-tab="results"]');
      if (resultsTab) {
        resultsTab.click();
      }
      
    } else {
      throw new Error(result.error || 'XMP generation failed');
    }
    
  } catch (error) {
    console.error('XMP generation failed:', error);
    updateStatus(`XMP generation failed: ${error.message}`, 'error');
    alert(`XMP generation failed: ${error.message}`);
  }
}

/**
 * Re-analyze with specific provider
 */
async function reanalyzeWithProvider(provider) {
  if (!currentAnalysisData) {
    alert('No analysis data available');
    return;
  }
  
  try {
    console.log(`Re-analyzing with ${provider}...`);
    
    updateStatus(`Re-analyzing with ${provider}...`, 'processing');
    showProgress(0);
    
    // Call backend with forced provider
    const result = await window.electronAPI.analyzeClusterWithAI(
      currentAnalysisData.cluster,
      provider
    );
    
    showProgress(100);
    
    if (result.success) {
      console.log('Re-analysis complete:', result.data);
      currentAnalysisData = result.data;
      displayAIAnalysisResults(result.data);
      updateStatus('Re-analysis complete!', 'complete');
    } else {
      throw new Error(result.error || 'Re-analysis failed');
    }
    
  } catch (error) {
    console.error('Re-analysis failed:', error);
    updateStatus(`Re-analysis failed: ${error.message}`, 'error');
    alert(`Re-analysis failed: ${error.message}`);
  }
}

// ============================================
// Event Listeners for AI Analysis Tab
// ============================================

function initializeAIAnalysisListeners() {
  // Add keyword button
  const addKeywordBtn = document.getElementById('addKeywordBtn');
  if (addKeywordBtn) {
    addKeywordBtn.addEventListener('click', addKeyword);
  }
  
  // Add keyword on Enter key
  const newKeywordInput = document.getElementById('newKeywordInput');
  if (newKeywordInput) {
    newKeywordInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addKeyword();
      }
    });
  }
  
  // Regenerate button
  const regenerateBtn = document.getElementById('regenerateBtn');
  if (regenerateBtn) {
    regenerateBtn.addEventListener('click', () => reanalyzeWithProvider('ollama'));
  }
  
  // Save metadata for current cluster button (replaces old Generate XMP button)
  const saveMetadataBtn = document.getElementById('saveMetadataBtn');
  if (saveMetadataBtn) {
    saveMetadataBtn.addEventListener('click', saveCurrentClusterMetadata);
  }
  
  // Generate All XMP button
  const generateAllXMPBtn = document.getElementById('generateAllXMPBtn');
  if (generateAllXMPBtn) {
    generateAllXMPBtn.addEventListener('click', generateAllXMPFiles);
  }
  
  // Load clusters when AI Analysis tab is clicked
  // Note: loadClustersForAnalysis() is called automatically after batch analysis
  // No need for tab click listener to avoid duplicate calls
  
  // Low confidence warning buttons
  const reanalyzeOllamaBtn = document.getElementById('reanalyzeOllamaBtn');
  if (reanalyzeOllamaBtn) {
    reanalyzeOllamaBtn.addEventListener('click', () => reanalyzeWithProvider('ollama'));
  }
  
  const analyzeGoogleBtn = document.getElementById('analyzeGoogleBtn');
  if (analyzeGoogleBtn) {
    analyzeGoogleBtn.addEventListener('click', () => reanalyzeWithProvider('google'));
  }
  
  const acceptManuallyBtn = document.getElementById('acceptManuallyBtn');
  if (acceptManuallyBtn) {
    acceptManuallyBtn.addEventListener('click', () => {
      document.getElementById('lowConfidenceWarning').style.display = 'none';
      alert('You can now edit the metadata manually before generating XMP files.');
    });
  }
  
  console.log('✅ AI Analysis listeners attached');
}

// ============================================
// Personal Data Functions
// ============================================

/**
 * Load personal data from database
 */
async function loadPersonalData() {
  try {
    const data = await window.electronAPI.getPersonalData();
    
    if (data.success && data.data) {
      document.getElementById('creatorName').value = data.data.creatorName || '';
      document.getElementById('creatorJobTitle').value = data.data.jobTitle || '';
      document.getElementById('creatorAddress').value = data.data.address || '';
      document.getElementById('creatorCity').value = data.data.city || '';
      document.getElementById('creatorState').value = data.data.state || '';
      document.getElementById('creatorPostalCode').value = data.data.postalCode || '';
      document.getElementById('creatorCountry').value = data.data.country || '';
      document.getElementById('creatorPhone').value = data.data.phone || '';
      document.getElementById('creatorEmail').value = data.data.email || '';
      document.getElementById('creatorWebsite').value = data.data.website || '';
      document.getElementById('copyrightStatus').value = data.data.copyrightStatus || 'copyrighted';
      document.getElementById('copyrightNotice').value = data.data.copyrightNotice || '';
      document.getElementById('rightsUsageTerms').value = data.data.rightsUsageTerms || '';
      
      console.log('✅ Personal data loaded');
    }
  } catch (error) {
    console.error('❌ Failed to load personal data:', error);
  }
}

/**
 * Save personal data to database
 */
async function savePersonalData() {
  const data = {
    creatorName: document.getElementById('creatorName').value,
    jobTitle: document.getElementById('creatorJobTitle').value,
    address: document.getElementById('creatorAddress').value,
    city: document.getElementById('creatorCity').value,
    state: document.getElementById('creatorState').value,
    postalCode: document.getElementById('creatorPostalCode').value,
    country: document.getElementById('creatorCountry').value,
    phone: document.getElementById('creatorPhone').value,
    email: document.getElementById('creatorEmail').value,
    website: document.getElementById('creatorWebsite').value,
    copyrightStatus: document.getElementById('copyrightStatus').value,
    copyrightNotice: document.getElementById('copyrightNotice').value,
    rightsUsageTerms: document.getElementById('rightsUsageTerms').value
  };
  
  // Validate required fields
  if (!data.creatorName || !data.email || !data.copyrightNotice) {
    alert('❌ Please fill in all required fields (marked with *)');
    return;
  }
  
  try {
    const result = await window.electronAPI.savePersonalData(data);
    
    if (result.success) {
      alert('✅ Personal data saved successfully!');
    } else {
      alert('❌ Failed to save: ' + result.error);
    }
  } catch (error) {
    console.error('❌ Failed to save personal data:', error);
    alert('❌ Error saving personal data: ' + error.message);
  }
}

// ============================================
// Application Ready
// ============================================
console.log('App.js fully loaded. Waiting for DOM...');
