// src/gameTypes/marchMadness/components/LeagueSetup.js
import React, { useState, useRef } from 'react';
import { FaBasketballBall, FaUpload, FaDownload, FaInfoCircle } from 'react-icons/fa';
import BaseLeagueSetup from '../../common/components/BaseLeagueSetup';

/**
 * Component for setting up a new March Madness league
 * Extends BaseLeagueSetup with March Madness specific functionality
 */
const LeagueSetup = ({ onCreateLeague, currentUser }) => {
  const [teamsFile, setTeamsFile] = useState(null);
  const fileInputRef = useRef(null);
  const [advancedErrors, setAdvancedErrors] = useState({});
  
  // We'll handle the advanced options as a separate component
  const MarchMadnessAdvancedOptions = ({ errors, setErrors }) => {
    // Handle file selection
    const handleFileChange = (e) => {
      const file = e.target.files[0];
      
      if (file) {
        if (!file.name.endsWith('.csv') && !file.name.endsWith('.json')) {
          const newError = 'Invalid file type. Please upload a CSV or JSON file.';
          setErrors(prev => ({
            ...prev,
            teamsFile: newError
          }));
          setAdvancedErrors(prev => ({
            ...prev,
            teamsFile: newError
          }));
          e.target.value = null;
          return;
        }
        
        setTeamsFile(file);
        setErrors(prev => ({
          ...prev,
          teamsFile: null
        }));
        setAdvancedErrors(prev => ({
          ...prev,
          teamsFile: null
        }));
      }
    };
    
    // Generate template CSV file
    const handleGenerateTemplate = () => {
      const csvContent = [
        'Region,Seed,Name',
        'East,1,Team Name',
        'East,2,Team Name',
        'East,3,Team Name',
        'East,4,Team Name',
        'East,5,Team Name',
        'East,6,Team Name',
        'East,7,Team Name',
        'East,8,Team Name',
        'East,9,Team Name',
        'East,10,Team Name',
        'East,11,Team Name',
        'East,12,Team Name',
        'East,13,Team Name',
        'East,14,Team Name',
        'East,15,Team Name',
        'East,16,Team Name',
        'West,1,Team Name',
        'West,2,Team Name',
        'West,3,Team Name',
        'West,4,Team Name',
        'West,5,Team Name',
        'West,6,Team Name',
        'West,7,Team Name',
        'West,8,Team Name',
        'West,9,Team Name',
        'West,10,Team Name',
        'West,11,Team Name',
        'West,12,Team Name',
        'West,13,Team Name',
        'West,14,Team Name',
        'West,15,Team Name',
        'West,16,Team Name',
        'Midwest,1,Team Name',
        'Midwest,2,Team Name',
        'Midwest,3,Team Name',
        'Midwest,4,Team Name',
        'Midwest,5,Team Name',
        'Midwest,6,Team Name',
        'Midwest,7,Team Name',
        'Midwest,8,Team Name',
        'Midwest,9,Team Name',
        'Midwest,10,Team Name',
        'Midwest,11,Team Name',
        'Midwest,12,Team Name',
        'Midwest,13,Team Name',
        'Midwest,14,Team Name',
        'Midwest,15,Team Name',
        'Midwest,16,Team Name',
        'South,1,Team Name',
        'South,2,Team Name',
        'South,3,Team Name',
        'South,4,Team Name',
        'South,5,Team Name',
        'South,6,Team Name',
        'South,7,Team Name',
        'South,8,Team Name',
        'South,9,Team Name',
        'South,10,Team Name',
        'South,11,Team Name',
        'South,12,Team Name',
        'South,13,Team Name',
        'South,14,Team Name',
        'South,15,Team Name',
        'South,16,Team Name'
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'tournament_teams_template.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
    
    return (
      <>
        <h3 className="text-md font-semibold mb-4">Tournament Teams</h3>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Upload Teams (Optional)
          </label>
          
          <div className="mb-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".csv,.json"
              className="hidden"
            />
            
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
              >
                <FaUpload className="inline mr-2" /> Upload Teams
              </button>
              
              <button
                type="button"
                onClick={handleGenerateTemplate}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition"
              >
                <FaDownload className="inline mr-2" /> Download Template
              </button>
            </div>
          </div>
          
          {teamsFile && (
            <div className="bg-blue-50 text-blue-800 p-2 rounded text-sm">
              File selected: {teamsFile.name}
            </div>
          )}
          
          {errors.teamsFile && (
            <p className="text-red-500 text-xs mt-1">{errors.teamsFile}</p>
          )}
          
          <div className="mt-4 bg-blue-50 border border-blue-200 text-blue-700 p-3 rounded text-sm">
            <div className="flex items-start">
              <FaInfoCircle className="text-blue-500 mt-1 mr-2" />
              <div>
                <p className="font-bold">File Format Information:</p>
                <p className="mt-1">
                  The file should contain teams for all 4 regions (East, West, Midwest, South) with 16 seeds each.
                  You can use the provided template as a starting point.
                </p>
                <p className="mt-1">
                  If you don't upload teams now, you can add them later in the admin dashboard.
                </p>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  };
  
  // Game-specific validation function
  const validateGameSpecificFields = () => {
    // Return any advanced errors that have been set
    return advancedErrors;
  };
  
  // Read file content as text
  const readFileContent = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        resolve(event.target.result);
      };
      
      reader.onerror = (error) => {
        reject(error);
      };
      
      reader.readAsText(file);
    });
  };
  
  // Parse CSV file
  const parseCSV = (content) => {
    // Split content into lines and remove empty lines
    const lines = content.split('\n').filter(line => line.trim());
    
    // Check if we have a header row and data
    if (lines.length < 2) {
      throw new Error("CSV file must contain a header row and at least one data row.");
    }
    
    // Parse header row
    const header = lines[0].split(',').map(col => col.trim().toLowerCase());
    
    // Verify required columns exist
    const requiredColumns = ['region', 'seed', 'name'];
    const missingColumns = requiredColumns.filter(col => !header.includes(col));
    
    if (missingColumns.length > 0) {
      throw new Error(`CSV is missing required columns: ${missingColumns.join(', ')}`);
    }
    
    // Find column indices
    const regionIndex = header.indexOf('region');
    const seedIndex = header.indexOf('seed');
    const nameIndex = header.indexOf('name');
    
    // Parse data rows
    const teamsData = {
      eastRegion: Array(16).fill().map((_, i) => ({ name: "", seed: i + 1 })),
      westRegion: Array(16).fill().map((_, i) => ({ name: "", seed: i + 1 })),
      midwestRegion: Array(16).fill().map((_, i) => ({ name: "", seed: i + 1 })),
      southRegion: Array(16).fill().map((_, i) => ({ name: "", seed: i + 1 }))
    };
    
    // Process each data row
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(val => val.trim());
      
      if (values.length >= 3) {
        const region = values[regionIndex].toLowerCase();
        const seed = parseInt(values[seedIndex]);
        const seedIndex0Based = seed - 1; // Convert to 0-based index
        const teamName = values[nameIndex];
        
        // Validate seed
        if (isNaN(seed) || seed < 1 || seed > 16) {
          throw new Error(`Invalid seed value in row ${i+1}. Seed must be between 1 and 16.`);
        }
        
        // Map region name to property name
        let regionKey;
        if (region === 'east') regionKey = 'eastRegion';
        else if (region === 'west') regionKey = 'westRegion';
        else if (region === 'midwest') regionKey = 'midwestRegion';
        else if (region === 'south') regionKey = 'southRegion';
        else continue; // Skip invalid regions
        
        // Update team name and seed
        if (teamsData[regionKey] && teamsData[regionKey][seedIndex0Based]) {
          teamsData[regionKey][seedIndex0Based] = {
            name: teamName,
            seed: seed
          };
        }
      }
    }
    
    return teamsData;
  };
  
  // Parse JSON file
  const parseJSON = (content) => {
    try {
      const data = JSON.parse(content);
      
      // Initialize teams data structure
      const teamsData = {
        eastRegion: Array(16).fill().map((_, i) => ({ name: "", seed: i + 1 })),
        westRegion: Array(16).fill().map((_, i) => ({ name: "", seed: i + 1 })),
        midwestRegion: Array(16).fill().map((_, i) => ({ name: "", seed: i + 1 })),
        southRegion: Array(16).fill().map((_, i) => ({ name: "", seed: i + 1 }))
      };
      
      // Process each team in the JSON array
      if (Array.isArray(data)) {
        data.forEach(team => {
          if (team.region && team.seed && team.name) {
            const region = team.region.toLowerCase();
            const seed = parseInt(team.seed);
            const seedIndex0Based = seed - 1; // Convert to 0-based index
            
            // Validate seed
            if (isNaN(seed) || seed < 1 || seed > 16) {
              throw new Error(`Invalid seed value ${team.seed}. Seed must be between 1 and 16.`);
            }
            
            // Map region name to property name
            let regionKey;
            if (region === 'east') regionKey = 'eastRegion';
            else if (region === 'west') regionKey = 'westRegion';
            else if (region === 'midwest') regionKey = 'midwestRegion';
            else if (region === 'south') regionKey = 'southRegion';
            else return; // Skip invalid regions
            
            // Update team name and seed
            if (teamsData[regionKey] && teamsData[regionKey][seedIndex0Based]) {
              teamsData[regionKey][seedIndex0Based] = {
                name: team.name,
                seed: seed
              };
            }
          }
        });
      } else {
        throw new Error("JSON file must contain an array of team objects.");
      }
      
      return teamsData;
    } catch (error) {
      throw new Error(`Error parsing JSON: ${error.message}`);
    }
  };
  
  // Function to get game-specific data for submission
  const getGameSpecificData = async () => {
    if (!teamsFile) {
      return { teamsData: null };
    }
    
    try {
      const content = await readFileContent(teamsFile);
      let teamsData;
      
      if (teamsFile.name.endsWith('.csv')) {
        teamsData = parseCSV(content);
      } else if (teamsFile.name.endsWith('.json')) {
        teamsData = parseJSON(content);
      } else {
        throw new Error("Unsupported file type");
      }
      
      return { teamsData };
    } catch (err) {
      console.error("Error processing teams file:", err);
      setAdvancedErrors(prev => ({
        ...prev,
        teamsFile: `Error processing file: ${err.message}`
      }));
      return { teamsData: null };
    }
  };
  
  return (
    <BaseLeagueSetup
      onCreateLeague={onCreateLeague}
      currentUser={currentUser}
      GameIcon={FaBasketballBall}
      gameTypeId="marchMadness"
      gameTypeName="March Madness League"
      AdvancedOptions={MarchMadnessAdvancedOptions}
      validateGameSpecificFields={validateGameSpecificFields}
      getGameSpecificData={getGameSpecificData}
    />
  );
};

export default LeagueSetup;