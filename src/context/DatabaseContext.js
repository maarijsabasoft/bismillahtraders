import React, { createContext, useContext, useEffect, useState } from 'react';
import { initDatabase, getDatabase, saveDatabase } from '../utils/database';
import { initMongoDatabase, getMongoDatabase } from '../utils/database-mongodb';
import { initHybridDatabase, getHybridDatabase } from '../utils/database-hybrid';
import { subscribeDataMutation } from '../utils/dataSync';

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

// Check if we should use Vercel database (MongoDB)
function shouldUseVercelDB() {
  if (typeof window === 'undefined') return false;
  
  // Force MongoDB if environment variable is set
  if (process.env.REACT_APP_USE_MONGODB === 'true') {
    return true;
  }
  
  // Check environment variable for any Vercel DB
  if (process.env.REACT_APP_USE_VERCEL_DB === 'true') {
    return true;
  }
  
  // Check hostname (works in production on Vercel)
  const hostname = window.location.hostname;
  if (hostname.includes('vercel.app') || 
      hostname.includes('vercel.com') ||
      hostname.includes('vercel.sh')) {
    return true;
  }
  
  return false;
}

export const DatabaseProvider = ({ children }) => {
  const [db, setDb] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [dbMode, setDbMode] = useState('local'); // 'local', 'vercel', or 'hybrid'
  /** Bumped on cross-tab mutations (Mongo) and when the tab becomes visible again — refetch lists/stats. */
  const [dataRevision, setDataRevision] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    let scheduled = false;
    const bump = () => {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        setDataRevision((n) => n + 1);
      });
    };
    window.addEventListener('bismillah-traders-db-changed', bump);
    const unsub = subscribeDataMutation(bump);
    return () => {
      window.removeEventListener('bismillah-traders-db-changed', bump);
      unsub();
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const hiddenAtRef = { current: null };
    const MIN_HIDDEN_MS = 45_000;
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        const hiddenAt = hiddenAtRef.current;
        hiddenAtRef.current = null;
        if (hiddenAt != null && Date.now() - hiddenAt >= MIN_HIDDEN_MS) {
          setDataRevision((n) => n + 1);
        }
      } else {
        hiddenAtRef.current = Date.now();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

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
        
        // FORCE MongoDB Atlas if on Vercel (web deployment) - NO FALLBACKS
        if (shouldUseVercelDB()) {
          const mongoDbInitialized = await initMongoDatabase();
          if (mongoDbInitialized) {
            const mongoDb = getMongoDatabase();
            if (mongoDb) {
              setDb(mongoDb);
              setIsReady(true);
              setDbMode('mongodb');
              console.log('✅ Using MongoDB Atlas database (fast, reliable, scalable)');
              return;
            }
          }
          
          // If MongoDB fails, show error instead of falling back
          console.error(
            '❌ MongoDB initialization failed. On Vercel, set MONGODB_URI (and optional MONGODB_DB_NAME) in Project → Settings → Environment Variables. Locally use `npm run dev:vercel` with MONGODB_URI in .env.'
          );
          alert('Database connection failed. Check server env MONGODB_URI and that the API (/api/db/mongodb) is reachable.');
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
    <DatabaseContext.Provider value={{ db, isReady, dbMode, dataRevision }}>
      {children}
    </DatabaseContext.Provider>
  );
};

