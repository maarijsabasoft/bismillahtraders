// Hybrid database wrapper for Electron with Vercel sync
// Allows Electron app to use Vercel database for live sync

import { initVercelDatabase, getVercelDatabase } from './database-vercel';
import { initDatabase, getDatabase } from './database';

// Check if running in Electron
function isElectron() {
  return typeof window !== 'undefined' && 
         window.require && 
         (window.require('electron') || window.process?.type === 'renderer');
}

// Check if Vercel sync is enabled
function isVercelSyncEnabled() {
  // Check environment variable or localStorage setting
  if (typeof window !== 'undefined') {
    const syncEnabled = localStorage.getItem('vercel_sync_enabled');
    if (syncEnabled === 'true') return true;
    if (syncEnabled === 'false') return false;
  }
  
  // Default: use environment variable
  return process.env.REACT_APP_ELECTRON_VERCEL_SYNC === 'true';
}

// Hybrid database wrapper that can switch between local and Vercel
class HybridDatabaseWrapper {
  constructor() {
    this.localDb = null;
    this.vercelDb = null;
    this.useVercel = false;
    this.isReady = false;
  }

  async init() {
    try {
      // Check if Vercel sync is enabled
      if (isVercelSyncEnabled()) {
        console.log('Electron: Vercel sync enabled - using cloud database');
        
        // Initialize Vercel database
        const vercelInitialized = await initVercelDatabase();
        if (vercelInitialized) {
          this.vercelDb = getVercelDatabase();
          if (this.vercelDb) {
            this.useVercel = true;
            this.isReady = true;
            console.log('Electron: Connected to Vercel database');
            return true;
          }
        }
        
        console.warn('Electron: Vercel database failed, falling back to local');
      }
      
      // Fallback to local database
      console.log('Electron: Using local database');
      await initDatabase();
      this.localDb = getDatabase();
      this.useVercel = false;
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

    const activeDb = this.useVercel ? this.vercelDb : this.localDb;
    
    if (!activeDb) {
      throw new Error('No database available');
    }

    return activeDb.prepare(sql);
  }

  // Get current database mode
  getMode() {
    return this.useVercel ? 'vercel' : 'local';
  }

  // Toggle between local and Vercel (requires re-initialization)
  async switchMode(useVercel) {
    if (useVercel === this.useVercel) return;
    
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

// Enable/disable Vercel sync in Electron
export const setVercelSync = (enabled) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('vercel_sync_enabled', enabled ? 'true' : 'false');
  }
};

export const getVercelSyncStatus = () => {
  return isVercelSyncEnabled();
};

