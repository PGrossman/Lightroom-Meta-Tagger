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

// Prompt editing state
let customPrompts = new Map(); // Map of representativePath -> customPrompt
let currentPromptCluster = null; // Currently editing cluster

// AI Analysis card editing state
let currentEditingCluster = null; // Currently editing cluster in modal
let currentEditingGroupIndex = null; // Currently editing group index

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

  // Analysis tab switching (AI Generated vs Database Match)
  const analysisTabButtons = document.querySelectorAll('.analysis-tab-btn');
  const analysisTabContents = document.querySelectorAll('.analysis-tab-content');

  analysisTabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.dataset.tab;
      
      // Update button states
      analysisTabButtons.forEach(btn => {
        btn.classList.remove('active');
        btn.style.borderBottom = '3px solid transparent';
        btn.style.color = '#666';
      });
      
      // Update content visibility
      analysisTabContents.forEach(content => {
        content.style.display = 'none';
      });
      
      // Activate selected tab
      button.classList.add('active');
      button.style.borderBottom = '3px solid #3498db';
      button.style.color = '#3498db';
      
      // Show selected content
      if (tabName === 'ai-generated') {
        document.getElementById('aiGeneratedContent').style.display = 'block';
      }
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
    dropzone.addEventListener('dragenter', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('dragover');
      dropzone.style.backgroundColor = '#e3f2fd';
      dropzone.style.borderColor = '#3498db';
    });
    
    dropzone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');
      dropzone.style.backgroundColor = '#f8f9fa';
      dropzone.style.borderColor = '#cbd5e0';
    });

    dropzone.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');
      dropzone.style.backgroundColor = '#d4edda';
      dropzone.style.borderColor = '#28a745';
      
      const files = e.dataTransfer.files;
      
      if (files.length > 0) {
        // In Electron, files[0].path gives the absolute file system path
        const droppedPath = files[0].path;
        console.log('File/folder dropped:', droppedPath);
        
        // Determine if it's a directory or file
        let dirToScan;
        const isDir = await window.electronAPI.isDirectory(droppedPath);
        if (isDir) {
          dirToScan = droppedPath;
        } else {
          dirToScan = await window.electronAPI.getParentDir(droppedPath);
        }
        
        // Scan the directory
        await selectAndScanDirectory(dirToScan);
      }
    });

    dropzone.addEventListener('click', async (e) => {
      if (e.target.id !== 'selectDirBtn') {
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
    savePersonalDataBtn.addEventListener('click', () => {
      console.log('Save Personal Data clicked - function not yet implemented');
      alert('Save Personal Data feature coming soon');
    });
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
    console.log('Arguments:', { 
      scanResults: !!window.scanResults, 
      dirPath: window.selectedDirectory
    });
    
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
      
      // ============================================================================
      // 🔍 STEP 1: AFTER BACKEND PROCESSING - Track derivatives from backend
      // ============================================================================
      console.log('\n🔍 ========== STEP 1: AFTER BACKEND PROCESSING ==========');
      console.log(`window.processedClusters count: ${window.processedClusters.length}`);
      let step1Derivs = 0;
      let step1Files = 0;
      window.processedClusters.forEach((c, idx) => {
        const derivCount = c.derivatives?.length || 0;
        const imageCount = c.imagePaths?.length || 0;
        step1Derivs += derivCount;
        step1Files += imageCount;
        console.log(`[${idx}] ${c.representativeFilename}`);
        console.log(`     imagePaths: ${imageCount}, derivatives: ${derivCount}`);
        if (derivCount > 0) {
          c.derivatives.forEach(d => console.log(`       - ${d.split('/').pop()}`));
        }
      });
      console.log(`📊 Total after backend: ${window.processedClusters.length} reps + ${step1Files} images + ${step1Derivs} derivatives`);
      console.log(`📊 GRAND TOTAL: ${window.processedClusters.length + step1Files + step1Derivs} files`);
      console.log(`📊 EXPECTED: 78 files`);
      console.log(`📊 DIFFERENCE: ${78 - (window.processedClusters.length + step1Files + step1Derivs)} files ${78 - (window.processedClusters.length + step1Files + step1Derivs) > 0 ? 'MISSING' : 'EXTRA'}`);
      console.log('🔍 ==========================================\n');
      // ============================================================================
      
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
  
  // Status column
  const statusCell = document.createElement('td');
  const statusBadge = document.createElement('span');
  statusBadge.className = 'status-badge status-ready';
  statusBadge.textContent = 'Ready';
  statusCell.appendChild(statusBadge);
  
  // Append all cells
  row.appendChild(parentCell);
  row.appendChild(childCell);
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
  
  // Status column
  const statusCell = document.createElement('td');
  const statusBadge = document.createElement('span');
  statusBadge.className = 'status-badge status-ready';
  statusBadge.textContent = cluster.isBracketed ? 'Bracketed Ready' : 'Ready';
  statusCell.appendChild(statusBadge);
  
  // Append all cells
  row.appendChild(parentCell);
  row.appendChild(childCell);
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
    
    // ✅ CRITICAL FIX: Get derivatives from window.processedClusters (source of truth)
    console.log(`🔍 Looking up derivatives for group: ${mainRep.representativeFilename}`);
    
    const mainRepWithDerivatives = window.processedClusters.find(c => 
      c.representativePath === mainRep.representativePath
    );
    
    if (mainRepWithDerivatives?.derivatives) {
      console.log(`   ✅ Found ${mainRepWithDerivatives.derivatives.length} derivatives for main rep`);
    } else {
      console.log(`   ⚠️ No derivatives found for main rep in window.processedClusters`);
    }
    
    const similarRepsWithDerivatives = similarReps.map(sim => {
      const sourceCluster = window.processedClusters.find(c =>
        c.representativePath === sim.cluster.representativePath
      );
      
      if (sourceCluster?.derivatives && sourceCluster.derivatives.length > 0) {
        console.log(`   ✅ Found ${sourceCluster.derivatives.length} derivatives for similar: ${sim.cluster.representativeFilename}`);
      }
      
      return {
        ...sim,
        cluster: {
          ...sim.cluster,
          derivatives: sourceCluster?.derivatives || []
        }
      };
    });
    
    const group = {
      mainRep: {
        ...mainRep,
        derivatives: mainRepWithDerivatives?.derivatives || []
      },
      similarReps: similarRepsWithDerivatives,
      allClusters: groupClusters.map(c => {
        const sourceCluster = window.processedClusters.find(pc =>
          pc.representativePath === c.representativePath
        );
        return {
          ...c,
          derivatives: sourceCluster?.derivatives || []
        };
      }),
      connectionCount: maxConnections
    };
    
    similarityGroups.push(group);
    
    console.log(`  Group: ${mainRep.representativeFilename} (${maxConnections} connections) + ${similarReps.length} similar`);
  });
  
  // Sort groups by connection count (most connected first)
  similarityGroups.sort((a, b) => b.connectionCount - a.connectionCount);
  
  // ============================================================================
  // 🔍 STEP 2: AFTER buildSimilarityGroups - Track derivatives after grouping
  // ============================================================================
  console.log('\n🔍 ========== STEP 2: AFTER buildSimilarityGroups ==========');
  let step2Derivs = 0;
  let step2Files = 0;
  let step2Reps = 0;
  similarityGroups.forEach((group, idx) => {
    const mainDerivs = group.mainRep.derivatives?.length || 0;
    const mainImages = group.mainRep.imagePaths?.length || 0;
    step2Derivs += mainDerivs;
    step2Files += mainImages;
    step2Reps += 1; // main rep
    
    console.log(`[${idx}] ${group.mainRep.representativeFilename}`);
    console.log(`     Main: imagePaths=${mainImages}, derivatives=${mainDerivs}`);
    
    if (group.similarReps) {
      group.similarReps.forEach((sim, simIdx) => {
        const simDerivs = sim.cluster.derivatives?.length || 0;
        const simImages = sim.cluster.imagePaths?.length || 0;
        step2Derivs += simDerivs;
        step2Files += simImages;
        step2Reps += 1;
        console.log(`     Similar ${simIdx + 1}: imagePaths=${simImages}, derivatives=${simDerivs}`);
      });
    }
  });
  console.log(`📊 Total after grouping: ${step2Reps} reps + ${step2Files} images + ${step2Derivs} derivatives`);
  console.log(`📊 GRAND TOTAL: ${step2Reps + step2Files + step2Derivs} files`);
  console.log(`📊 EXPECTED: 78 files`);
  console.log(`📊 DIFFERENCE: ${78 - (step2Reps + step2Files + step2Derivs)} files ${78 - (step2Reps + step2Files + step2Derivs) > 0 ? 'MISSING' : 'EXTRA'}`);
  console.log('🔍 ==========================================\n');
  // ============================================================================
  
  console.log('✅ Similarity groups built successfully');
  
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
      // ============================================================================
      // 🔍 PRE-GROUPING DIAGNOSTIC - Check which clusters are standalone
      // ============================================================================
      console.log('\n🔍 ========== PRE-GROUPING CHECK ==========');
      console.log(`  window.processedClusters: ${window.processedClusters.length} clusters`);
      console.log(`  window.similarityResults: ${window.similarityResults.length} pairs`);
      
      // Extract unique cluster names from similarity pairs
      const clustersInSimilarity = new Set();
      window.similarityResults.forEach(pair => {
        // Try different possible property names for similarity pair structure
        const rep1 = pair.rep1 || pair.image1 || pair.path1;
        const rep2 = pair.rep2 || pair.image2 || pair.path2;
        if (rep1) clustersInSimilarity.add(rep1);
        if (rep2) clustersInSimilarity.add(rep2);
      });
      
      console.log(`  Clusters appearing in similarity results: ${clustersInSimilarity.size}`);
      console.log(`  Standalone clusters (no matches): ${window.processedClusters.length - clustersInSimilarity.size}`);
      
      // List standalone clusters
      const standaloneClusters = window.processedClusters.filter(c => 
        !clustersInSimilarity.has(c.representativePath) && 
        !clustersInSimilarity.has(c.representativeFilename)
      );
      if (standaloneClusters.length > 0) {
        console.log('\n  📦 Standalone clusters that will be MISSED by buildSimilarityGroups:');
        standaloneClusters.forEach(c => {
          console.log(`     - ${c.representativeFilename} (${c.imageCount} images, ${c.derivatives?.length || 0} derivatives)`);
        });
      }
      console.log('🔍 ==========================================\n');
      // ============================================================================
      
      // ============================================================================
      // 🔍 COMPREHENSIVE DIAGNOSTIC - Check window.processedClusters
      // ============================================================================
      console.log('\n🔍 ========== WINDOW.PROCESSEDCLUSTERS DIAGNOSTIC ==========');
      console.log(`Total clusters in window.processedClusters: ${window.processedClusters.length}`);
      
      let totalDerivativesFound = 0;
      window.processedClusters.forEach((cluster, idx) => {
        const derivCount = cluster.derivatives?.length || 0;
        totalDerivativesFound += derivCount;
        
        console.log(`\n[${idx}] ${cluster.representativeFilename || cluster.representative}`);
        console.log(`    representativePath: ${cluster.representativePath}`);
        console.log(`    Has derivatives array: ${!!cluster.derivatives}`);
        console.log(`    Derivatives count: ${derivCount}`);
        
        if (derivCount > 0) {
          console.log(`    Derivatives:`);
          cluster.derivatives.forEach(d => {
            console.log(`      - ${d.split('/').pop()}`);
          });
        }
      });
      
      console.log(`\n📊 TOTAL DERIVATIVES IN WINDOW.PROCESSEDCLUSTERS: ${totalDerivativesFound}`);
      console.log('🔍 ========== END DIAGNOSTIC ==========\n');
      // ============================================================================
      
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

  // ✅ ADD: View/Edit Prompt button
  const promptBtn = document.createElement('button');
  promptBtn.className = 'view-prompt-btn-visual';
  promptBtn.setAttribute('data-cluster-path', group.mainRep.representativePath);
  promptBtn.innerHTML = `
    <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
    View/Edit Prompt
  `;
  promptBtn.title = 'View/edit the AI prompt for this image';
  promptBtn.onclick = (e) => {
    e.stopPropagation();
    showPromptEditor(group);
  };

  // Update button text if custom prompt exists
  if (customPrompts.has(group.mainRep.representativePath)) {
    promptBtn.innerHTML = promptBtn.innerHTML.replace('View/Edit Prompt', '✏️ Edit Prompt');
    promptBtn.classList.add('editing');
  }

  thumbContainer.appendChild(promptBtn);

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
          simRep.similarityPercent,
          cluster  // ← ADD THIS 4th PARAMETER: Pass the parent cluster for extraction
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

  // Column 3: Keywords (editable with delete buttons + add new)
  const keywordsCell = document.createElement('td');
  keywordsCell.className = 'keywords-cell';

  const keywordsList = document.createElement('div');
  keywordsList.className = 'keywords-list';

  // Display existing keywords
  if (cluster.keywords && cluster.keywords.length > 0) {
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
  }

  // ✅ NEW: Add keyword input + button
  const addKeywordContainer = document.createElement('div');
  addKeywordContainer.style.display = 'flex';
  addKeywordContainer.style.gap = '4px';
  addKeywordContainer.style.marginTop = '6px';

  const addKeywordInput = document.createElement('input');
  addKeywordInput.type = 'text';
  addKeywordInput.placeholder = 'Add keyword...';
  addKeywordInput.style.flex = '1';
  addKeywordInput.style.padding = '4px 8px';
  addKeywordInput.style.border = '1px solid #dee2e6';
  addKeywordInput.style.borderRadius = '3px';
  addKeywordInput.style.fontSize = '12px';

  const addKeywordBtn = document.createElement('button');
  addKeywordBtn.textContent = '+';
  addKeywordBtn.title = 'Add keyword';
  addKeywordBtn.style.padding = '4px 10px';
  addKeywordBtn.style.backgroundColor = '#28a745';
  addKeywordBtn.style.color = 'white';
  addKeywordBtn.style.border = 'none';
  addKeywordBtn.style.borderRadius = '3px';
  addKeywordBtn.style.cursor = 'pointer';
  addKeywordBtn.style.fontSize = '14px';
  addKeywordBtn.style.fontWeight = 'bold';

  addKeywordBtn.onclick = (e) => {
    e.stopPropagation();
    const newKeyword = addKeywordInput.value.trim();
    if (newKeyword) {
      addKeywordToCluster(group.mainRep.representativePath, newKeyword, keywordsList, addKeywordInput);
    }
  };

  // Also allow Enter key to add keyword
  addKeywordInput.onkeypress = (e) => {
    if (e.key === 'Enter') {
      e.stopPropagation();
      const newKeyword = addKeywordInput.value.trim();
      if (newKeyword) {
        addKeywordToCluster(group.mainRep.representativePath, newKeyword, keywordsList, addKeywordInput);
      }
    }
  };

  addKeywordContainer.appendChild(addKeywordInput);
  addKeywordContainer.appendChild(addKeywordBtn);

  keywordsCell.appendChild(keywordsList);
  keywordsCell.appendChild(addKeywordContainer);

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
    // Store cluster path for later forced-save
    gpsDisplay.dataset.clusterPath = group.mainRep.representativePath;
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
    // Store cluster path for later forced-save
    gpsInput.dataset.clusterPath = group.mainRep.representativePath;
    
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
        gpsDisplay.dataset.clusterPath = group.mainRep.representativePath;
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
 * Add a keyword to a cluster
 */
function addKeywordToCluster(clusterPath, keyword, keywordsList, inputElement) {
  console.log('➕ Adding keyword:', { cluster: clusterPath, keyword });
  
  // Find the cluster in allProcessedImages
  const group = allProcessedImages.find(g => 
    g.mainRep && g.mainRep.representativePath === clusterPath
  );
  
  if (group && group.mainRep) {
    // Initialize keywords array if it doesn't exist
    if (!group.mainRep.keywords) {
      group.mainRep.keywords = [];
    }
    
    // Check if keyword already exists
    if (group.mainRep.keywords.includes(keyword)) {
      alert('Keyword already exists!');
      inputElement.value = '';
      return;
    }
    
    // Add keyword to array
    group.mainRep.keywords.push(keyword);
    
    // Also update in window.processedClusters if it exists
    if (window.processedClusters) {
      const windowCluster = window.processedClusters.find(c => 
        c.representativePath === clusterPath
      );
      if (windowCluster) {
        if (!windowCluster.keywords) {
          windowCluster.keywords = [];
        }
        if (!windowCluster.keywords.includes(keyword)) {
          windowCluster.keywords.push(keyword);
        }
      }
    }
    
    // Add to DOM (before the add input container)
    const keywordItem = document.createElement('div');
    keywordItem.className = 'keyword-item';
    
    // Delete button (X)
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'keyword-delete-btn';
    deleteBtn.textContent = '×';
    deleteBtn.title = 'Remove keyword';
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      removeKeyword(clusterPath, keyword, keywordItem);
    };
    
    // Editable keyword text
    const keywordText = document.createElement('span');
    keywordText.className = 'keyword-text';
    keywordText.contentEditable = true;
    keywordText.textContent = keyword;
    keywordText.spellcheck = false;
    keywordText.onclick = (e) => {
      e.stopPropagation();
      keywordText.focus();
    };
    keywordText.onblur = () => {
      const newKeyword = keywordText.textContent.trim();
      if (newKeyword && newKeyword !== keyword) {
        updateKeyword(clusterPath, keyword, newKeyword);
      } else if (!newKeyword) {
        keywordText.textContent = keyword;
      }
    };
    keywordText.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        keywordText.blur();
      }
      if (e.key === 'Escape') {
        keywordText.textContent = keyword;
        keywordText.blur();
      }
    };
    
    keywordItem.appendChild(deleteBtn);
    keywordItem.appendChild(keywordText);
    keywordsList.appendChild(keywordItem);
    
    // Clear input
    inputElement.value = '';
    
    console.log('✅ Keyword added successfully');
  } else {
    console.error('❌ Could not find cluster to add keyword to');
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
 * ✅ FIXED: Handles BOTH window.processedClusters (flat array) AND allProcessedImages (nested) structures
 */
function updateGPS(clusterPath, gpsString) {
  console.log('💾 === UPDATE GPS CALLED ===');
  console.log('   Path:', clusterPath);
  console.log('   GPS String:', gpsString);
  
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
  
  const gpsData = { 
    latitude, 
    longitude, 
    source: 'Manual Entry' 
  };
  
  let saved = false;
  
  // ✅ FIX 1: Save to window.processedClusters (flat array - NO mainRep!)
  if (window.processedClusters) {
    console.log('   🔍 Searching window.processedClusters (count:', window.processedClusters.length, ')');
    
    const cluster = window.processedClusters.find(c => 
      c.representativePath === clusterPath || 
      c.representative === clusterPath
    );
    
    if (cluster) {
      cluster.gps = gpsData;
      saved = true;
      console.log('   ✅ GPS saved to window.processedClusters');
      console.log('      Cluster:', cluster.representativeFilename || cluster.representative);
      console.log('      GPS:', gpsData);
    } else {
      console.log('   ⚠️  Cluster NOT found in window.processedClusters');
      console.log('      Looking for path:', clusterPath);
    }
  }
  
  // ✅ FIX 2: ALSO save to allProcessedImages (similarity groups - HAS mainRep)
  if (allProcessedImages) {
    console.log('   🔍 Searching allProcessedImages (count:', allProcessedImages.length, ')');
    
    const group = allProcessedImages.find(g => 
      g.mainRep?.representativePath === clusterPath
    );
    
    if (group) {
      group.mainRep.gps = gpsData;
      saved = true;
      console.log('   ✅ GPS saved to allProcessedImages');
      console.log('      Group:', group.mainRep.representativeFilename);
      console.log('      GPS:', gpsData);
    } else {
      console.log('   ⚠️  Group NOT found in allProcessedImages');
    }
  }
  
  if (saved) {
    console.log('   ✅ GPS UPDATE COMPLETE');
    return true;
  } else {
    console.error('   ❌ GPS NOT SAVED - Cluster not found in any array!');
    return false;
  }
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
/**
 * Show image preview modal with optional "Make Parent Image" button
 */
async function showImagePreview(imagePath, filename, similarityPercent = null, sourceCluster = null) {
  const modal = document.getElementById('imagePreviewModal');
  const previewImg = document.getElementById('previewImage');
  const filenameEl = document.getElementById('previewFilename');
  const similarityEl = document.getElementById('previewSimilarity');
  const makeParentBtn = document.getElementById('makeParentImageBtn');
  
  // Load thumbnail
  const result = await window.electronAPI.getPreviewImage(imagePath);
  
  if (result.success) {
    previewImg.src = result.dataUrl;
    filenameEl.textContent = filename;
    
    // Show similarity percentage if available
    if (similarityPercent) {
      similarityEl.textContent = `${similarityPercent}% match`;
      similarityEl.style.display = 'block';
    } else {
      similarityEl.style.display = 'none';
    }
    
    // Show "Make Parent Image" button only for Similar Parent Representatives
    if (sourceCluster && similarityPercent) {
      makeParentBtn.style.display = 'block';
      
      // Store data on the button for the click handler
      makeParentBtn.dataset.imagePath = imagePath;
      makeParentBtn.dataset.filename = filename;
      makeParentBtn.dataset.sourceClusterPath = sourceCluster.representativePath;
    } else {
      makeParentBtn.style.display = 'none';
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
 * Extract a Similar Parent Representative and make it its own parent image
 */
function makeParentImage(imagePath, sourceClusterPath) {
  console.log('🔄 Extracting image to new parent cluster:', imagePath);
  console.log('   From source cluster:', sourceClusterPath);
  
  // Find the source super cluster in allProcessedImages
  const sourceGroupIndex = allProcessedImages.findIndex(g => 
    g.mainRep && g.mainRep.representativePath === sourceClusterPath
  );
  
  if (sourceGroupIndex === -1) {
    console.error('❌ Source cluster not found');
    alert('Error: Could not find source cluster');
    return;
  }
  
  const sourceGroup = allProcessedImages[sourceGroupIndex];
  
  // Find the specific similar rep to extract
  const simRepIndex = sourceGroup.similarReps.findIndex(
    sim => sim.cluster.representativePath === imagePath
  );
  
  if (simRepIndex === -1) {
    console.error('❌ Similar representative not found in source cluster');
    alert('Error: Could not find image in cluster');
    return;
  }
  
  // Extract the similar rep's cluster data
  const extractedCluster = sourceGroup.similarReps[simRepIndex].cluster;
  
  // Remove it from the source group's similarReps
  sourceGroup.similarReps.splice(simRepIndex, 1);
  
  // Also remove from allClusters array if it exists
  const allClustersIndex = sourceGroup.allClusters.findIndex(
    c => c.representativePath === imagePath
  );
  if (allClustersIndex !== -1) {
    sourceGroup.allClusters.splice(allClustersIndex, 1);
  }
  
  // Update connection count for source group
  sourceGroup.connectionCount = sourceGroup.similarReps.length;
  
  // Create a new group with just this image as the parent
  const newGroup = {
    mainRep: extractedCluster,
    similarReps: [],
    allClusters: [extractedCluster],
    connectionCount: 0
  };
  
  // Add the new group to allProcessedImages
  allProcessedImages.push(newGroup);
  
  // Also update window.processedClusters if it exists
  if (window.processedClusters) {
    const existingIndex = window.processedClusters.findIndex(
      c => c.representativePath === imagePath
    );
    if (existingIndex === -1) {
      window.processedClusters.push(extractedCluster);
    }
  }
  
  // Also add to allClustersForAnalysis if it exists (for AI Analysis tab)
  if (window.allClustersForAnalysis) {
    const analysisExists = window.allClustersForAnalysis.findIndex(
      g => g.mainRep && g.mainRep.representativePath === imagePath
    );
    if (analysisExists === -1) {
      window.allClustersForAnalysis.push(newGroup);
    }
  }
  
  console.log('✅ Created new parent cluster:', extractedCluster.representativeFilename);
  console.log('   Total clusters now:', allProcessedImages.length);
  console.log('   Source cluster now has', sourceGroup.similarReps.length, 'similar reps');
  
  // Close the modal
  closeImagePreview();
  
  // Refresh the Visual Analysis table to show the changes
  refreshVisualAnalysisTable();
  
  // Show success notification
  showNotification(`Created new parent cluster: ${extractedCluster.representativeFilename}`);
}

/**
 * Refresh the Visual Analysis table after making changes
 */
async function refreshVisualAnalysisTable() {
  console.log('🔄 Refreshing Visual Analysis table...');
  
  // Re-render the current page
  await renderResultsPage();
  
  console.log('✅ Visual Analysis table refreshed');
}

/**
 * Initialize modal event listeners
 */
function initializeModalListeners() {
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalBackdrop = document.getElementById('modalBackdrop');
  const makeParentBtn = document.getElementById('makeParentImageBtn');
  
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
      if (e.target === modalBackdrop) {
        closeImagePreview();
      }
    });
    console.log('✅ Modal backdrop listener attached');
  } else {
    console.error('❌ modalBackdrop not found');
  }
  
  // ✅ NEW: Add listener for "Make Parent Image" button
  if (makeParentBtn) {
    makeParentBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      console.log('🎯 Make Parent Image button clicked');
      
      // Get data from button
      const imagePath = e.target.dataset.imagePath;
      const sourceClusterPath = e.target.dataset.sourceClusterPath;
      
      if (imagePath && sourceClusterPath) {
        makeParentImage(imagePath, sourceClusterPath);
      } else {
        console.error('❌ Missing data for makeParentImage');
        alert('Error: Missing required data');
      }
    });
    console.log('✅ Make Parent Image button listener attached');
  } else {
    console.error('❌ makeParentImageBtn not found');
  }
  
  // Close modal on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      console.log('🔴 Escape key pressed');
      closeImagePreview();
    }
  });
  console.log('✅ Escape key listener attached');
  
  // Prompt Editor Modal listeners
  const promptModalCloseBtn = document.getElementById('promptModalCloseBtn');
  const promptModalBackdrop = document.getElementById('promptModalBackdrop');
  const promptEditorCancelBtn = document.getElementById('promptEditorCancelBtn');
  const promptEditorSaveBtn = document.getElementById('promptEditorSaveBtn');
  
  if (promptModalCloseBtn) {
    promptModalCloseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closePromptEditor();
    });
    console.log('✅ Prompt modal close button listener attached');
  }
  
  if (promptModalBackdrop) {
    promptModalBackdrop.addEventListener('click', (e) => {
      if (e.target === promptModalBackdrop) {
        closePromptEditor();
      }
    });
    console.log('✅ Prompt modal backdrop listener attached');
  }
  
  if (promptEditorCancelBtn) {
    promptEditorCancelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closePromptEditor();
    });
    console.log('✅ Prompt editor cancel button listener attached');
  }
  
  if (promptEditorSaveBtn) {
    promptEditorSaveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      saveCustomPrompt();
    });
    console.log('✅ Prompt editor save button listener attached');
  }
  
  // Close prompt modal on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const promptModal = document.getElementById('promptEditorModal');
      if (promptModal && promptModal.style.display !== 'none') {
        closePromptEditor();
      }
    }
  });
  
  // Edit Metadata Modal listeners
  const editModalCloseBtn = document.getElementById('editModalCloseBtn');
  const editModalCancelBtn = document.getElementById('editModalCancelBtn');
  const editModalSaveBtn = document.getElementById('editModalSaveBtn');
  const addModalKeywordBtn = document.getElementById('addModalKeywordBtn');
  const editModalOverlay = document.getElementById('editMetadataModal');

  if (editModalCloseBtn) {
    editModalCloseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeEditModal();
    });
    console.log('✅ Edit modal close button listener attached');
  }

  if (editModalCancelBtn) {
    editModalCancelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeEditModal();
    });
    console.log('✅ Edit modal cancel button listener attached');
  }

  if (editModalSaveBtn) {
    editModalSaveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      saveModalMetadata();
    });
    console.log('✅ Edit modal save button listener attached');
  }

  if (addModalKeywordBtn) {
    addModalKeywordBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      addModalKeyword();
    });
    console.log('✅ Add keyword button listener attached');
  }

  if (editModalOverlay) {
    editModalOverlay.addEventListener('click', (e) => {
      if (e.target === editModalOverlay) {
        closeEditModal();
      }
    });
    console.log('✅ Edit modal backdrop listener attached');
  }
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

