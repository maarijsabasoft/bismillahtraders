// Hybrid database wrapper for Electron with MongoDB sync
// Allows Electron app to use MongoDB database for live sync

import { initMongoDatabase, getMongoDatabase } from './database-mongodb';
import { initDatabase, getDatabase } from './database';

// Check if running in Electron
function isElectron() {
  return typeof window !== 'undefined' && 
         window.require && 
         (window.require('electron') || window.process?.type === 'renderer');
}

// Check if MongoDB sync is enabled
function isMongoSyncEnabled() {
  // Check environment variable or localStorage setting
  if (typeof window !== 'undefined') {
    const syncEnabled = localStorage.getItem('mongodb_sync_enabled');
    if (syncEnabled === 'true') return true;
    if (syncEnabled === 'false') return false;
  }
  
  // Default: use environment variable
  return process.env.REACT_APP_ELECTRON_MONGODB_SYNC === 'true';
}

// Hybrid database wrapper that can switch between local and MongoDB
class HybridDatabaseWrapper {
  constructor() {
    this.localDb = null;
    this.mongoDb = null;
    this.useMongo = false;
    this.isReady = false;
  }

  async init() {
    try {
      // Check if MongoDB sync is enabled
      if (isMongoSyncEnabled()) {
        console.log('Electron: MongoDB sync enabled - using cloud database');
        
        // Initialize MongoDB database
        const mongoInitialized = await initMongoDatabase();
        if (mongoInitialized) {
          this.mongoDb = getMongoDatabase();
          if (this.mongoDb) {
            this.useMongo = true;
            this.isReady = true;
            console.log('Electron: Connected to MongoDB database');
            return true;
          }
        }
        
        console.warn('Electron: MongoDB database failed, falling back to local');
      }
      
      // Fallback to local database
      console.log('Electron: Using local database');
      await initDatabase();
      this.localDb = getDatabase();
      this.useMongo = false;
      this.isReady = true;
      return true;
    } catch (error) {
      console.error('Hybrid database initialization error:', error);
      return false;
    }
  }

  prepare(sql) {
    if (!this.isReady) {
      throw new Error('Database not initialized');
    }

    const activeDb = this.useMongo ? this.mongoDb : this.localDb;
    
    if (!activeDb) {
      throw new Error('No database available');
    }

    return activeDb.prepare(sql);
  }

  // Get current database mode
  getMode() {
    return this.useMongo ? 'mongodb' : 'local';
  }

  // Toggle between local and MongoDB (requires re-initialization)
  async switchMode(useMongo) {
    if (useMongo === this.useMongo) return;
    
    this.isReady = false;
    await this.init();
  }
}

let hybridDbWrapper = null;

export const initHybridDatabase = async () => {
  if (!isElectron()) {
    return null; // Only for Electron
  }

  hybridDbWrapper = new HybridDatabaseWrapper();
  await hybridDbWrapper.init();
  return hybridDbWrapper;
};

export const getHybridDatabase = () => {
  return hybridDbWrapper;
};

// Enable/disable MongoDB sync in Electron
export const setMongoSync = (enabled) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('mongodb_sync_enabled', enabled ? 'true' : 'false');
  }
};

export const getMongoSyncStatus = () => {
  return isMongoSyncEnabled();
};

