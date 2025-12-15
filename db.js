// db.js - Enhanced IndexedDB setup with Google Sheets Sync
const db = new Dexie('LifeTrackerDB_Sheets');

db.version(10).stores({
    dopamineEntries: '++id, date, status, notes, createdAt, synced, googleId',
    hygieneHabits: '++id, name, description, order, createdAt, synced, googleId',
    hygieneCompletions: '++id, habitId, date, completed, createdAt, synced, googleId',
    moodEntries: '++id, date, mood, energy, numb, notes, createdAt, synced, googleId'
});

// Initialize with default data if empty
db.on('populate', async function(trans) {
    // Only populate if we're offline and have no data
    const hasHabits = await trans.table('hygieneHabits').count();
    
    if (hasHabits === 0) {
        await trans.table('hygieneHabits').bulkAdd([
            { 
                name: "Brush Teeth", 
                description: "Morning and evening routine", 
                order: 1, 
                createdAt: new Date(), 
                synced: false,
                googleId: null
            },
            { 
                name: "Face Wash", 
                description: "Cleanse and refresh your skin", 
                order: 2, 
                createdAt: new Date(), 
                synced: false,
                googleId: null
            },
            { 
                name: "Bath / Shower", 
                description: "Full body cleanse", 
                order: 3, 
                createdAt: new Date(), 
                synced: false,
                googleId: null
            },
            { 
                name: "Hair Care", 
                description: "Style and maintain hair", 
                order: 4, 
                createdAt: new Date(), 
                synced: false,
                googleId: null
            },
            { 
                name: "Perfume / Cologne", 
                description: "Apply your favorite scent", 
                order: 5, 
                createdAt: new Date(), 
                synced: false,
                googleId: null
            }
        ]);
    }
});

// Enhanced operations with Google Sheets sync
const EnhancedDB = {
    // Add with sync
    async addWithSync(table, data) {
        // Generate local ID
        const localId = await db[table].add({ 
            ...data, 
            synced: false,
            googleId: null,
            createdAt: new Date()
        });
        
        // Prepare data for Google Sheets
        const sheetData = { ...data };
        delete sheetData.id; // Let Google Sheets generate ID
        
        // Send to Google Sheets
        const sheetName = this.mapTableToSheet(table);
        const result = await GoogleSheetsAPI.add(sheetName, sheetData);
        
        if (result.success) {
            // Update local record with Google Sheets ID
            await db[table].update(localId, { 
                synced: true,
                googleId: result.data.id 
            });
        }
        
        return localId;
    },
    
    // Update with sync
    async updateWithSync(table, id, changes) {
        // Update local DB
        await db[table].update(id, { ...changes, synced: false });
        
        // Get record
        const record = await db[table].get(id);
        
        if (record.googleId) {
            // Update in Google Sheets
            const sheetName = this.mapTableToSheet(table);
            const updateData = { ...changes, id: record.googleId };
            await GoogleSheetsAPI.update(sheetName, updateData);
            
            // Mark as synced
            await db[table].update(id, { synced: true });
        } else {
            // No googleId yet, will sync when available
            console.log('No googleId yet, queuing for sync');
        }
    },
    
    // Delete with sync
    async deleteWithSync(table, id) {
        // Get record before deleting
        const record = await db[table].get(id);
        
        // Delete from local DB
        await db[table].delete(id);
        
        // Delete from Google Sheets if it was synced
        if (record.googleId) {
            const sheetName = this.mapTableToSheet(table);
            await GoogleSheetsAPI.delete(sheetName, record.googleId);
        }
    },
    
    // Sync all local data to Google Sheets
    async syncAllToSheets() {
        console.log('Syncing all local data to Google Sheets...');
        
        const tables = ['dopamineEntries', 'hygieneHabits', 'hygieneCompletions', 'moodEntries'];
        
        for (const table of tables) {
            const sheetName = this.mapTableToSheet(table);
            const localData = await db[table].toArray();
            
            // Filter out already synced items
            const unsyncedData = localData.filter(item => !item.synced);
            
            if (unsyncedData.length > 0) {
                console.log(`Syncing ${unsyncedData.length} items from ${table} to ${sheetName}`);
                
                for (const item of unsyncedData) {
                    try {
                        const sheetData = { ...item };
                        delete sheetData.id;
                        
                        const result = await GoogleSheetsAPI.add(sheetName, sheetData);
                        
                        if (result.success) {
                            await db[table].update(item.id, { 
                                synced: true,
                                googleId: result.data.id 
                            });
                        }
                    } catch (error) {
                        console.error(`Error syncing item from ${table}:`, error);
                    }
                }
            }
        }
        
        console.log('Sync complete!');
    },
    
    // Load from Google Sheets
    async loadFromSheets() {
        if (!navigator.onLine) {
            console.log('Offline - cannot load from Google Sheets');
            return false;
        }
        
        try {
            console.log('Loading data from Google Sheets...');
            
            const sheets = ['Dopamine', 'HygieneHabits', 'HygieneCompletions', 'Mood'];
            
            for (const sheet of sheets) {
                const table = this.mapSheetToTable(sheet);
                const remoteData = await GoogleSheetsAPI.getAll(sheet);
                
                if (remoteData.length > 0) {
                    // Clear existing data
                    await db[table].clear();
                    
                    // Add new data
                    for (const item of remoteData) {
                        await db[table].add({
                            ...item,
                            synced: true,
                            googleId: item.id,
                            createdAt: item.createdAt ? new Date(item.createdAt) : new Date()
                        });
                    }
                    
                    console.log(`Loaded ${remoteData.length} items from ${sheet}`);
                }
            }
            
            console.log('✅ Successfully loaded from Google Sheets');
            return true;
            
        } catch (error) {
            console.error('Failed to load from Google Sheets:', error);
            return false;
        }
    },
    
    // Map table names to sheet names
    mapTableToSheet(table) {
        const map = {
            'dopamineEntries': 'Dopamine',
            'hygieneHabits': 'HygieneHabits',
            'hygieneCompletions': 'HygieneCompletions',
            'moodEntries': 'Mood'
        };
        return map[table];
    },
    
    // Map sheet names to table names
    mapSheetToTable(sheet) {
        const map = {
            'Dopamine': 'dopamineEntries',
            'HygieneHabits': 'hygieneHabits',
            'HygieneCompletions': 'hygieneCompletions',
            'Mood': 'moodEntries'
        };
        return map[sheet];
    }
};

// Load from Google Sheets on startup if online
if (navigator.onLine) {
    setTimeout(() => {
        EnhancedDB.loadFromSheets().then(success => {
            if (success && window.LifeTrackerApp) {
                window.LifeTrackerApp.renderAllPages();
            }
        });
    }, 1000);
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { db, EnhancedDB };
}
