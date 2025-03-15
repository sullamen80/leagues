// src/gameTypes/marchMadness/components/AdminSettingsPanels/AdminTeamsPanel.js
import React, { useState, useEffect, useRef } from 'react';
import { FaUpload, FaFileImport, FaFileExport, FaTrash } from 'react-icons/fa';

/**
 * Panel component for managing tournament teams
 */
const AdminTeamsPanel = ({
  data,
  onDataChange,
  isArchived,
  setFeedback,
  generateInitialRoundOf64,
  getEmptyTeamsData
}) => {
  const [teams, setTeams] = useState(data?.teamsData || getEmptyTeamsData());
  const fileInputRef = useRef(null);
  
  // Update teams state when data changes
  useEffect(() => {
    if (data?.teamsData) {
      setTeams(data.teamsData);
    }
  }, [data]);
  
  // Handle team name change
  const handleTeamChange = (region, index, value) => {
    if (isArchived) {
      setFeedback("This league is archived and cannot be edited.");
      return;
    }
    
    const updatedTeams = { ...teams };
    updatedTeams[region][index].name = value;
    setTeams(updatedTeams);
    
    // Update parent component data
    onDataChange({
      ...data,
      teamsData: updatedTeams,
      editMode: true
    });
  };
  
  // Handle importing teams from CSV
  const handleImportCSV = (event) => {
    if (isArchived) {
      setFeedback("This league is archived and cannot be edited.");
      return;
    }
    
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csvData = e.target.result;
        
        // Simple CSV parsing without papaparse
        const lines = csvData.split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        
        // Check for required headers
        if (!headers.includes('Region') || !headers.includes('Seed') || !headers.includes('TeamName')) {
          setFeedback("CSV format incorrect. Expected columns: Region,Seed,TeamName", true);
          return;
        }
        
        // Get column indexes
        const regionIdx = headers.indexOf('Region');
        const seedIdx = headers.indexOf('Seed');
        const teamNameIdx = headers.indexOf('TeamName');
        
        // Create new teams object
        const newTeams = getEmptyTeamsData();
        
        // Process data rows
        let errorFound = false;
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue; // Skip empty lines
          
          const values = lines[i].split(',').map(v => v.trim());
          if (values.length < 3) continue; // Skip incomplete rows
          
          const region = values[regionIdx].toLowerCase() + 'Region'; // eastRegion, westRegion, etc.
          const seed = parseInt(values[seedIdx]);
          const teamName = values[teamNameIdx];
          
          // Validate seed (1-16)
          if (isNaN(seed) || seed < 1 || seed > 16) {
            setFeedback(`Invalid seed: ${values[seedIdx]} in CSV. Must be 1-16.`, true);
            errorFound = true;
            break;
          }
          
          // Validate region
          if (!newTeams[region]) {
            setFeedback(`Invalid region: ${values[regionIdx]} in CSV. Must be East, West, Midwest, or South.`, true);
            errorFound = true;
            break;
          }
          
          // Update the team
          const index = seed - 1;
          newTeams[region][index].name = teamName;
        }
        
        if (!errorFound) {
          // Update state and parent
          setTeams(newTeams);
          onDataChange({
            ...data,
            teamsData: newTeams,
            editMode: true
          });
          
          setFeedback("Teams imported successfully!");
        }
      } catch (error) {
        setFeedback(`Error reading file: ${error.message}`, true);
      }
    };
    
    reader.readAsText(file);
    
    // Reset the file input
    event.target.value = '';
  };
  
  // Handle exporting teams to CSV
  const handleExportCSV = () => {
    try {
      // Create CSV content manually
      let csvContent = "Region,Seed,TeamName\n";
      
      // Process each region
      Object.entries(teams).forEach(([regionKey, regionTeams]) => {
        // Convert eastRegion to East, etc.
        const region = regionKey.replace('Region', '');
        const formattedRegion = region.charAt(0).toUpperCase() + region.slice(1);
        
        // Add each team to CSV
        regionTeams.forEach(team => {
          csvContent += `${formattedRegion},${team.seed},${team.name}\n`;
        });
      });
      
      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'tournament_teams.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setFeedback("Teams exported successfully!");
    } catch (error) {
      setFeedback(`Error exporting teams: ${error.message}`, true);
    }
  };
  
  // Handle clearing all teams
  const handleClearAllTeams = () => {
    if (isArchived) {
      setFeedback("This league is archived and cannot be edited.");
      return;
    }
    
    if (!window.confirm("Are you sure you want to clear all team names? This cannot be undone.")) {
      return;
    }
    
    const emptyTeams = getEmptyTeamsData();
    
    setTeams(emptyTeams);
    onDataChange({
      ...data,
      teamsData: emptyTeams,
      editMode: true
    });
    
    setFeedback("All team names have been cleared");
  };
  
  return (
    <div>
      <div className="flex flex-wrap justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Tournament Teams</h2>
        
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => fileInputRef.current.click()}
            disabled={isArchived}
            className="flex items-center px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FaFileImport className="mr-1" /> Import CSV
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleImportCSV}
            disabled={isArchived}
          />
          
          <button
            onClick={handleExportCSV}
            className="flex items-center px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition"
          >
            <FaFileExport className="mr-1" /> Export CSV
          </button>
          
          <button
            onClick={handleClearAllTeams}
            disabled={isArchived}
            className="flex items-center px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FaTrash className="mr-1" /> Clear All
          </button>
        </div>
      </div>
      
      <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded mb-4">
        <p>
          Enter the team names for each region and seed. You can import teams from a CSV file with Region,Seed,TeamName columns.
          Remember to save your changes when finished.
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* East Region */}
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-lg font-bold mb-3 text-blue-700">East Region</h3>
          <div className="space-y-2">
            {teams.eastRegion.map((team, index) => (
              <div key={`east-${index}`} className="flex items-center">
                <span className="w-8 text-center font-bold">{team.seed}</span>
                <input
                  type="text"
                  value={team.name}
                  onChange={(e) => handleTeamChange('eastRegion', index, e.target.value)}
                  placeholder={`Seed #${team.seed} team`}
                  className="flex-1 border rounded px-2 py-1 focus:ring-1 focus:ring-blue-500"
                  disabled={isArchived}
                />
              </div>
            ))}
          </div>
        </div>
        
        {/* West Region */}
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-lg font-bold mb-3 text-red-700">West Region</h3>
          <div className="space-y-2">
            {teams.westRegion.map((team, index) => (
              <div key={`west-${index}`} className="flex items-center">
                <span className="w-8 text-center font-bold">{team.seed}</span>
                <input
                  type="text"
                  value={team.name}
                  onChange={(e) => handleTeamChange('westRegion', index, e.target.value)}
                  placeholder={`Seed #${team.seed} team`}
                  className="flex-1 border rounded px-2 py-1 focus:ring-1 focus:ring-red-500"
                  disabled={isArchived}
                />
              </div>
            ))}
          </div>
        </div>
        
        {/* Midwest Region */}
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-lg font-bold mb-3 text-yellow-700">Midwest Region</h3>
          <div className="space-y-2">
            {teams.midwestRegion.map((team, index) => (
              <div key={`midwest-${index}`} className="flex items-center">
                <span className="w-8 text-center font-bold">{team.seed}</span>
                <input
                  type="text"
                  value={team.name}
                  onChange={(e) => handleTeamChange('midwestRegion', index, e.target.value)}
                  placeholder={`Seed #${team.seed} team`}
                  className="flex-1 border rounded px-2 py-1 focus:ring-1 focus:ring-yellow-500"
                  disabled={isArchived}
                />
              </div>
            ))}
          </div>
        </div>
        
        {/* South Region */}
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-lg font-bold mb-3 text-green-700">South Region</h3>
          <div className="space-y-2">
            {teams.southRegion.map((team, index) => (
              <div key={`south-${index}`} className="flex items-center">
                <span className="w-8 text-center font-bold">{team.seed}</span>
                <input
                  type="text"
                  value={team.name}
                  onChange={(e) => handleTeamChange('southRegion', index, e.target.value)}
                  placeholder={`Seed #${team.seed} team`}
                  className="flex-1 border rounded px-2 py-1 focus:ring-1 focus:ring-green-500"
                  disabled={isArchived}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminTeamsPanel;