import React, { createContext, useContext, useEffect, useState } from 'react';
import { initDatabase, getDatabase, saveDatabase } from '../utils/database';
import { initVercelDatabase, getVercelDatabase } from '../utils/database-vercel';
import { initHybridDatabase, getHybridDatabase } from '../utils/database-hybrid';

const DatabaseContext = createContext();

export const useDatabase = () => {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error('useDatabase must be used within DatabaseProvider');
  }
  return context;
};

// Check if running in Electron
function isElectron() {
  return typeof window !== 'undefined' && 
         window.require && 
         (window.require('electron') || window.process?.type === 'renderer');
}

// Check if we should use Vercel database
function shouldUseVercelDB() {
  if (typeof window === 'undefined') return false;
  
  // Check environment variable or hostname
  return process.env.REACT_APP_USE_VERCEL_DB === 'true' ||
         window.location.hostname.includes('vercel.app') ||
         window.location.hostname.includes('vercel.com');
}

export const DatabaseProvider = ({ children }) => {
  const [db, setDb] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [dbMode, setDbMode] = useState('local'); // 'local', 'vercel', or 'hybrid'

  useEffect(() => {
    const setupDatabase = async () => {
      try {
        // Check if Electron with Vercel sync enabled
        if (isElectron()) {
          const hybridDb = await initHybridDatabase();
          if (hybridDb) {
            setDb(hybridDb);
            setIsReady(true);
            setDbMode(hybridDb.getMode());
            console.log(`Electron: Using ${hybridDb.getMode()} database`);
            
            // Expose saveDatabase globally for Electron app close handling
            if (typeof window !== 'undefined') {
              window.saveDatabase = saveDatabase;
            }
            return;
          }
        }
        
        // Try Vercel database first if on Vercel (web deployment)
        if (shouldUseVercelDB()) {
          const vercelDbInitialized = await initVercelDatabase();
          if (vercelDbInitialized) {
            const vercelDb = getVercelDatabase();
            if (vercelDb) {
              setDb(vercelDb);
              setIsReady(true);
              setDbMode('vercel');
              console.log('Using Vercel serverless database');
              return;
            }
          }
        }
        
        // Fallback to local database (Electron/IndexedDB)
        await initDatabase();
        const database = getDatabase();
        setDb(database);
        setIsReady(true);
        setDbMode('local');
        console.log('Using local database');
        
        // Expose saveDatabase globally for Electron app close handling
        if (typeof window !== 'undefined') {
          window.saveDatabase = saveDatabase;
        }
      } catch (error) {
        console.error('Database initialization error:', error);
      }
    };

    setupDatabase();
  }, []);

  // Auto-save database periodically and on page unload (only for local database)
  useEffect(() => {
    if (!isReady) return;
    if (shouldUseVercelDB()) return; // Vercel DB auto-saves on each operation

    // Save every 30 seconds
    const autoSaveInterval = setInterval(() => {
      saveDatabase().catch(err => console.error('Auto-save error:', err));
    }, 30000);

    // Save on page unload
    const handleBeforeUnload = () => {
      saveDatabase().catch(err => console.error('Save on unload error:', err));
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);

    return () => {
      clearInterval(autoSaveInterval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
      // Final save on cleanup
      saveDatabase().catch(err => console.error('Final save error:', err));
    };
  }, [isReady]);

  return (
    <DatabaseContext.Provider value={{ db, isReady, dbMode }}>
      {children}
    </DatabaseContext.Provider>
  );
};