let currentAnalysisData = null;
let allClustersForAnalysis = [];
let analyzedClusters = new Map();
let currentClusterIndex = null;
let preAnalysisGPS = new Map();

async function batchAnalyzeAllClusters() {
  console.log('\n🚀 BATCH ANALYSIS START');
  
  for (let i = 0; i < allProcessedImages.length; i++) {
    const group = allProcessedImages[i];
    const clusterName = group.mainRep?.representativeFilename || 'Unknown';
    
    console.log(`[${i+1}/${allProcessedImages.length}] Analyzing: ${clusterName}`);
    
    try {
      updateStatus(`Analyzing cluster ${i + 1} of ${allProcessedImages.length}...`, 'processing');
      const result = await window.electronAPI.analyzeClusterWithAI(group);
      
      if (result.success) {
        analyzedClusters.set(i, result.data.metadata);
        console.log(`✅ Stored at index ${i}`);
      }
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
    }
  }
  
  console.log('✅ BATCH COMPLETE, size:', analyzedClusters.size);
  updateStatus('All clusters analyzed!', 'complete');
  
  allClustersForAnalysis = [...allProcessedImages];
  showCards();
}

function showCards() {
  console.log('🎨 showCards called');
  
  const emptyState = document.getElementById('aiAnalysisEmpty');
  const cardList = document.getElementById('aiAnalysisCardList');
  const container = document.getElementById('clusterCardsContainer');
  const generateBtn = document.getElementById('generateAllXMPBtn');
  
  if (!cardList || !container) {
    console.error('❌ Elements not found!');
    return;
  }
  
  if (analyzedClusters.size === 0) {
    console.log('ℹ️ No analyzed clusters');
    if (emptyState) emptyState.style.display = 'block';
    if (cardList) cardList.style.display = 'none';
    return;
  }
  
  console.log('✅ Showing cards');
  if (emptyState) emptyState.style.display = 'none';
  if (cardList) cardList.style.display = 'block';
  if (generateBtn) {
    generateBtn.style.display = 'block';
    generateBtn.disabled = false;
  }
  
  renderCards(container);
}

