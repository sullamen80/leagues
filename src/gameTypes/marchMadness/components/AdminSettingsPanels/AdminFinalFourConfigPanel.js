// src/gameTypes/marchMadness/components/AdminSettingsPanels/AdminFinalFourConfigPanel.js
import React, { useState, useEffect } from 'react';
import { FaSave, FaInfoCircle, FaExclamationTriangle } from 'react-icons/fa';

/**
 * Panel component for configuring Final Four matchups
 */
const AdminFinalFourConfigPanel = ({
  data,
  onDataChange,
  isArchived,
  setFeedback
}) => {
  // Default matchup configuration if none exists
  const defaultConfig = {
    semifinal1: {
      region1: 'South',
      region2: 'West'
    },
    semifinal2: {
      region1: 'Midwest',
      region2: 'East'
    }
  };

  // Initialize state with existing config or default
  const [finalFourConfig, setFinalFourConfig] = useState(
    data?.finalFourConfig || defaultConfig
  );
  
  // State to track validation warnings
  const [validationWarnings, setValidationWarnings] = useState({});

  // Update state when data changes
  useEffect(() => {
    if (data?.finalFourConfig) {
      setFinalFourConfig(data.finalFourConfig);
      validateConfiguration(data.finalFourConfig);
    }
  }, [data]);

  // Get currently selected regions
  const getSelectedRegions = (config) => {
    return [
      config.semifinal1.region1,
      config.semifinal1.region2,
      config.semifinal2.region1,
      config.semifinal2.region2
    ];
  };

  // Validate the entire configuration and set warnings
  const validateConfiguration = (config) => {
    const warnings = {};
    const regions = getSelectedRegions(config);
    
    // Check for same region within semifinal matches
    if (config.semifinal1.region1 === config.semifinal1.region2) {
      warnings.semifinal1 = "Same region selected in both positions";
    }
    
    if (config.semifinal2.region1 === config.semifinal2.region2) {
      warnings.semifinal2 = "Same region selected in both positions";
    }
    
    // Check for duplicate regions across all positions
    const uniqueRegions = new Set(regions);
    if (uniqueRegions.size < 4) {
      warnings.duplicates = "Some regions are used more than once";
      
      // Count occurrences of each region
      const counts = {};
      regions.forEach(region => {
        counts[region] = (counts[region] || 0) + 1;
      });
      
      // Mark positions with duplicates
      Object.entries(counts).forEach(([region, count]) => {
        if (count > 1) {
          if (config.semifinal1.region1 === region) warnings.sf1r1 = true;
          if (config.semifinal1.region2 === region) warnings.sf1r2 = true;
          if (config.semifinal2.region1 === region) warnings.sf2r1 = true;
          if (config.semifinal2.region2 === region) warnings.sf2r2 = true;
        }
      });
    }
    
    setValidationWarnings(warnings);
    return Object.keys(warnings).length === 0;
  };

  // Handle region selection changes
  const handleRegionChange = (semifinal, position, region) => {
    if (isArchived) {
      setFeedback("This league is archived and cannot be edited.");
      return;
    }

    // Create a copy of the current config
    const updatedConfig = { ...finalFourConfig };
    
    // Update the selected region
    updatedConfig[semifinal][position] = region;
    
    // Validate the new configuration
    const isValid = validateConfiguration(updatedConfig);
    
    // Update state regardless of validation result to allow admins to fix issues
    setFinalFourConfig(updatedConfig);
    
    // Show appropriate feedback based on validation
    if (!isValid) {
      // Warning about the issues but allow the change
      setFeedback("Warning: The current configuration has conflicts. Each region should appear exactly once.", true);
    } else {
      setFeedback("Final Four configuration updated!");
    }
    
    // Update parent component data
    onDataChange({
      ...data,
      finalFourConfig: updatedConfig,
      editMode: true
    });
  };

  // Available regions
  const regions = ['East', 'West', 'Midwest', 'South'];

  // Check if an option already exists in another dropdown
  const isDuplicate = (semifinal, position, region) => {
    // If it's the current selection, don't mark as duplicate
    if (finalFourConfig[semifinal][position] === region) {
      return false;
    }
    
    // Count occurrences in the current configuration
    const allSelected = getSelectedRegions(finalFourConfig);
    return allSelected.filter(r => r === region).length > 0;
  };

  // Check if a region selection would create a same-region matchup
  const wouldCreateSameRegionMatchup = (semifinal, position, region) => {
    const otherPosition = position === 'region1' ? 'region2' : 'region1';
    return finalFourConfig[semifinal][otherPosition] === region;
  };

  return (
    <div className="mt-8 mb-8">
      <div className="flex flex-wrap justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Final Four Configuration</h2>
        
        {Object.keys(validationWarnings).length > 0 && (
          <div className="flex items-center text-amber-600">
            <FaExclamationTriangle className="mr-2" />
            <span className="text-sm font-medium">Configuration has conflicts</span>
          </div>
        )}
      </div>
      
      <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded mb-4 flex items-start">
        <FaInfoCircle className="mt-1 mr-2 flex-shrink-0" />
        <p>
          Configure which regions play each other in the Final Four. 
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Semifinal 1 */}
        <div className={`bg-white border rounded-lg p-4 ${validationWarnings.semifinal1 ? 'border-amber-400' : ''}`}>
          <h3 className="text-lg font-bold mb-3 text-purple-700">Semifinal 1</h3>
          {validationWarnings.semifinal1 && (
            <div className="mb-3 text-amber-600 text-sm flex items-center">
              <FaExclamationTriangle className="mr-1" />
              <span>{validationWarnings.semifinal1}</span>
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">First Region</label>
              <div className="relative">
                <select
                  value={finalFourConfig.semifinal1.region1}
                  onChange={(e) => handleRegionChange('semifinal1', 'region1', e.target.value)}
                  className={`w-full border rounded px-3 py-2 focus:ring-1 focus:ring-blue-500 ${
                    validationWarnings.sf1r1 ? 'border-amber-400' : ''
                  }`}
                  disabled={isArchived}
                >
                  {regions.map(region => (
                    <option 
                      key={`sf1-r1-${region}`} 
                      value={region}
                    >
                      {region} {isDuplicate('semifinal1', 'region1', region) && '(Used elsewhere)'}
                    </option>
                  ))}
                </select>
                {wouldCreateSameRegionMatchup('semifinal1', 'region1', finalFourConfig.semifinal1.region1) && (
                  <div className="absolute right-2 top-2 text-amber-600"><FaExclamationTriangle /></div>
                )}
              </div>
            </div>
            <div className="text-center font-bold">vs.</div>
            <div>
              <label className="block text-sm font-medium mb-1">Second Region</label>
              <div className="relative">
                <select
                  value={finalFourConfig.semifinal1.region2}
                  onChange={(e) => handleRegionChange('semifinal1', 'region2', e.target.value)}
                  className={`w-full border rounded px-3 py-2 focus:ring-1 focus:ring-blue-500 ${
                    validationWarnings.sf1r2 ? 'border-amber-400' : ''
                  }`}
                  disabled={isArchived}
                >
                  {regions.map(region => (
                    <option 
                      key={`sf1-r2-${region}`} 
                      value={region}
                    >
                      {region} {isDuplicate('semifinal1', 'region2', region) && '(Used elsewhere)'}
                    </option>
                  ))}
                </select>
                {wouldCreateSameRegionMatchup('semifinal1', 'region2', finalFourConfig.semifinal1.region2) && (
                  <div className="absolute right-2 top-2 text-amber-600"><FaExclamationTriangle /></div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Semifinal 2 */}
        <div className={`bg-white border rounded-lg p-4 ${validationWarnings.semifinal2 ? 'border-amber-400' : ''}`}>
          <h3 className="text-lg font-bold mb-3 text-purple-700">Semifinal 2</h3>
          {validationWarnings.semifinal2 && (
            <div className="mb-3 text-amber-600 text-sm flex items-center">
              <FaExclamationTriangle className="mr-1" />
              <span>{validationWarnings.semifinal2}</span>
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">First Region</label>
              <div className="relative">
                <select
                  value={finalFourConfig.semifinal2.region1}
                  onChange={(e) => handleRegionChange('semifinal2', 'region1', e.target.value)}
                  className={`w-full border rounded px-3 py-2 focus:ring-1 focus:ring-blue-500 ${
                    validationWarnings.sf2r1 ? 'border-amber-400' : ''
                  }`}
                  disabled={isArchived}
                >
                  {regions.map(region => (
                    <option 
                      key={`sf2-r1-${region}`} 
                      value={region}
                    >
                      {region} {isDuplicate('semifinal2', 'region1', region) && '(Used elsewhere)'}
                    </option>
                  ))}
                </select>
                {wouldCreateSameRegionMatchup('semifinal2', 'region1', finalFourConfig.semifinal2.region1) && (
                  <div className="absolute right-2 top-2 text-amber-600"><FaExclamationTriangle /></div>
                )}
              </div>
            </div>
            <div className="text-center font-bold">vs.</div>
            <div>
              <label className="block text-sm font-medium mb-1">Second Region</label>
              <div className="relative">
                <select
                  value={finalFourConfig.semifinal2.region2}
                  onChange={(e) => handleRegionChange('semifinal2', 'region2', e.target.value)}
                  className={`w-full border rounded px-3 py-2 focus:ring-1 focus:ring-blue-500 ${
                    validationWarnings.sf2r2 ? 'border-amber-400' : ''
                  }`}
                  disabled={isArchived}
                >
                  {regions.map(region => (
                    <option 
                      key={`sf2-r2-${region}`} 
                      value={region}
                    >
                      {region} {isDuplicate('semifinal2', 'region2', region) && '(Used elsewhere)'}
                    </option>
                  ))}
                </select>
                {wouldCreateSameRegionMatchup('semifinal2', 'region2', finalFourConfig.semifinal2.region2) && (
                  <div className="absolute right-2 top-2 text-amber-600"><FaExclamationTriangle /></div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {validationWarnings.duplicates && (
        <div className="mt-4 mb-2 bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded flex items-start">
          <FaExclamationTriangle className="mt-1 mr-2 flex-shrink-0" />
          <p>
            This configuration has duplicate regions. For a valid tournament setup, each region should appear exactly once.
          </p>
        </div>
      )}
      
      <div className="flex justify-center mt-4">
        <div className="bg-white border rounded-lg p-4 w-full max-w-2xl">
          <h3 className="text-lg font-bold mb-3 text-center">Preview</h3>
          <div className="flex justify-center items-center">
            <div className="text-center p-3 border rounded bg-gray-50 w-32">
              <div className="font-bold text-blue-700">{finalFourConfig.semifinal1.region1}</div>
              <div className="text-xs text-gray-500">Regional Winner</div>
            </div>
            <div className="mx-2">vs.</div>
            <div className="text-center p-3 border rounded bg-gray-50 w-32">
              <div className="font-bold text-red-700">{finalFourConfig.semifinal1.region2}</div>
              <div className="text-xs text-gray-500">Regional Winner</div>
            </div>
          </div>
          
          <div className="text-center my-4 text-lg font-bold">and</div>
          
          <div className="flex justify-center items-center">
            <div className="text-center p-3 border rounded bg-gray-50 w-32">
              <div className="font-bold text-yellow-700">{finalFourConfig.semifinal2.region1}</div>
              <div className="text-xs text-gray-500">Regional Winner</div>
            </div>
            <div className="mx-2">vs.</div>
            <div className="text-center p-3 border rounded bg-gray-50 w-32">
              <div className="font-bold text-green-700">{finalFourConfig.semifinal2.region2}</div>
              <div className="text-xs text-gray-500">Regional Winner</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminFinalFourConfigPanel;