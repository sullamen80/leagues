// src/pages/stats/utils/schemaAnalyzer.js

/**
 * Utility for analyzing data structures and determining appropriate visualizations
 */

/**
 * Analyzes data schema and detects appropriate visualization types
 * @param {Object|Array} data - The data to analyze
 * @returns {Object} Object containing visualization recommendations
 */
export const analyzeSchema = (data) => {
    if (!data) return { valid: false };
    
    const result = {
      valid: true,
      type: getDataType(data),
      structure: {},
      visualizations: []
    };
    
    // Analyze based on data type
    if (result.type === 'array') {
      result.structure = analyzeArrayStructure(data);
      result.visualizations = getArrayVisualizations(data, result.structure);
    } else if (result.type === 'object') {
      result.structure = analyzeObjectStructure(data);
      result.visualizations = getObjectVisualizations(data, result.structure);
    }
    
    return result;
  };
  
  /**
   * Determines the basic data type
   * @param {any} data - The data to analyze
   * @returns {string} The detected data type
   */
  const getDataType = (data) => {
    if (Array.isArray(data)) return 'array';
    if (data !== null && typeof data === 'object') return 'object';
    if (typeof data === 'number') return 'number';
    if (typeof data === 'string') return 'string';
    if (typeof data === 'boolean') return 'boolean';
    return 'unknown';
  };
  
  /**
   * Analyzes the structure of an array to identify patterns
   * @param {Array} data - The array to analyze
   * @returns {Object} Information about the array structure
   */
  const analyzeArrayStructure = (data) => {
    const result = {
      length: data.length,
      isEmpty: data.length === 0,
      isHomogeneous: true,
      itemTypes: new Set(),
      commonFields: null,
      fieldTypes: {},
    };
    
    if (result.isEmpty) return result;
    
    // Check first item type
    const firstItemType = getDataType(data[0]);
    result.itemTypes.add(firstItemType);
    
    // Check if all items are objects
    if (firstItemType === 'object') {
      // Initialize common fields with all fields from first object
      result.commonFields = new Set(Object.keys(data[0]));
      
      // Track field types from first object
      for (const [key, value] of Object.entries(data[0])) {
        result.fieldTypes[key] = getDataType(value);
      }
    }
    
    // Process the rest of the array
    for (let i = 1; i < data.length; i++) {
      const itemType = getDataType(data[i]);
      result.itemTypes.add(itemType);
      
      // If different types, mark as not homogeneous
      if (itemType !== firstItemType) {
        result.isHomogeneous = false;
      }
      
      // If objects, track common fields
      if (itemType === 'object' && result.commonFields) {
        const currentKeys = new Set(Object.keys(data[i]));
        
        // Update common fields (intersection)
        result.commonFields = new Set(
          [...result.commonFields].filter(key => currentKeys.has(key))
        );
        
        // Update field types
        for (const [key, value] of Object.entries(data[i])) {
          const valueType = getDataType(value);
          
          if (result.fieldTypes[key] && result.fieldTypes[key] !== valueType) {
            // If field type is inconsistent, mark as mixed
            result.fieldTypes[key] = 'mixed';
          } else if (!result.fieldTypes[key]) {
            // Add new field types
            result.fieldTypes[key] = valueType;
          }
        }
      }
    }
    
    // Convert commonFields set to array
    if (result.commonFields) {
      result.commonFields = Array.from(result.commonFields);
    }
    
    // Convert itemTypes set to array
    result.itemTypes = Array.from(result.itemTypes);
    
    return result;
  };
  
  /**
   * Analyzes the structure of an object to identify patterns
   * @param {Object} data - The object to analyze
   * @returns {Object} Information about the object structure
   */
  const analyzeObjectStructure = (data) => {
    const result = {
      isEmpty: Object.keys(data).length === 0,
      keyCount: Object.keys(data).length,
      valueTypes: {},
      nestedObjects: [],
      nestedArrays: [],
      primitiveFields: [],
      hasTimeSequence: false,
      hasCategoricalData: false,
      hasDistributionData: false
    };
    
    if (result.isEmpty) return result;
    
    // Analyze each key-value pair
    for (const [key, value] of Object.entries(data)) {
      const valueType = getDataType(value);
      result.valueTypes[key] = valueType;
      
      if (valueType === 'object') {
        result.nestedObjects.push(key);
        
        // Check if nested object keys follow a pattern (like years)
        if (!result.hasTimeSequence && isTimeSequence(key)) {
          result.hasTimeSequence = true;
        }
      } else if (valueType === 'array') {
        result.nestedArrays.push(key);
      } else {
        result.primitiveFields.push(key);
      }
    }
    
    // Additional checks for categorical data
    if (result.nestedObjects.length > 0) {
      // Sample a few objects to see if they have similar structure (categories)
      const sampleKeys = result.nestedObjects.slice(0, Math.min(5, result.nestedObjects.length));
      
      // Check if all sampled objects have similar structures
      let objectFields = null;
      let isConsistent = true;
      
      for (const key of sampleKeys) {
        const fields = Object.keys(data[key]);
        
        if (objectFields === null) {
          objectFields = new Set(fields);
        } else {
          const currentFields = new Set(fields);
          
          // Check if all previous fields are present in current object
          for (const field of objectFields) {
            if (!currentFields.has(field)) {
              isConsistent = false;
              break;
            }
          }
          
          if (!isConsistent) break;
        }
      }
      
      result.hasCategoricalData = isConsistent && objectFields !== null;
    }
    
    // Check for distribution data
    // Distribution data often has numeric values directly in the object
    const numericValues = Object.entries(data)
      .filter(([_, value]) => typeof value === 'number')
      .length;
    
    result.hasDistributionData = numericValues >= 3; // Arbitrary threshold
    
    return result;
  };
  
  /**
   * Check if a string could represent a date or time period
   * @param {string} key - The key to check
   * @returns {boolean} Whether key might represent time
   */
  const isTimeSequence = (key) => {
    // Check for year patterns
    if (/^(19|20)\d{2}$/.test(key)) return true;
    
    // Check for other time-related words
    const timeWords = ['year', 'month', 'day', 'quarter', 'period', 'week', 'season'];
    for (const word of timeWords) {
      if (key.toLowerCase().includes(word)) return true;
    }
    
    return false;
  };
  
  /**
   * Detect visualization types for an array of data
   * @param {Array} data - The array data
   * @param {Object} structure - The array structure analysis
   * @returns {Array} Recommended visualization types
   */
  const getArrayVisualizations = (data, structure) => {
    const visualizations = [];
    
    // Empty arrays can't be visualized
    if (structure.isEmpty) return visualizations;
    
    // For arrays of objects (most common case)
    if (structure.isHomogeneous && structure.itemTypes.includes('object')) {
      // Find potential category/name field for grouping
      const nameField = findNameField(structure.commonFields);
      
      // Find numeric fields for values
      const numericFields = Object.entries(structure.fieldTypes)
        .filter(([_, type]) => type === 'number')
        .map(([key]) => key);
      
      // Find percentage fields
      const percentageFields = numericFields.filter(field => 
        field.toLowerCase().includes('percent') || 
        field.toLowerCase().includes('rate') ||
        field.toLowerCase() === 'accuracy'
      );
      
      // Find date/time fields for sequences
      const timeFields = structure.commonFields.filter(field => 
        isTimeSequence(field) || 
        field.toLowerCase().includes('date') ||
        field.toLowerCase().includes('time')
      );
      
      // Recommend visualizations based on detected patterns
      
      // Leaderboard/table for sorted data
      visualizations.push({
        type: 'table',
        suitability: 0.9, // Tables almost always work for structured data
        fields: structure.commonFields,
        config: {
          primaryField: nameField,
          valueFields: numericFields
        }
      });
      
      // Bar chart if we have a category and values
      if (nameField && numericFields.length > 0) {
        visualizations.push({
          type: 'bar',
          suitability: 0.8,
          fields: [nameField, ...numericFields],
          config: {
            xAxis: nameField,
            series: numericFields.map(field => ({
              dataKey: field,
              name: field
            }))
          }
        });
      }
      
      // Line chart for time-based data
      if (timeFields.length > 0 && numericFields.length > 0) {
        visualizations.push({
          type: 'line',
          suitability: 0.85,
          fields: [timeFields[0], ...numericFields],
          config: {
            xAxis: timeFields[0],
            series: numericFields.map(field => ({
              dataKey: field,
              name: field
            }))
          }
        });
      }
      
      // Radar chart for multi-dimensional comparison
      if (nameField && numericFields.length >= 3 && numericFields.length <= 8) {
        visualizations.push({
          type: 'radar',
          suitability: 0.7,
          fields: [nameField, ...numericFields],
          config: {
            angleField: nameField,
            radiusField: numericFields
          }
        });
      }
      
      // Scatter plot for comparing two metrics
      if (numericFields.length >= 2) {
        visualizations.push({
          type: 'scatter',
          suitability: 0.6,
          fields: [numericFields[0], numericFields[1], nameField],
          config: {
            xField: numericFields[0],
            yField: numericFields[1],
            nameField: nameField
          }
        });
      }
    }
    // For arrays of primitives (less common)
    else if (structure.isHomogeneous && structure.itemTypes.includes('number')) {
      // Histogram for array of numbers
      visualizations.push({
        type: 'histogram',
        suitability: 0.8,
        config: {
          binCount: Math.min(10, Math.ceil(Math.sqrt(data.length)))
        }
      });
    }
    
    return visualizations;
  };
  
  /**
   * Detect visualization types for an object
   * @param {Object} data - The object data
   * @param {Object} structure - The object structure analysis
   * @returns {Array} Recommended visualization types
   */
  const getObjectVisualizations = (data, structure) => {
    const visualizations = [];
    
    // Empty objects can't be visualized
    if (structure.isEmpty) return visualizations;
    
    // Distribution data (pie chart)
    if (structure.hasDistributionData) {
      visualizations.push({
        type: 'pie',
        suitability: 0.9,
        config: {
          nameKey: 'name',
          dataKey: 'value',
          data: Object.entries(data)
            .filter(([_, value]) => typeof value === 'number')
            .map(([key, value]) => ({ 
              name: key, 
              value 
            }))
        }
      });
      
      // Also suggest bar chart for distribution
      visualizations.push({
        type: 'bar',
        suitability: 0.85,
        config: {
          data: Object.entries(data)
            .filter(([_, value]) => typeof value === 'number')
            .map(([key, value]) => ({ 
              name: key, 
              value 
            }))
        }
      });
    }
    
    // Categorical data (nested objects with similar structure)
    if (structure.hasCategoricalData) {
      // Find common fields across nested objects
      const categories = structure.nestedObjects;
      
      // Sample the first object to check its structure
      const firstCategory = data[categories[0]];
      const firstCategoryType = getDataType(firstCategory);
      
      if (firstCategoryType === 'object') {
        // Get metrics from the first object
        const metrics = Object.keys(firstCategory);
        const numericMetrics = Object.entries(firstCategory)
          .filter(([_, value]) => typeof value === 'number')
          .map(([key]) => key);
        
        if (numericMetrics.length > 0) {
          // Radar chart for comparing categories
          visualizations.push({
            type: 'radar',
            suitability: 0.8,
            config: {
              data: metrics.map(metric => {
                const point = { subject: metric };
                categories.forEach(category => {
                  if (data[category] && typeof data[category][metric] === 'number') {
                    point[category] = data[category][metric];
                  } else {
                    point[category] = 0;
                  }
                });
                return point;
              })
            }
          });
          
          // Bar chart for category comparison
          visualizations.push({
            type: 'bar',
            suitability: 0.75,
            config: {
              data: categories.map(category => {
                const item = { name: category };
                numericMetrics.forEach(metric => {
                  if (data[category] && typeof data[category][metric] === 'number') {
                    item[metric] = data[category][metric];
                  } else {
                    item[metric] = 0;
                  }
                });
                return item;
              }),
              metrics: numericMetrics
            }
          });
        }
      }
    }
    
    // Time series data
    if (structure.hasTimeSequence) {
      const timeKeys = structure.nestedObjects.filter(key => isTimeSequence(key));
      
      // Get a sample of time data
      if (timeKeys.length > 0) {
        const sampleTimeData = data[timeKeys[0]];
        
        if (typeof sampleTimeData === 'object') {
          const metrics = Object.keys(sampleTimeData).filter(
            key => typeof sampleTimeData[key] === 'number'
          );
          
          if (metrics.length > 0) {
            // Line chart for time series
            visualizations.push({
              type: 'line',
              suitability: 0.9,
              config: {
                data: timeKeys.map(timeKey => {
                  const item = { name: timeKey };
                  metrics.forEach(metric => {
                    if (data[timeKey] && typeof data[timeKey][metric] === 'number') {
                      item[metric] = data[timeKey][metric];
                    } else {
                      item[metric] = 0;
                    }
                  });
                  return item;
                }),
                xField: 'name',
                yField: metrics
              }
            });
          }
        }
      }
    }
    
    return visualizations;
  };
  
  /**
   * Find a field that could serve as a name/label in a dataset
   * @param {Array} fields - List of available fields
   * @returns {string|null} Best field to use as name, or null if none found
   */
  const findNameField = (fields) => {
    if (!fields || fields.length === 0) return null;
    
    // Common name field patterns
    const namePatterns = [
      'name', 'title', 'label', 'id', 'key',
      'userName', 'playerName', 'teamName', 'display'
    ];
    
    // Check for exact matches
    for (const pattern of namePatterns) {
      const match = fields.find(field => 
        field.toLowerCase() === pattern.toLowerCase()
      );
      if (match) return match;
    }
    
    // Check for partial matches
    for (const pattern of namePatterns) {
      const match = fields.find(field => 
        field.toLowerCase().includes(pattern.toLowerCase())
      );
      if (match) return match;
    }
    
    // Default to first field if no matches
    return fields[0];
  };
  
  /**
   * Get the most suitable visualization for a given data structure
   * @param {Object|Array} data - The data to visualize
   * @returns {Object|null} Best visualization configuration or null if none found
   */
  export const getBestVisualization = (data) => {
    const analysis = analyzeSchema(data);
    
    if (!analysis.valid || analysis.visualizations.length === 0) {
      return null;
    }
    
    // Sort by suitability score (descending)
    analysis.visualizations.sort((a, b) => b.suitability - a.suitability);
    
    // Return the best match
    return analysis.visualizations[0];
  };
  
  /**
   * Get multiple recommended visualizations for a dataset
   * @param {Object|Array} data - The data to visualize
   * @param {number} [limit=3] - Maximum number of recommendations
   * @returns {Array} Array of visualization configurations
   */
  export const getRecommendedVisualizations = (data, limit = 3) => {
    const analysis = analyzeSchema(data);
    
    if (!analysis.valid || analysis.visualizations.length === 0) {
      return [];
    }
    
    // Sort by suitability score (descending)
    analysis.visualizations.sort((a, b) => b.suitability - a.suitability);
    
    // Return the top recommendations
    return analysis.visualizations.slice(0, limit);
  };
  
  /**
   * Detect appropriate chart types for nested data within a complex structure
   * @param {Object} data - Complex data structure
   * @param {string} path - Dot-notation path to the nested data
   * @returns {Array} Recommended visualizations for the nested data
   */
  export const analyzeNestedData = (data, path) => {
    // Get nested data from path
    const nestedData = getNestedValue(data, path);
    if (!nestedData) return [];
    
    // Analyze the nested data
    return analyzeSchema(nestedData).visualizations;
  };
  
  /**
   * Get a nested value from an object using dot notation
   * @param {Object} obj - The object to extract from
   * @param {string} path - Dot notation path (e.g., "stats.rounds.firstRound")
   * @returns {any} The extracted value or undefined if not found
   */
  const getNestedValue = (obj, path) => {
    if (!obj || !path) return undefined;
    
    const keys = path.split('.');
    let result = obj;
    
    for (const key of keys) {
      if (result === null || result === undefined || typeof result !== 'object') {
        return undefined;
      }
      result = result[key];
    }
    
    return result;
  };
  
  export default {
    analyzeSchema,
    getBestVisualization,
    getRecommendedVisualizations,
    analyzeNestedData
  };