async function renderCards(container) {
  console.log('📦 renderCards called');
  container.innerHTML = '';
  
  for (let i = 0; i < allClustersForAnalysis.length; i++) {
    if (analyzedClusters.has(i)) {
      const cluster = allClustersForAnalysis[i];
      const metadata = analyzedClusters.get(i);
      const card = await makeCard(cluster, metadata, i);
      container.appendChild(card);
    }
  }
  
  // Add event delegation for dynamically created buttons
  setupCardEventListeners(container);
  
  console.log(`✅ Rendered ${container.children.length} cards`);
}

function setupCardEventListeners(container) {
  // Edit/Update button event delegation
  container.addEventListener('click', async (e) => {
    if (e.target.classList.contains('cluster-card-edit-btn')) {
      const clusterId = e.target.getAttribute('data-cluster-id');
      console.log('Edit/Update clicked for cluster:', clusterId);
      showMetadataEditor(parseInt(clusterId));
    }
    
    // Map link event delegation
    if (e.target.classList.contains('cluster-card-map-link')) {
      e.preventDefault();
      const lat = e.target.getAttribute('data-lat');
      const lon = e.target.getAttribute('data-lon');
      
      // Validate GPS coordinates
      if (!lat || !lon || isNaN(parseFloat(lat)) || isNaN(parseFloat(lon))) {
        console.error('❌ Invalid GPS coordinates:', { lat, lon });
        alert('Invalid GPS coordinates. Please check the location data.');
        return;
      }
      
      // Use proper Google Maps URL format
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
      console.log('🗺️ Opening Google Maps:', mapsUrl);
      
      try {
        // Use Electron's openExternal API through IPC
        await window.electronAPI.openExternal(mapsUrl);
      } catch (error) {
        console.error('❌ Failed to open Google Maps:', error);
        // Fallback to window.open if IPC fails
        window.open(mapsUrl, '_blank');
      }
    }
  });
}

