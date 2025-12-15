// db.js - Enhanced IndexedDB setup with Dexie.js (No Workout Section)
const db = new Dexie('LifeTrackerDB');

db.version(8).stores({
    dopamineEntries: '++id, date, status, notes, createdAt',
    hygieneHabits: '++id, name, description, order, createdAt, category, difficulty, streak',
    hygieneCompletions: '++id, habitId, date, completed, createdAt, timeSpent',
    dailyCompletion: '++id, date, dopamineCompleted, hygieneCompleted, totalCompletion, createdAt',
    
    // Mood tracking
    moodEntries: '++id, date, mood, energy, numb, notes, createdAt'
});

// Initialize with default data
db.on('populate', function(trans) {
    return trans.table('hygieneHabits').bulkAdd([
        { name: "Brush Teeth", description: "Morning and evening routine", order: 1, createdAt: new Date(), category: "personal", difficulty: "easy", streak: 0 },
        { name: "Face Wash", description: "Cleanse and refresh your skin", order: 2, createdAt: new Date(), category: "personal", difficulty: "easy", streak: 0 },
        { name: "Bath / Shower", description: "Full body cleanse", order: 3, createdAt: new Date(), category: "personal", difficulty: "medium", streak: 0 },
        { name: "Hair Care", description: "Style and maintain hair", order: 4, createdAt: new Date(), category: "personal", difficulty: "easy", streak: 0 },
        { name: "Perfume / Cologne", description: "Apply your favorite scent", order: 5, createdAt: new Date(), category: "personal", difficulty: "easy", streak: 0 }
    ]);
});

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = db;
}
