// src/gameTypes/marchMadness/components/LeagueSetup.js
import React, { useState, useRef } from 'react';
import { FaBasketballBall, FaUpload, FaDownload, FaInfoCircle } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

/**
 * Component for setting up a new March Madness league
 */
const LeagueSetup = ({ onCreateLeague, currentUser }) => {
  const [leagueName, setLeagueName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [teamsFile, setTeamsFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef(null);
  
  const navigate = useNavigate();
  
  // Validate form inputs
  const validateForm = () => {
    const newErrors = {};
    
    if (!leagueName.trim()) {
      newErrors.leagueName = 'League name is required';
    } else if (leagueName.length > 50) {
      newErrors.leagueName = 'League name must be 50 characters or less';
    }
    
    if (description && description.length > 500) {
      newErrors.description = 'Description must be 500 characters or less';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Parse teams file if provided
      let teamsData = null;
      
      if (teamsFile) {
        // ... file parsing code ...
      }
      
      // Prepare league data
      const leagueData = {
        title: leagueName.trim(),
        description: description.trim(),
        private: isPrivate,
        gameTypeId: 'marchMadness',
        createdBy: currentUser?.uid,
        createdAt: new Date().toISOString(),
        teamsData: teamsData // This will be null if no file was uploaded
      };
      
      console.log("LeagueSetup: Submitting data to onCreateLeague:", leagueData);
      
      // IMPORTANT: This is the key line that calls the function passed from LeagueSetupWrapper
      const result = await onCreateLeague(leagueData);
      
      console.log("LeagueSetup: Result from onCreateLeague:", result);
      
      if (result.success) {
        // The navigation should be handled by onCreateLeague
        console.log("LeagueSetup: Setup successful, awaiting navigation");
      } else {
        setErrors({
          ...errors,
          submit: result.error || 'Failed to create league'
        });
      }
    } catch (err) {
      console.error('Error creating league:', err);
      setErrors({
        ...errors,
        submit: err.message || 'An unexpected error occurred'
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Handle file selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    
    if (file) {
      if (!file.name.endsWith('.csv') && !file.name.endsWith('.json')) {
        setErrors({
          ...errors,
          teamsFile: 'Invalid file type. Please upload a CSV or JSON file.'
        });
        e.target.value = null;
        return;
      }
      
      setTeamsFile(file);
      setErrors({
        ...errors,
        teamsFile: null
      });
    }
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
    <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center mb-6">
        <div className="mr-4 bg-orange-100 p-3 rounded-full">
          <FaBasketballBall className="text-orange-500 text-2xl" />
        </div>
        <h1 className="text-2xl font-bold">Create March Madness League</h1>
      </div>
      
      {errors.submit && (
        <div className="mb-6 p-3 bg-red-100 text-red-800 rounded border border-red-200">
          {errors.submit}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        {/* Basic Info Section */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-4 pb-2 border-b">League Information</h2>
          
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="leagueName">
              League Name*
            </label>
            <input
              id="leagueName"
              type="text"
              value={leagueName}
              onChange={(e) => setLeagueName(e.target.value)}
              placeholder="e.g., Office March Madness 2025"
              className={`w-full px-3 py-2 border rounded-md ${
                errors.leagueName ? 'border-red-500' : 'border-gray-300'
              }`}
              maxLength="50"
            />
            {errors.leagueName && (
              <p className="text-red-500 text-xs mt-1">{errors.leagueName}</p>
            )}
          </div>
          
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="description">
              Description (Optional)
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell others what this league is about..."
              className={`w-full px-3 py-2 border rounded-md ${
                errors.description ? 'border-red-500' : 'border-gray-300'
              }`}
              rows="3"
              maxLength="500"
            />
            {errors.description && (
              <p className="text-red-500 text-xs mt-1">{errors.description}</p>
            )}
            <p className="text-gray-500 text-xs mt-1">
              {description.length}/500 characters
            </p>
          </div>
          
          <div className="mb-4">
            <div className="flex items-center">
              <input
                id="private"
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label className="ml-2 block text-gray-700 text-sm font-bold" htmlFor="private">
                Private League
              </label>
            </div>
            <p className="text-gray-500 text-xs mt-1 ml-6">
              Private leagues are only accessible by invitation
            </p>
          </div>
        </div>
        
        {/* Advanced Options Section */}
        <div className="mb-6">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center text-indigo-600 hover:text-indigo-800 text-sm font-medium focus:outline-none"
          >
            {showAdvanced ? '- Hide Advanced Options' : '+ Show Advanced Options'}
          </button>
          
          {showAdvanced && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
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
            </div>
          )}
        </div>
        
        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Creating League...' : 'Create League'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default LeagueSetup;