// ============================================
// EDIT METADATA MODAL FUNCTIONS (FOR HTML MODAL)
// ============================================

// Global variables for modal state (already declared at top of file)

/**
 * Show metadata editor modal for a specific cluster
 */
function showMetadataEditor(clusterIndex) {
  if (clusterIndex < 0 || clusterIndex >= allClustersForAnalysis.length) {
    console.error('Invalid cluster index:', clusterIndex);
    return;
  }

  const cluster = allClustersForAnalysis[clusterIndex];
  const metadata = analyzedClusters.get(clusterIndex) || {};
  
  // Store current editing cluster index (uses existing global variables)
  currentEditingCluster = cluster;
  currentEditingGroupIndex = clusterIndex;
  
  // Show the modal (the HTML one, not creating a new one)
  const modal = document.getElementById('editMetadataModal');
  if (!modal) {
    console.error('Modal element not found!');
    return;
  }
  
  modal.style.display = 'flex';
  
  // Add backdrop click handler ONLY to this modal
  modal.onclick = (e) => {
    if (e.target === modal) {
      closeEditModal();
    }
  };
  
  // Populate all fields
  populateEditModal(cluster, metadata);
}

/**
 * Populate the edit modal with data
 */
async function populateEditModal(cluster, metadata) {
  console.log('Populating edit modal with:', { cluster, metadata });
  
  // Thumbnail and filename
  const thumbnail = document.getElementById('modalThumbnail');
  const filename = document.getElementById('modalFilename');
  
  if (cluster.mainRep) {
    filename.textContent = cluster.mainRep.representativeFilename || 'Unknown';
    
    // Load thumbnail
    const result = await window.electronAPI.getPreviewImage(cluster.mainRep.representativePath);
    if (result.success) {
      thumbnail.src = result.dataUrl;
    }
  }
  
  // Basic fields
  document.getElementById('modalMetaTitle').value = metadata.title || '';
  document.getElementById('modalMetaDescription').value = metadata.description || '';
  document.getElementById('modalMetaCaption').value = metadata.caption || '';
  
  // GPS Coordinates - CRITICAL FIX
  const gps = cluster.mainRep?.gps || cluster.gps || metadata.gps;
  console.log('GPS data found:', gps);
  
  if (gps && gps.latitude && gps.longitude) {
    document.getElementById('modalGpsLat').value = gps.latitude;
    document.getElementById('modalGpsLon').value = gps.longitude;
  } else {
    document.getElementById('modalGpsLat').value = '';
    document.getElementById('modalGpsLon').value = '';
  }
  
  // Keywords
  populateModalKeywords(metadata.keywords || []);
  
  // Extended fields
  document.getElementById('modalMetaCategory').value = metadata.category || '';
  document.getElementById('modalMetaSceneType').value = metadata.sceneType || '';
  document.getElementById('modalMetaMood').value = metadata.mood || '';
  
  // Location fields
  document.getElementById('modalMetaCity').value = metadata.city || '';
  document.getElementById('modalMetaState').value = metadata.state || '';
  document.getElementById('modalMetaCountry').value = metadata.country || '';
  document.getElementById('modalMetaSpecificLocation').value = metadata.specificLocation || '';
  
  // Hashtags
  document.getElementById('modalMetaHashtags').value = metadata.hashtags || '';
}

