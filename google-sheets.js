// google-sheets.js - Fixed CORS Version
const GoogleSheetsAPI = {
    // Your NEW Web App URL from Apps Script (after redeploying)
    API_URL: 'AKfycbxROHb7Cbr4jad8heCW2lYlYxuqCXihYm-WNsA7rd0O6M1Lh4xS9-Emho8IXptvR7DN',
    
    SHEET_ID: '14OscNYrJwQJfo-YxSM-J5m-b-BWptXcNo5LM59tZ1DE',
    
    // Test connection
    async testConnection() {
        try {
            const url = `${this.API_URL}?action=ping&sheet=Dopamine`;
            console.log('Testing connection to:', url);
            
            const response = await fetch(url);
            if (response.ok) {
                const result = await response.json();
                return result.success === true;
            }
            return false;
        } catch (error) {
            console.log('Connection test failed:', error.message);
            return false;
        }
    },
    
    // Simple API call with CORS handling
    async call(action, sheet, data = {}) {
        const url = `${this.API_URL}?action=${action}&sheet=${sheet}`;
        
        console.log(`Google Sheets API: ${action} -> ${sheet}`, data);
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const result = await response.json();
            
            if (!result.success) {
                console.error('Sheets API error:', result.error);
                throw new Error(result.error || 'API call failed');
            }
            
            console.log(`✅ ${action} request successful to ${sheet}`);
            return result.data;
        } catch (error) {
            console.warn(`⚠️ ${action} failed:`, error.message);
            
            // Queue for offline sync
            this.queueForSync(sheet, action, data);
            
            // Return mock response for offline mode
            return { 
                success: false, 
                error: 'Offline - queued for sync',
                localId: 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
            };
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
            id: data.id || 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
        });
        
        localStorage.setItem('googleSheetsQueue', JSON.stringify(queue));
        this.updateQueueBadge(queue.length);
        
        console.log(`📝 Queued ${action} for ${sheet} (${queue.length} items in queue)`);
    },
    
    // Update queue badge in UI
    updateQueueBadge(count) {
        const syncBtn = document.getElementById('syncButton');
        if (!syncBtn) return;
        
        if (count > 0) {
            syncBtn.innerHTML = `<i class="fas fa-sync-alt"></i><span class="queue-badge">${count}</span>`;
        } else {
            syncBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
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
                const url = `${this.API_URL}?action=${item.action}&sheet=${item.sheet}`;
                
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(item.data)
                });
                
                if (response.ok) {
                    console.log(`✅ Synced: ${item.action} to ${item.sheet}`);
                    queue.splice(i, 1);
                    i--;
                } else {
                    console.warn(`❌ Failed to sync: ${item.action} to ${item.sheet}`);
                    failedItems.push(item);
                }
                
                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 300));
                
            } catch (error) {
                console.error(`Error syncing ${item.action}:`, error);
                failedItems.push(item);
            }
        }
        
        localStorage.setItem('googleSheetsQueue', JSON.stringify(failedItems));
        this.updateQueueBadge(failedItems.length);
        
        if (failedItems.length === 0) {
            console.log('✅ All items synced successfully!');
        } else {
            console.log(`⚠️ ${failedItems.length} items failed to sync`);
        }
    },
    
    // GET request for fetching data
    async getAll(sheet) {
        try {
            const url = `${this.API_URL}?action=getAll&sheet=${sheet}`;
            console.log('Fetching from:', url);
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
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
    
    // Get queue count
    getQueueCount() {
        const queue = JSON.parse(localStorage.getItem('googleSheetsQueue') || '[]');
        return queue.length;
    },
    
    // Clear queue
    clearQueue() {
        localStorage.removeItem('googleSheetsQueue');
        this.updateQueueBadge(0);
        console.log('Queue cleared');
    }
};

// Initialize queue badge on load
window.addEventListener('load', () => {
    setTimeout(() => {
        const queueCount = GoogleSheetsAPI.getQueueCount();
        GoogleSheetsAPI.updateQueueBadge(queueCount);
    }, 1000);
});

// Auto-sync when coming online
window.addEventListener('online', () => {
    console.log('Online - processing queue...');
    GoogleSheetsAPI.processQueue();
    
    // Refresh app data from sheets
    if (window.LifeTrackerApp && typeof LifeTrackerApp.syncFromSheets === 'function') {
        setTimeout(() => {
            LifeTrackerApp.syncFromSheets();
        }, 3000);
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
