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
    
    console.log('Step 8: Scan results:', scanResults);
    console.log('Step 9: Summary:', summary);
    
    // Update UI with results
    displayScanResults(summary);
    populateResultsTableWithClusters(scanResults);
    
    updateStatus('Scan complete with timestamp clustering!', 'ready');
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
    cluster.images.forEach(imageName => {
      const badge = document.createElement('span');
      badge.className = 'child-image-item bracketed-badge';
      badge.textContent = imageName;
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
    
    const dbPathInput = document.getElementById('dbPath');
    if (settings.databasePath && dbPathInput) {
      dbPathInput.value = settings.databasePath;
    }
    
    const thresholdInput = document.getElementById('timestampThreshold');
    if (thresholdInput) {
      thresholdInput.value = settings.timestampThreshold || 5;
    }
    
    const ollamaEndpoint = document.getElementById('ollamaEndpoint');
    const ollamaModel = document.getElementById('ollamaModel');
    if (ollamaEndpoint) ollamaEndpoint.value = settings.ollamaEndpoint || 'http://localhost:11434';
    if (ollamaModel) ollamaModel.value = settings.ollamaModel || 'qwen2.5vl:latest';
    
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
// Application Ready
// ============================================
console.log('App.js fully loaded. Waiting for DOM...');