/**
 * Populate keywords container
 */
function populateModalKeywords(keywords) {
  const container = document.getElementById('modalKeywordsContainer');
  container.innerHTML = '';
  
  if (!keywords || keywords.length === 0) {
    container.innerHTML = '<p style="color: #6c757d; font-size: 14px;">No keywords yet. Add some below.</p>';
    return;
  }
  
  keywords.forEach((keyword, index) => {
    const keywordDiv = document.createElement('div');
    keywordDiv.className = 'keyword-item';
    
    // Create delete button WITHOUT onclick
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'keyword-delete-btn';
    deleteBtn.textContent = '×';
    deleteBtn.addEventListener('click', () => removeModalKeyword(index));
    
    // Create editable text WITHOUT onblur inline
    const keywordText = document.createElement('span');
    keywordText.className = 'keyword-text';
    keywordText.contentEditable = true;
    keywordText.setAttribute('data-index', index);
    keywordText.textContent = keyword;
    keywordText.addEventListener('blur', function() {
      updateModalKeyword(index, this.textContent);
    });
    
    keywordDiv.appendChild(deleteBtn);
    keywordDiv.appendChild(keywordText);
    container.appendChild(keywordDiv);
  });
}

/**
 * Add new keyword
 */
function addModalKeyword() {
  const input = document.getElementById('modalNewKeywordInput');
  const keyword = input.value.trim();
  
  if (!keyword) return;
  
  // Get current keywords from metadata
  const metadata = analyzedClusters.get(currentEditingGroupIndex) || {};
  const keywords = metadata.keywords || [];
  
  // Add new keyword
  keywords.push(keyword);
  
  // Update metadata
  analyzedClusters.set(currentEditingGroupIndex, {
    ...metadata,
    keywords: keywords
  });
  
  // Refresh display
  populateModalKeywords(keywords);
  
  // Clear input
  input.value = '';
}

