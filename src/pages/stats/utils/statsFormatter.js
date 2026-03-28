// src/pages/stats/utils/statsFormatter.js

/**
 * Utility functions for formatting statistical data
 */

/**
 * Format a number with appropriate precision for stats display
 * @param {number} value - The number to format
 * @param {Object} options - Formatting options
 * @param {number} [options.precision=1] - Number of decimal places
 * @param {boolean} [options.addCommas=true] - Whether to add thousand separators
 * @param {string} [options.fallback='-'] - Value to show if number is undefined/null
 * @returns {string} Formatted number
 */
export const formatStatNumber = (value, options = {}) => {
    const { 
      precision = 1, 
      addCommas = true,
      fallback = '-'
    } = options;
  
    if (value === undefined || value === null) {
      return fallback;
    }
  
    if (typeof value !== 'number') {
      return String(value);
    }
  
    // Format with specified precision
    const formatted = value.toFixed(precision);
    
    // Add thousand separators if requested
    if (addCommas) {
      const parts = formatted.split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return parts.join('.');
    }
    
    return formatted;
  };
  
  /**
   * Format a percentage for stats display
   * @param {number} value - Value between 0 and 1
   * @param {Object} options - Formatting options
   * @param {number} [options.precision=1] - Number of decimal places
   * @param {boolean} [options.includeSymbol=true] - Whether to include % symbol
   * @param {string} [options.fallback='-'] - Value to show if number is undefined/null
   * @returns {string} Formatted percentage
   */
  export const formatStatPercentage = (value, options = {}) => {
    const { 
      precision = 1, 
      includeSymbol = true,
      fallback = '-'
    } = options;
  
    if (value === undefined || value === null) {
      return fallback;
    }
  
    if (typeof value !== 'number') {
      return String(value);
    }
  
    // Convert to percentage and format
    const percentage = value * 100;
    const formatted = percentage.toFixed(precision);
    
    return includeSymbol ? `${formatted}%` : formatted;
  };
  
  /**
   * Format a rank with appropriate suffix
   * @param {number} rank - The rank number
   * @param {boolean} [abbreviated=false] - Whether to use abbreviated format (1st vs 1)
   * @returns {string} Formatted rank
   */
  export const formatRank = (rank, abbreviated = false) => {
    if (typeof rank !== 'number' || isNaN(rank)) {
      return '-';
    }
  
    if (!abbreviated) {
      return rank.toString();
    }
  
    // Determine the appropriate suffix
    let suffix = 'th';
    if (rank % 100 < 11 || rank % 100 > 13) {
      switch (rank % 10) {
        case 1:
          suffix = 'st';
          break;
        case 2:
          suffix = 'nd';
          break;
        case 3:
          suffix = 'rd';
          break;
      }
    }
  
    return `${rank}${suffix}`;
  };
  
  /**
   * Format a ratio (e.g., 7/10)
   * @param {number} numerator - The top number
   * @param {number} denominator - The bottom number
   * @param {Object} options - Formatting options
   * @param {boolean} [options.includePercentage=false] - Whether to append the percentage
   * @param {number} [options.precision=1] - Decimal precision for percentage
   * @returns {string} Formatted ratio
   */
  export const formatRatio = (numerator, denominator, options = {}) => {
    const { 
      includePercentage = false,
      precision = 1 
    } = options;
  
    if (typeof numerator !== 'number' || typeof denominator !== 'number') {
      return '-';
    }
  
    const ratio = `${numerator}/${denominator}`;
    
    if (includePercentage && denominator !== 0) {
      const percentage = (numerator / denominator) * 100;
      return `${ratio} (${percentage.toFixed(precision)}%)`;
    }
    
    return ratio;
  };
  
  /**
   * Format a win-loss record
   * @param {number} wins - Number of wins
   * @param {number} losses - Number of losses
   * @param {number} [ties] - Number of ties (optional)
   * @returns {string} Formatted record
   */
  export const formatRecord = (wins, losses, ties) => {
    if (typeof wins !== 'number' || typeof losses !== 'number') {
      return '-';
    }
  
    if (typeof ties === 'number' && ties > 0) {
      return `${wins}-${losses}-${ties}`;
    }
    
    return `${wins}-${losses}`;
  };
  
  /**
   * Format a score difference
   * @param {number} value - The difference value
   * @param {boolean} [includeSign=true] - Whether to include + sign for positive values
   * @returns {string} Formatted difference
   */
  export const formatDifference = (value, includeSign = true) => {
    if (typeof value !== 'number') {
      return '-';
    }
  
    if (value > 0 && includeSign) {
      return `+${value}`;
    }
    
    return value.toString();
  };
  
  /**
   * Generate a performance indicator based on a value
   * @param {number} value - The metric value
   * @param {Object} options - Options for evaluation
   * @param {number} [options.good=0.7] - Threshold for good performance
   * @param {number} [options.average=0.4] - Threshold for average performance
   * @param {boolean} [options.higherIsBetter=true] - Whether higher values indicate better performance
   * @returns {string} Performance indicator ('good', 'average', or 'poor')
   */
  export const getPerformanceIndicator = (value, options = {}) => {
    const { 
      good = 0.7, 
      average = 0.4, 
      higherIsBetter = true 
    } = options;
  
    if (typeof value !== 'number') {
      return 'unknown';
    }
  
    if (higherIsBetter) {
      if (value >= good) return 'good';
      if (value >= average) return 'average';
      return 'poor';
    } else {
      if (value <= good) return 'good';
      if (value <= average) return 'average';
      return 'poor';
    }
  };
  
  /**
   * Format a time duration in a human-readable way
   * @param {number} minutes - Duration in minutes
   * @returns {string} Formatted duration (e.g., "2h 30m" or "45m")
   */
  export const formatDuration = (minutes) => {
    if (typeof minutes !== 'number' || minutes < 0) {
      return '-';
    }
  
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.floor(minutes % 60);
    
    if (hours === 0) {
      return `${remainingMinutes}m`;
    }
    
    return `${hours}h ${remainingMinutes}m`;
  };
  
  /**
   * Format a value as a trend indicator
   * @param {number} current - Current value
   * @param {number} previous - Previous value
   * @param {Object} options - Options for evaluation
   * @param {boolean} [options.higherIsBetter=true] - Whether higher values indicate improvement
   * @param {number} [options.significantChange=0.05] - Threshold for significant change (as a ratio)
   * @returns {string} Trend indicator ('up', 'down', or 'stable')
   */
  export const getTrend = (current, previous, options = {}) => {
    const { 
      higherIsBetter = true, 
      significantChange = 0.05 
    } = options;
  
    if (typeof current !== 'number' || typeof previous !== 'number' || previous === 0) {
      return 'unknown';
    }
  
    const change = (current - previous) / previous;
    
    if (Math.abs(change) < significantChange) {
      return 'stable';
    }
    
    const isImprovement = higherIsBetter ? (change > 0) : (change < 0);
    return isImprovement ? 'up' : 'down';
  };
  
  /**
   * Format a score to highlight if it's a personal best
   * @param {number} score - The score value
   * @param {number} personalBest - Personal best score
   * @param {number} [threshold=0.9] - Threshold as percentage of personal best
   * @returns {Object} Formatted score and highlight status
   */
  export const formatWithPersonalBest = (score, personalBest, threshold = 0.9) => {
    if (typeof score !== 'number' || typeof personalBest !== 'number') {
      return { formatted: '-', isPersonalBest: false, isCloseToPersonalBest: false };
    }
  
    const formatted = formatStatNumber(score);
    const isPersonalBest = score >= personalBest;
    const isCloseToPersonalBest = !isPersonalBest && score >= (personalBest * threshold);
    
    return { formatted, isPersonalBest, isCloseToPersonalBest };
  };
  
  /**
   * Generate labels for chart data
   * @param {Object|Array} data - The data to generate labels for
   * @param {string} type - The type of label to generate (e.g., 'rounds', 'teams')
   * @returns {Array} Array of labels
   */
  export const generateLabels = (data, type) => {
    if (!data) return [];
    
    switch (type) {
      case 'rounds':
        // Special handling for rounds in tournament games
        if (Array.isArray(data)) {
          return data.map(item => item.name || `Round ${item.id || 'Unknown'}`);
        } else if (typeof data === 'object') {
          return Object.keys(data).map(key => {
            // Format round names for readability
            if (key === 'firstRound') return 'First Round';
            if (key === 'secondRound') return 'Second Round';
            if (key === 'semiFinals') return 'Semi-Finals';
            if (key === 'finals') return 'Finals';
            
            // Convert camelCase to Title Case
            return key.replace(/([A-Z])/g, ' $1')
              .replace(/^./, str => str.toUpperCase());
          });
        }
        return [];
        
      case 'gameTypes':
        // Format game type IDs to be more readable
        if (Array.isArray(data)) {
          return data.map(item => {
            const name = item.name || item.gameTypeId || item;
            return formatGameType(name);
          });
        } else if (typeof data === 'object') {
          return Object.keys(data).map(key => formatGameType(key));
        }
        return [];
        
      default:
        // For generic labels, just use the data directly
        if (Array.isArray(data)) {
          return data.map(item => item.name || item.label || item.toString());
        } else if (typeof data === 'object') {
          return Object.keys(data);
        }
        return [];
    }
  };
  
  /**
   * Format a game type ID to be more readable
   * @param {string} gameTypeId - The game type identifier
   * @returns {string} Human-readable game type
   */
  export const formatGameType = (gameTypeId) => {
    if (!gameTypeId) return 'Unknown';
    
    // Handle special cases
    switch (gameTypeId) {
      case 'nbaPlayoffs':
        return 'NBA Playoffs';
      case 'ncaaTournament':
        return 'NCAA Tournament';
      case 'nflPlayoffs':
        return 'NFL Playoffs';
      case 'worldCup':
        return 'World Cup';
      default:
        // Convert camelCase to Title Case
        return gameTypeId
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, str => str.toUpperCase());
    }
  };
  
  /**
   * Format stats data for comparison
   * @param {Array} datasets - Array of data points to compare
   * @param {Object} options - Comparison options
   * @param {string} [options.labelKey='name'] - Key to use for labels
   * @param {string} [options.valueKey='value'] - Key to use for values
   * @param {boolean} [options.includePercentage=true] - Whether to include percentage of total
   * @returns {Array} Formatted comparison data
   */
  export const formatComparison = (datasets, options = {}) => {
    const { 
      labelKey = 'name', 
      valueKey = 'value',
      includePercentage = true 
    } = options;
  
    if (!Array.isArray(datasets) || datasets.length === 0) {
      return [];
    }
  
    // Calculate total for percentage
    const total = includePercentage 
      ? datasets.reduce((sum, item) => sum + (typeof item[valueKey] === 'number' ? item[valueKey] : 0), 0)
      : 0;
    
    return datasets.map(item => {
      const result = {
        label: item[labelKey] || 'Unknown',
        value: typeof item[valueKey] === 'number' ? item[valueKey] : 0,
        formatted: formatStatNumber(item[valueKey])
      };
      
      if (includePercentage && total > 0) {
        result.percentage = result.value / total;
        result.formattedPercentage = formatStatPercentage(result.percentage);
      }
      
      return result;
    });
  };
  
  // Export all formatters
  export default {
    formatStatNumber,
    formatStatPercentage,
    formatRank,
    formatRatio,
    formatRecord,
    formatDifference,
    getPerformanceIndicator,
    formatDuration,
    getTrend,
    formatWithPersonalBest,
    generateLabels,
    formatGameType,
    formatComparison
  };