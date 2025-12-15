// sheets-sync.js - Free Google Sheets Sync
const SheetsSync = {
  // Your deployed Apps Script URL
  API_URL: 'YOUR_DEPLOYED_APPS_SCRIPT_URL_HERE',
  
  // Test connection
  async testConnection() {
    try {
      const response = await fetch(`${this.API_URL}?action=ping&sheet=Dopamine`);
      const data = await response.json();
      return data.success === true;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  },
  
  // Simple API call
  async call(action, sheet, data = {}) {
    const url = `${this.API_URL}?action=${action}&sheet=${sheet}`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      const result = await response.json();
      if (!result.success) {
        console.error('Sheets API error:', result.error);
        throw new Error(result.error || 'API call failed');
      }
      
      return result.data;
    } catch (error) {
      console.warn(`Sheets API (${action}) offline:`, error.message);
      throw error; // Re-throw for caller to handle
    }
  },
  
  // CRUD operations
  async getAll(sheet) {
    return this.call('getAll', sheet);
  },
  
  async add(sheet, data) {
    return this.call('add', sheet, data);
  },
  
  async update(sheet, data) {
    return this.call('update', sheet, data);
  },
  
  async delete(sheet, id) {
    return this.call('delete', sheet, { id });
  },
  
  // Sync local data to Google Sheets
  async syncToSheets(sheetName, localData) {
    if (!navigator.onLine) {
      console.log('Offline - queueing sync');
      this.queueSync(sheetName, localData);
      return false;
    }
    
    try {
      // Get existing data from sheets
      const remoteData = await this.getAll(sheetName);
      
      // Find differences
      const changes = this.findChanges(localData, remoteData);
      
      if (changes.length > 0) {
        await this.call('sync', sheetName, { changes });
        console.log(`Synced ${changes.length} changes to ${sheetName}`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Sync failed:', error);
      this.queueSync(sheetName, localData);
      return false;
    }
  },
  
  // Find differences between local and remote
  findChanges(localData, remoteData) {
    const changes = [];
    const remoteMap = new Map(remoteData.map(item => [item.id, item]));
    
    // Check for updates or new items
    localData.forEach(localItem => {
      const remoteItem = remoteMap.get(localItem.id);
      
      if (!remoteItem) {
        // New item
        changes.push({ type: 'add', data: localItem });
      } else if (this.hasChanges(localItem, remoteItem)) {
        // Updated item
        changes.push({ type: 'update', data: localItem });
      }
      
      remoteMap.delete(localItem.id);
    });
    
    // Items in remote but not local (deleted)
    remoteMap.forEach(remoteItem => {
      changes.push({ type: 'delete', data: { id: remoteItem.id } });
    });
    
    return changes;
  },
  
  hasChanges(item1, item2) {
    const keys = new Set([...Object.keys(item1), ...Object.keys(item2)]);
    
    for (let key of keys) {
      if (key === 'synced' || key === 'createdAt') continue;
      
      const val1 = item1[key];
      const val2 = item2[key];
      
      if (val1 !== val2) {
        return true;
      }
    }
    
    return false;
  },
  
  // Offline queue
  queueSync(sheetName, data) {
    const queue = JSON.parse(localStorage.getItem('syncQueue') || '{}');
    queue[sheetName] = data;
    localStorage.setItem('syncQueue', JSON.stringify(queue));
    console.log(`Queued ${sheetName} for later sync`);
  },
  
  // Process offline queue
  async processQueue() {
    if (!navigator.onLine) return;
    
    const queue = JSON.parse(localStorage.getItem('syncQueue') || '{}');
    const sheets = Object.keys(queue);
    
    for (const sheetName of sheets) {
      try {
        await this.syncToSheets(sheetName, queue[sheetName]);
        delete queue[sheetName];
      } catch (error) {
        console.error(`Failed to sync ${sheetName}:`, error);
      }
    }
    
    localStorage.setItem('syncQueue', JSON.stringify(queue));
  }
};

// Auto-sync when coming online
window.addEventListener('online', () => {
  console.log('Online - syncing...');
  SheetsSync.processQueue();
  
  // Refresh app data from sheets
  if (window.LifeTrackerApp && typeof LifeTrackerApp.syncFromSheets === 'function') {
    LifeTrackerApp.syncFromSheets();
  }
});

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SheetsSync;
}