/**
 * Remove keyword
 */
function removeModalKeyword(index) {
  const metadata = analyzedClusters.get(currentEditingGroupIndex) || {};
  const keywords = metadata.keywords || [];
  
  keywords.splice(index, 1);
  
  analyzedClusters.set(currentEditingGroupIndex, {
    ...metadata,
    keywords: keywords
  });
  
  populateModalKeywords(keywords);
}

/**
 * Update keyword text
 */
function updateModalKeyword(index, newText) {
  const metadata = analyzedClusters.get(currentEditingGroupIndex) || {};
  const keywords = metadata.keywords || [];
  
  keywords[index] = newText.trim();
  
  analyzedClusters.set(currentEditingGroupIndex, {
    ...metadata,
    keywords: keywords
  });
}

/**
 * Close edit modal
 */
function closeEditModal() {
  const modal = document.getElementById('editMetadataModal');
  if (modal) {
    modal.style.display = 'none';
  }
  
  currentEditingCluster = null;
  currentEditingGroupIndex = null;
}

/**
 * Save metadata from modal
 */
function saveModalMetadata() {
  if (currentEditingGroupIndex === null) {
    console.error('No cluster index set');
    return;
  }
  
  // Get current metadata
  const currentMetadata = analyzedClusters.get(currentEditingGroupIndex) || {};
  
  // Collect all values from form
  const updatedMetadata = {
    ...currentMetadata,
    title: document.getElementById('modalMetaTitle').value.trim(),
    description: document.getElementById('modalMetaDescription').value.trim(),
    caption: document.getElementById('modalMetaCaption').value.trim(),
    category: document.getElementById('modalMetaCategory').value.trim(),
    sceneType: document.getElementById('modalMetaSceneType').value.trim(),
    mood: document.getElementById('modalMetaMood').value.trim(),
    city: document.getElementById('modalMetaCity').value.trim(),
    state: document.getElementById('modalMetaState').value.trim(),
    country: document.getElementById('modalMetaCountry').value.trim(),
    specificLocation: document.getElementById('modalMetaSpecificLocation').value.trim(),
    hashtags: document.getElementById('modalMetaHashtags').value.trim(),
    keywords: currentMetadata.keywords || [] // Keywords updated separately
  };
  
  // Handle GPS coordinates
  const lat = document.getElementById('modalGpsLat').value.trim();
  const lon = document.getElementById('modalGpsLon').value.trim();
  
  if (lat && lon) {
    updatedMetadata.gps = {
      latitude: parseFloat(lat),
      longitude: parseFloat(lon)
    };
  }
  
  // Save to analyzedClusters
  analyzedClusters.set(currentEditingGroupIndex, updatedMetadata);
  
  console.log('✅ Metadata saved:', updatedMetadata);
  
  // Refresh the card display
  const container = document.getElementById('clusterCardsContainer');
  renderCards(container);
  
  // Close modal
  closeEditModal();
  
  // Show success message
  showNotification('✅ Metadata updated successfully!');
}

