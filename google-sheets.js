// google-sheets.js - Free Google Sheets Sync
const GoogleSheetsAPI = {
    // Your Google Apps Script Web App URL
    // Replace with: https://script.google.com/macros/s/AKfycbzgFkVLZ9pcgnXoWRxTsEpc7a-LUYcqFeYd3MpVkq8Ew-KHgSwIdb-dsNNlbR_vqwWd/exec
    API_URL: 'https://script.google.com/macros/s/AKfycbzgFkVLZ9pcgnXoWRxTsEpc7a-LUYcqFeYd3MpVkq8Ew-KHgSwIdb-dsNNlbR_vqwWd/exec',
    
    // Your Google Sheet ID
    SHEET_ID: '14OscNYrJwQJfo-YxSM-J5m-b-BWptXcNo5LM59tZ1DE',
    
    // Test connection
    async testConnection() {
        try {
            const response = await fetch(`${this.API_URL}?action=ping&sheet=Dopamine`, {
                method: 'GET',
                mode: 'no-cors'
            });
            return true;
        } catch (error) {
            console.log('Connection test (no-cors mode)');
            return true; // Assume connection works for no-cors
        }
    },
    
    // Simple API call
    async call(action, sheet, data = {}) {
        const url = `${this.API_URL}?action=${action}&sheet=${sheet}`;
        
        console.log(`Google Sheets API: ${action} -> ${sheet}`, data);
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            // With no-cors we can't read response, but we assume it worked
            console.log(`✅ ${action} request sent to ${sheet}`);
            
            // Store locally to sync later
            this.queueForSync(sheet, action, data);
            
            return { success: true, data: { id: data.id || Date.now().toString() } };
        } catch (error) {
            console.warn(`⚠️ ${action} failed (offline mode):`, error.message);
            
            // Queue for sync when online
            this.queueForSync(sheet, action, data);
            
            return { success: false, error: 'Offline - queued for sync' };
        }
    },
    
    // Queue for offline sync
    queueForSync(sheet, action, data) {
        const queue = JSON.parse(localStorage.getItem('googleSheetsQueue') || '[]');
        queue.push({
            sheet,
            action,
            data,
            timestamp: new Date().toISOString(),
            id: data.id || Date.now().toString() + Math.random().toString(36).substr(2, 9)
        });
        
        localStorage.setItem('googleSheetsQueue', JSON.stringify(queue));
        
        // Update queue badge
        this.updateQueueBadge(queue.length);
        
        console.log(`📝 Queued ${action} for ${sheet} (${queue.length} items in queue)`);
    },
    
    // Update queue badge in UI
    updateQueueBadge(count) {
        if (count > 0) {
            // Add badge to sync button
            const syncBtn = document.getElementById('syncButton');
            if (syncBtn) {
                syncBtn.innerHTML = `<i class="fas fa-sync-alt"></i><span class="queue-badge">${count}</span>`;
            }
        } else {
            const syncBtn = document.getElementById('syncButton');
            if (syncBtn) {
                syncBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
            }
        }
    },
    
    // Process offline queue
    async processQueue() {
        if (!navigator.onLine) {
            console.log('Offline - cannot process queue');
            return;
        }
        
        const queue = JSON.parse(localStorage.getItem('googleSheetsQueue') || '[]');
        if (queue.length === 0) return;
        
        console.log(`Processing ${queue.length} queued items...`);
        
        const failedItems = [];
        
        for (let i = 0; i < queue.length; i++) {
            const item = queue[i];
            try {
                // Try to send to Google Sheets
                const url = `${this.API_URL}?action=${item.action}&sheet=${item.sheet}`;
                
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(item.data)
                });
                
                if (response.ok) {
                    console.log(`✅ Synced: ${item.action} to ${item.sheet}`);
                    queue.splice(i, 1);
                    i--; // Adjust index after removal
                } else {
                    console.warn(`❌ Failed to sync: ${item.action} to ${item.sheet}`);
                    failedItems.push(item);
                }
                
                // Delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 500));
                
            } catch (error) {
                console.error(`Error syncing ${item.action}:`, error);
                failedItems.push(item);
            }
        }
        
        // Save back any failed items
        localStorage.setItem('googleSheetsQueue', JSON.stringify(failedItems));
        
        // Update badge
        this.updateQueueBadge(failedItems.length);
        
        if (failedItems.length === 0) {
            console.log('✅ All items synced successfully!');
        } else {
            console.log(`⚠️ ${failedItems.length} items failed to sync`);
        }
    },
    
    // CRUD operations
    async getAll(sheet) {
        try {
            const url = `${this.API_URL}?action=getAll&sheet=${sheet}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const result = await response.json();
            
            if (!result.success) {
                console.warn(`No data in ${sheet}, returning empty array`);
                return [];
            }
            
            return result.data || [];
        } catch (error) {
            console.warn(`Could not fetch ${sheet} from Google Sheets:`, error.message);
            return [];
        }
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
    async syncLocalToSheets(sheetName, localData) {
        if (!navigator.onLine) {
            console.log('Offline - cannot sync to sheets');
            return false;
        }
        
        try {
            // Get existing data from sheets
            const remoteData = await this.getAll(sheetName);
            
            // Find differences and sync
            const changes = this.findChanges(localData, remoteData);
            
            if (changes.length > 0) {
                console.log(`Syncing ${changes.length} changes to ${sheetName}`);
                
                for (const change of changes) {
                    await this.call(change.type, sheetName, change.data);
                    await new Promise(resolve => setTimeout(resolve, 300)); // Delay
                }
                
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Sync failed:', error);
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
    
    // Get queue count
    getQueueCount() {
        const queue = JSON.parse(localStorage.getItem('googleSheetsQueue') || '[]');
        return queue.length;
    },
    
    // Clear queue (for testing)
    clearQueue() {
        localStorage.removeItem('googleSheetsQueue');
        this.updateQueueBadge(0);
        console.log('Queue cleared');
    }
};

// Initialize queue badge on load
window.addEventListener('load', () => {
    const queueCount = GoogleSheetsAPI.getQueueCount();
    GoogleSheetsAPI.updateQueueBadge(queueCount);
});

// Auto-sync when coming online
window.addEventListener('online', () => {
    console.log('Online - processing queue...');
    GoogleSheetsAPI.processQueue();
    
    // Refresh app data from sheets
    if (window.LifeTrackerApp && typeof LifeTrackerApp.syncFromSheets === 'function') {
        setTimeout(() => {
            LifeTrackerApp.syncFromSheets();
        }, 2000);
    }
});

// Add queue badge CSS
const queueBadgeStyle = document.createElement('style');
queueBadgeStyle.textContent = `
    .queue-badge {
        position: absolute;
        top: -5px;
        right: -5px;
        background: #E1306C;
        color: white;
        border-radius: 50%;
        width: 18px;
        height: 18px;
        font-size: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
    }
    .settings-icon {
        position: relative;
    }
`;
document.head.appendChild(queueBadgeStyle);

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GoogleSheetsAPI;
}
