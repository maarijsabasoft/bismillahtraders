// Utility functions for date formatting and handling

/**
 * Safely formats a date value to a localized date string
 * @param {string|Date} value - Date value (ISO string, Date object, or other)
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string or 'Invalid Date' if invalid
 */
export function formatDate(value, options = {}) {
  if (!value) return 'N/A';
  
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    return date.toLocaleDateString('en-US', options);
  } catch (error) {
    return 'Invalid Date';
  }
}

/**
 * Safely formats a date value to a localized date and time string
 * @param {string|Date} value - Date value
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date/time string or 'Invalid Date' if invalid
 */
export function formatDateTime(value, options = {}) {
  if (!value) return 'N/A';
  
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    return date.toLocaleString('en-US', options);
  } catch (error) {
    return 'Invalid Date';
  }
}

/**
 * Safely formats a date value to a localized time string
 * @param {string|Date} value - Date value
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted time string or 'Invalid Date' if invalid
 */
export function formatTime(value, options = {}) {
  if (!value) return 'N/A';
  
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    return date.toLocaleTimeString('en-US', options);
  } catch (error) {
    return 'Invalid Date';
  }
}

/**
 * Gets today's date in YYYY-MM-DD format
 * @returns {string} Today's date
 */
export function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Converts a date to YYYY-MM-DD format
 * @param {string|Date} value - Date value
 * @returns {string} Date in YYYY-MM-DD format
 */
export function toDateString(value) {
  if (!value) return '';
  
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return '';
    }
    return date.toISOString().split('T')[0];
  } catch (error) {
    return '';
  }
}

