// src/utils/formatters.js

/**
 * -----------------------------------------------
 * UI FORMATTING UTILITIES
 * -----------------------------------------------
 */

/**
 * Combines class names, filtering out falsy values
 * @param {...string} classes - Class names to combine
 * @returns {string} Combined class names
 */
export function classNames(...classes) {
    return classes.filter(Boolean).join(" ");
  }
  
  /**
   * -----------------------------------------------
   * USER FORMATTING UTILITIES
   * -----------------------------------------------
   */
  
  /**
   * Generates initials from a name or email
   * @param {string} name - Name or email to generate initials from
   * @returns {string} Initials (1-2 characters)
   */
  export function getInitials(name) {
    if (!name) return '?';
    
    // If it's an email, use the first character before the @ symbol
    if (name.includes('@')) {
      const firstPart = name.split('@')[0];
      return firstPart.charAt(0).toUpperCase();
    }
    
    // Otherwise, get initials from the name (up to 2 characters)
    const parts = name.split(' ').filter(part => part.length > 0);
    if (parts.length === 1) {
      return parts[0].charAt(0).toUpperCase();
    } else if (parts.length > 1) {
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    
    return '?';
  }
  
  /**
   * Retrieves the best display name from a user object
   * @param {Object} user - User object with potential name properties
   * @param {string} [defaultName='User'] - Default name if no user properties exist
   * @returns {string} The best available display name
   */
  export function getUserDisplayName(user, defaultName = 'User') {
    if (!user) return defaultName;
    
    return user.displayName || 
           user.username || 
           user.name ||
           (user.email ? user.email.split('@')[0] : defaultName);
  }
  
  /**
   * Generates a consistent color based on a string
   * @param {string} str - String to generate color from
   * @returns {string} HSL color string
   */
  export function generateColorFromString(str) {
    if (!str) return 'hsl(0, 0%, 85%)'; // Default gray for empty strings
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Convert to pastel color
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 70%, 80%)`;
  }
  
  /**
   * -----------------------------------------------
   * STRING FORMATTING UTILITIES
   * -----------------------------------------------
   */
  
  /**
   * Truncates text with ellipsis if it exceeds max length
   * @param {string} text - Text to truncate
   * @param {number} [maxLength=50] - Maximum length before truncation
   * @returns {string} Truncated text with ellipsis if needed
   */
  export function truncateText(text, maxLength = 50) {
    if (!text || text.length <= maxLength) return text || '';
    return `${text.substring(0, maxLength).trim()}...`;
  }
  
  /**
   * Capitalizes the first letter of each word in a string
   * @param {string} str - String to capitalize
   * @returns {string} String with first letter of each word capitalized
   */
  export function capitalize(str) {
    if (!str) return '';
    return str.replace(/\b\w/g, char => char.toUpperCase());
  }
  
  /**
   * -----------------------------------------------
   * DATE FORMATTING UTILITIES
   * -----------------------------------------------
   */
  
  /**
   * Formats a date string or object into a readable format
   * @param {string|Date} date - Date to format
   * @param {string} [format='medium'] - Format style ('short', 'medium', 'long')
   * @returns {string} Formatted date string
   */
  export function formatDate(date, format = 'medium') {
    if (!date) return '';
    
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    // Return empty string for invalid dates
    if (isNaN(dateObj.getTime())) return '';
    
    const options = { 
      short: { month: 'numeric', day: 'numeric', year: '2-digit' },
      medium: { month: 'short', day: 'numeric', year: 'numeric' },
      long: { month: 'long', day: 'numeric', year: 'numeric' }
    };
    
    return dateObj.toLocaleDateString('en-US', options[format] || options.medium);
  }
  
  /**
   * Formats a relative time (e.g., "2 hours ago")
   * @param {string|Date} date - Date to format
   * @returns {string} Relative time string
   */
  export function formatRelativeTime(date) {
    if (!date) return '';
    
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    // Return empty string for invalid dates
    if (isNaN(dateObj.getTime())) return '';
    
    const now = new Date();
    const diffMs = now - dateObj;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    
    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
    if (diffHour < 24) return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ago`;
    if (diffDay < 7) return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
    
    return formatDate(dateObj, 'medium');
  }
  
  /**
   * -----------------------------------------------
   * NUMBER FORMATTING UTILITIES
   * -----------------------------------------------
   */
  
  /**
   * Formats a number with commas as thousands separators
   * @param {number} num - Number to format
   * @returns {string} Formatted number string
   */
  export function formatNumber(num) {
    if (num === null || num === undefined) return '';
    return num.toLocaleString('en-US');
  }
  
  /**
   * Format grouped exports for convenience
   */
  export const stringFormatters = {
    truncateText,
    capitalize,
  };
  
  export const dateFormatters = {
    formatDate,
    formatRelativeTime,
  };
  
  export const userFormatters = {
    getInitials,
    getUserDisplayName,
    generateColorFromString,
  };
  
  export const numberFormatters = {
    formatNumber,
  };