// Backdrop click handling is now done in showMetadataEditor function

async function makeCard(cluster, metadata, index) {
  const card = document.createElement('div');
  card.className = 'cluster-card';
  
  const thumbnailPath = cluster.mainRep?.representativePath;
  let thumbnailSrc = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" fill="%23ccc"><rect width="200" height="150"/></svg>';
  
  if (thumbnailPath) {
    try {
      const result = await window.electronAPI.getPreviewImage(thumbnailPath);
      if (result.success) thumbnailSrc = result.dataUrl;
    } catch (e) {}
  }
  
  const filename = cluster.mainRep?.representativeFilename || 'Unknown';
  const title = metadata?.title || 'Untitled';
  const description = metadata?.description || 'No description';
  const caption = metadata?.caption || 'No caption';
  // Check all possible GPS locations - mainRep.gps is where it's stored!
  const gps = cluster.mainRep?.gps || metadata?.gps || cluster.gps || {};
  console.log('🗺️ makeCard GPS check:', {
    fromMainRep: cluster.mainRep?.gps,
    fromMetadata: metadata?.gps,
    fromCluster: cluster.gps,
    final: cluster.mainRep?.gps || metadata?.gps || cluster.gps
  });
  const lat = gps.latitude || 'N/A';
  const lon = gps.longitude || 'N/A';
  
  const escapeHtml = (text) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };
  
  card.innerHTML = `
    <div class="cluster-card-thumbnail">
      <img src="${thumbnailSrc}" alt="${filename}">
      <p>${filename}</p>
    </div>
    <div class="cluster-card-metadata">
      <div class="cluster-card-field">
        <label>Title:</label>
        <p>${escapeHtml(title)}</p>
      </div>
      <div class="cluster-card-field">
        <label>Description:</label>
        <p>${escapeHtml(description)}</p>
      </div>
      <div class="cluster-card-field">
        <label>Caption:</label>
        <p>${escapeHtml(caption)}</p>
      </div>
      <div class="cluster-card-field">
        <label>GPS:</label>
        <div class="cluster-card-gps">
          <span>LAT: ${lat} LON: ${lon}</span>
          ${gps.latitude ? `<a href="#" class="cluster-card-map-link" data-lat="${gps.latitude}" data-lon="${gps.longitude}">📍 View on Map</a>` : ''}
        </div>
      </div>
    </div>
    <div class="cluster-card-actions">
      <button class="cluster-card-edit-btn" data-cluster-id="${index}">Edit/Update</button>
    </div>
  `;
  
  return card;
}

function initializeAIAnalysisListeners() {
  const generateAllXMPBtn = document.getElementById('generateAllXMPBtn');
  if (generateAllXMPBtn) {
    generateAllXMPBtn.addEventListener('click', async () => {
      await handleGenerateAllXMP();
    });
    console.log('✅ Generate XMP button listener attached');
  }
}

// Add this new function to app.js:
async function handleGenerateAllXMP() {
  console.log('🚀 Starting batch XMP generation...');
  
  // Disable button during generation
  const generateBtn = document.getElementById('generateAllXMPBtn');
  if (generateBtn) {
    generateBtn.disabled = true;
    generateBtn.textContent = '⏳ Generating XMP Files...';
  }
  
  let totalFilesCreated = 0;
  let totalClustersProcessed = 0;
  let failedClusters = 0;
  
  try {
    // Loop through all analyzed clusters
    for (let i = 0; i < allClustersForAnalysis.length; i++) {
      // Only process clusters that have been analyzed
      if (!analyzedClusters.has(i)) {
        console.log(`⏭️  Skipping cluster ${i} (not analyzed)`);
        continue;
      }
      
      const cluster = allClustersForAnalysis[i];
      const metadata = analyzedClusters.get(i);
      
      console.log(`[${i+1}/${allClustersForAnalysis.length}] Generating XMP for:`, cluster.mainRep?.representativeFilename);
      
      try {
        // Call the XMP generation for this cluster
        const result = await window.electronAPI.generateXMPFiles({
          cluster: cluster,
          metadata: metadata
        });
        
        if (result.success) {
          totalFilesCreated += result.count || result.successCount || 0;
          totalClustersProcessed++;
          console.log(`✅ Generated ${result.count || result.successCount} XMP files`);
        } else {
          failedClusters++;
          console.error(`❌ Failed:`, result.error);
        }
      } catch (error) {
        failedClusters++;
        console.error(`❌ Error processing cluster:`, error);
      }
      
      // Update button text with progress
      if (generateBtn) {
        generateBtn.textContent = `⏳ Generating... (${totalClustersProcessed}/${analyzedClusters.size})`;
      }
    }
    
    // Success message
    console.log(`\n✅ BATCH COMPLETE:`);
    console.log(`   Clusters processed: ${totalClustersProcessed}`);
    console.log(`   Total XMP files created: ${totalFilesCreated}`);
    console.log(`   Failed: ${failedClusters}`);
    
    // Update button to show completion
    if (generateBtn) {
      generateBtn.disabled = false;
      generateBtn.style.background = 'linear-gradient(135deg, #28a745 0%, #20c997 100%)';
      generateBtn.innerHTML = `✅ ${totalFilesCreated} XMP files created`;
    }
    
    // Success notification removed - info is already displayed in UI
    
  } catch (error) {
    console.error('❌ Batch XMP generation failed:', error);
    
    // Reset button on error
    if (generateBtn) {
      generateBtn.disabled = false;
      generateBtn.textContent = '❌ Generation Failed';
      generateBtn.style.background = '#dc3545';
    }
    
    // Error notification removed - info is already displayed in UI
  }
}

// ============================================
// Personal Data Functions
// ============================================
    
/**
 * Load personal data from database
 */
    
async function loadPersonalData() {
  try {
    const result = await window.electronAPI.getPersonalData();
    if (result.success) {
      console.log('Personal data loaded:', result.data);
      // Update UI with personal data
      updatePersonalDataUI(result.data);
    } else {
      console.error('Failed to load personal data:', result.error);
    }
  } catch (error) {
    console.error('Error loading personal data:', error);
  }
}
/**
 * Update personal data UI
 */
function updatePersonalDataUI(data) {
  // Update UI elements with personal data
  console.log('Updating personal data UI:', data);
} 
// ============================================
// GPS DIAGNOSTIC FUNCTION
// ============================================

