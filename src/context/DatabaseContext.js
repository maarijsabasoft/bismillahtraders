import React, { createContext, useContext, useEffect, useState } from 'react';
import { initDatabase, getDatabase, saveDatabase } from '../utils/database';
import { initMongoDatabase, getMongoDatabase } from '../utils/database-mongodb';
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
          console.error('❌ MongoDB initialization failed. Please check MONGODB_URI environment variable.');
          alert('Database connection failed. Please check your MongoDB configuration.');
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

