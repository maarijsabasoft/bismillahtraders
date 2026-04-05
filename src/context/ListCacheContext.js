import React, {
  createContext,
  useContext,
  useRef,
  useCallback,
  useEffect,
} from 'react';
import { useAuth } from './AuthContext';

const ListCacheContext = createContext(null);

export const useListCache = () => {
  const ctx = useContext(ListCacheContext);
  if (!ctx) {
    throw new Error('useListCache must be used within ListCacheProvider');
  }
  return ctx;
};

/**
 * Keeps last loaded list/stats in memory so switching React Router tabs shows data immediately
 * while useEffect refetches in the background.
 */
export const ListCacheProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const cacheRef = useRef({});
  const wasAuthed = useRef(isAuthenticated);

  useEffect(() => {
    if (wasAuthed.current && !isAuthenticated) {
      cacheRef.current = {};
    }
    wasAuthed.current = isAuthenticated;
  }, [isAuthenticated]);

  const readListCache = useCallback((key) => {
    const v = cacheRef.current[key];
    return v === undefined ? null : v;
  }, []);

  const writeListCache = useCallback((key, value) => {
    if (value === undefined || value === null) {
      delete cacheRef.current[key];
      return;
    }
    cacheRef.current[key] = value;
  }, []);

  const clearListCache = useCallback((key) => {
    if (key) {
      delete cacheRef.current[key];
    } else {
      cacheRef.current = {};
    }
  }, []);

  return (
    <ListCacheContext.Provider
      value={{ readListCache, writeListCache, clearListCache }}
    >
      {children}
    </ListCacheContext.Provider>
  );
};