window.debugGPS = function() {
  console.log('🔍 GPS Debug Information:');
  console.log('window.processedClusters:', window.processedClusters);
  console.log('allProcessedImages:', allProcessedImages);
  
  if (window.processedClusters) {
    window.processedClusters.forEach((cluster, idx) => {
      console.log(`Cluster ${idx}:`, {
        representative: cluster.representative,
        representativePath: cluster.representativePath,
        gps: cluster.gps
      });
    });
  }
  
  if (allProcessedImages) {
    allProcessedImages.forEach((group, idx) => {
      console.log(`Group ${idx}:`, {
        mainRep: group.mainRep?.representativePath,
        gps: group.mainRep?.gps
      });
    });
  }
}

// ============================================
// Prompt Editor Functions
// ============================================
/**
 * Show prompt editor modal
 */
function showPromptEditor(clusterGroup) {
  console.log('Opening prompt editor for:', clusterGroup);
  
  // Set current cluster
  currentPromptCluster = clusterGroup;
  
  // Show modal
  const modal = document.getElementById('promptEditorModal');
  if (modal) {
    modal.style.display = 'block';
    
    // Update modal content
    const filename = clusterGroup.mainRep?.representativeFilename || 'Unknown';
    document.getElementById('promptEditorFilename').textContent = filename;
    
    // Generate or load prompt
    generateOrLoadPrompt(clusterGroup);
  }
}
/**
 * Generate or load prompt for cluster
 */
async function generateOrLoadPrompt(clusterGroup) {
  try {
    // Check if we have a custom prompt for this cluster
    const repPath = clusterGroup.mainRep?.representativePath;
    if (customPrompts.has(repPath)) {
      // Load existing custom prompt
      const textarea = document.getElementById('promptEditorTextarea');
      if (textarea) {
        textarea.value = customPrompts.get(repPath);
      }
      console.log('Loaded custom prompt for:', repPath);
    } else {
      // Generate default prompt
      const result = await window.electronAPI.generateDefaultPrompt(clusterGroup);
      if (result.success) {
        const textarea = document.getElementById('promptEditorTextarea');
        if (textarea) {
          textarea.value = result.prompt;
        }
        console.log('Generated default prompt for:', repPath);
      } else {
        console.error('Failed to generate prompt:', result.error);
        // Fallback to basic prompt
        const textarea = document.getElementById('promptEditorTextarea');
        if (textarea) {
          textarea.value = generateFallbackPrompt(clusterGroup);
        }
      }
    }
  } catch (error) {
    console.error('Error generating/loading prompt:', error);
    // Fallback to basic prompt
    const textarea = document.getElementById('promptEditorTextarea');
    if (textarea) {
      textarea.value = generateFallbackPrompt(clusterGroup);
    }
  }
}
/**
 * Generate fallback prompt
 */
function generateFallbackPrompt(clusterGroup) {
  const filename = clusterGroup.mainRep?.representativeFilename || 'Unknown';
  const keywords = clusterGroup.mainRep?.keywords || [];
  const gps = clusterGroup.mainRep?.gps;
  
  let prompt = `You are analyzing a photograph named "${filename}".\n\n`;
  
  if (keywords.length > 0) {
    prompt += `The image has these keywords: ${keywords.join(', ')}\n\n`;
  }
  
  if (gps && gps.latitude && gps.longitude) {
    prompt += `The image was taken at GPS coordinates: ${gps.latitude}, ${gps.longitude}\n\n`;
  }
  
  prompt += `Please analyze this image and provide detailed metadata including:\n`;
  prompt += `- A descriptive title (be specific and engaging)\n`;
  prompt += `- Relevant keywords and tags (5-10 keywords)\n`;
  prompt += `- Location information if identifiable from the image\n`;
  prompt += `- Subject matter description (what you see in the image)\n`;
  prompt += `- Technical details if relevant (lighting, composition, etc.)\n`;
  prompt += `- Any historical or cultural context if apparent\n\n`;
  prompt += `Format your response as JSON with these exact fields:\n`;
  prompt += `{\n`;
  prompt += `  "title": "Descriptive title here",\n`;
  prompt += `  "keywords": ["keyword1", "keyword2", "keyword3"],\n`;
  prompt += `  "location": "Location description or null",\n`;
  prompt += `  "description": "Detailed description of what you see",\n`;
  prompt += `  "technicalDetails": "Technical observations or null",\n`;
  prompt += `  "confidence": 0.85\n`;
  prompt += `}\n\n`;
  prompt += `Be thorough but concise. Focus on what would be most useful for organizing and finding this image later.`;
  
  return prompt;
}

/**
 * Save custom prompt
 */
function saveCustomPrompt() {
    
  if (!currentPromptCluster) {
    console.error('No current cluster for prompt editing');
    return;
  }
  
  const textarea = document.getElementById('promptEditorTextarea');
  if (!textarea) {
    console.error('Prompt textarea not found');
    return;
  }
  
  const prompt = textarea.value.trim();
  if (!prompt) {
    alert('Please enter a prompt');
    return;
  }
  
  // Save to custom prompts map
  const repPath = currentPromptCluster.mainRep?.representativePath;
  if (repPath) {
    customPrompts.set(repPath, prompt);
    console.log('Saved custom prompt for:', repPath);
    
    // Update button state
    updatePromptButtonState(repPath);
    
    // Close modal
    closePromptEditor();
    
    // Show success message
    showNotification('Custom prompt saved successfully!');
  } else {
    console.error('No representative path found for cluster');
  }
}
/**
 * Close prompt editor
 */
function closePromptEditor() {
  const modal = document.getElementById('promptEditorModal');
  if (modal) {
    modal.style.display = 'none';
  }
  
  // Clear current cluster
  currentPromptCluster = null;
}

/**
 * Update prompt button state
 */
function updatePromptButtonState(representativePath) {
  // Find all buttons with this representative path
  const buttons = document.querySelectorAll(`[data-cluster-path="${representativePath}"]`);
  buttons.forEach(button => {
    if (customPrompts.has(representativePath)) {
      button.innerHTML = button.innerHTML.replace('View/Edit Prompt', '✏️ Edit Prompt');
      button.classList.add('editing');
    } else {
      button.innerHTML = button.innerHTML.replace('✏️ Edit Prompt', 'View/Edit Prompt');
      button.classList.remove('editing');
    }
  });
}
/**
 * Show notification
 */
function showNotification(message) {
  // Create a simple notification
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #28a745;
    color: white;
    padding: 12px 20px;
    border-radius: 4px;
    z-index: 10000;
    font-size: 14px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
  `;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  // Remove after 3 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 3000);
}
// ============================================
// Application Ready
// ============================================
console.log('App.js fully loaded. Waiting for DOM...');
