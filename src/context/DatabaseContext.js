import React, { createContext, useContext, useEffect, useState } from 'react';
import { initDatabase, getDatabase, saveDatabase } from '../utils/database';

const DatabaseContext = createContext();

export const useDatabase = () => {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error('useDatabase must be used within DatabaseProvider');
  }
  return context;
};

export const DatabaseProvider = ({ children }) => {
  const [db, setDb] = useState(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const setupDatabase = async () => {
      try {
        await initDatabase();
        const database = getDatabase();
        setDb(database);
        setIsReady(true);
        
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

  // Auto-save database periodically and on page unload
  useEffect(() => {
    if (!isReady) return;

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
    <DatabaseContext.Provider value={{ db, isReady }}>
      {children}
    </DatabaseContext.Provider>
  );
};

