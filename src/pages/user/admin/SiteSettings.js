import React, { useState, useEffect } from 'react';
import { collection, doc, getDoc, updateDoc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { getAvailableGameTypes } from '../../../gameTypes';
import { 
  FaCog, 
  FaSpinner, 
  FaCheck, 
  FaExclamationCircle,
  FaSave,
  FaToggleOn,
  FaToggleOff,
  FaTrash,
  FaEdit,
  FaPlus
} from 'react-icons/fa';

const SiteSettings = () => {
  const [gameTypes, setGameTypes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [editingGameType, setEditingGameType] = useState(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    description: '',
    enabled: false,
    visible: true
  });

  // Load game types configuration
  useEffect(() => {
    const loadGameTypes = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Get game types from the system
        const availableGameTypes = getAvailableGameTypes();
        
        // Get current settings from Firestore
        const settingsRef = doc(db, 'settings', 'gameTypes');
        const settingsDoc = await getDoc(settingsRef);
        
        let gameTypeSettings = {};
        if (settingsDoc.exists()) {
          gameTypeSettings = settingsDoc.data().types || {};
        } else {
          // Create default settings if they don't exist
          const defaultSettings = {
            types: {}
          };
          
          availableGameTypes.forEach(type => {
            defaultSettings.types[type.id] = {
              enabled: type.enabled || false,
              visible: true, // Default to visible
              displayOrder: type.displayOrder || 0
            };
          });
          
          await setDoc(settingsRef, defaultSettings);
          gameTypeSettings = defaultSettings.types;
        }
        
        // Combine available game types with settings
        const gameTypesWithSettings = availableGameTypes.map(type => ({
          ...type,
          enabled: gameTypeSettings[type.id]?.enabled ?? type.enabled ?? false,
          visible: gameTypeSettings[type.id]?.visible ?? true,
          displayOrder: gameTypeSettings[type.id]?.displayOrder ?? type.displayOrder ?? 0
        }));
        
        // Sort by display order
        gameTypesWithSettings.sort((a, b) => a.displayOrder - b.displayOrder);
        
        setGameTypes(gameTypesWithSettings);
      } catch (err) {
        console.error('Error loading game types:', err);
        setError('Failed to load game type settings. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadGameTypes();
  }, []);
  
  // Toggle game type visibility
  const toggleGameTypeVisibility = (gameTypeId) => {
    setGameTypes(gameTypes.map(type => {
      if (type.id === gameTypeId) {
        return { ...type, visible: !type.visible };
      }
      return type;
    }));
  };
  
  // Toggle game type enabled status
  const toggleGameTypeEnabled = (gameTypeId) => {
    setGameTypes(gameTypes.map(type => {
      if (type.id === gameTypeId) {
        return { ...type, enabled: !type.enabled };
      }
      return type;
    }));
  };
  
  // Handle saving changes
  const handleSaveChanges = async () => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccess(null);
      
      // Prepare the settings data
      const settingsData = {
        types: {}
      };
      
      gameTypes.forEach((type, index) => {
        settingsData.types[type.id] = {
          enabled: type.enabled,
          visible: type.visible,
          displayOrder: index
        };
      });
      
      // Update settings in Firestore
      const settingsRef = doc(db, 'settings', 'gameTypes');
      await updateDoc(settingsRef, settingsData);
      
      setSuccess('Game type settings saved successfully');
      
      // Clear success message after a few seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err) {
      console.error('Error saving game type settings:', err);
      setError('Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };
  
  // Handle reordering game types
  const moveGameType = (index, direction) => {
    if (
      (direction === 'up' && index === 0) || 
      (direction === 'down' && index === gameTypes.length - 1)
    ) {
      return; // Can't move further in this direction
    }
    
    const newGameTypes = [...gameTypes];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    
    // Swap positions
    [newGameTypes[index], newGameTypes[newIndex]] = [newGameTypes[newIndex], newGameTypes[index]];
    
    setGameTypes(newGameTypes);
  };
  
  // Start editing game type settings
  const startEditingGameType = (gameType) => {
    setEditingGameType(gameType.id);
    setEditFormData({
      name: gameType.name,
      description: gameType.description,
      enabled: gameType.enabled,
      visible: gameType.visible
    });
  };
  
  // Save edited game type settings
  const saveGameTypeEdit = (gameTypeId) => {
    setGameTypes(gameTypes.map(type => {
      if (type.id === gameTypeId) {
        return { 
          ...type, 
          name: editFormData.name,
          description: editFormData.description,
          enabled: editFormData.enabled,
          visible: editFormData.visible
        };
      }
      return type;
    }));
    
    setEditingGameType(null);
  };
  
  // Cancel editing
  const cancelEditing = () => {
    setEditingGameType(null);
  };
  
  // Handle form input changes
  const handleEditFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditFormData({
      ...editFormData,
      [name]: type === 'checkbox' ? checked : value
    });
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-white">Site Settings</h2>
        <button
          onClick={handleSaveChanges}
          disabled={isSaving}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition disabled:opacity-50 flex items-center"
        >
          {isSaving ? (
            <>
              <FaSpinner className="animate-spin mr-2" />
              Saving...
            </>
          ) : (
            <>
              <FaSave className="mr-2" />
              Save Changes
            </>
          )}
        </button>
      </div>
      
      {/* Error and success messages */}
      {error && (
        <div className="p-4 bg-red-900/30 border border-red-700 text-red-300 rounded-lg flex items-center">
          <FaExclamationCircle className="mr-2 text-red-500 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      
      {success && (
        <div className="p-4 bg-green-900/30 border border-green-700 text-green-300 rounded-lg flex items-center">
          <FaCheck className="mr-2 text-green-500 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}
      
      {/* Game Types Settings */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <h3 className="text-lg font-semibold mb-4 text-white">Game Types Configuration</h3>
        <p className="text-gray-400 text-sm mb-6">
          Manage which game types are displayed on the dashboard and their order. Users will only see the enabled game types.
        </p>
        
        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <FaSpinner className="animate-spin text-2xl text-indigo-500" />
          </div>
        ) : (
          <div className="space-y-4">
            {gameTypes.length === 0 ? (
              <div className="text-center text-gray-400 py-6">
                No game types found. Add game types to your application to manage them here.
              </div>
            ) : (
              <div className="divide-y divide-gray-700">
                {gameTypes.map((gameType, index) => (
                  <div key={gameType.id} className="py-4 first:pt-0 last:pb-0">
                    {editingGameType === gameType.id ? (
                      <div className="bg-gray-700 p-4 rounded-lg space-y-3">
                        <div>
                          <label className="block text-gray-300 text-sm font-medium mb-1">
                            Game Type Name
                          </label>
                          <input
                            type="text"
                            name="name"
                            value={editFormData.name}
                            onChange={handleEditFormChange}
                            className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-white"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-gray-300 text-sm font-medium mb-1">
                            Description
                          </label>
                          <textarea
                            name="description"
                            value={editFormData.description}
                            onChange={handleEditFormChange}
                            rows="3"
                            className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-white"
                          ></textarea>
                        </div>
                        
                        <div className="flex flex-col space-y-2">
                          <label className="flex items-center text-gray-300 text-sm font-medium cursor-pointer">
                            <input
                              type="checkbox"
                              name="visible"
                              checked={editFormData.visible}
                              onChange={handleEditFormChange}
                              className="mr-2 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-500 rounded"
                            />
                            Show on Dashboard
                          </label>
                          
                          <label className="flex items-center text-gray-300 text-sm font-medium cursor-pointer">
                            <input
                              type="checkbox"
                              name="enabled"
                              checked={editFormData.enabled}
                              onChange={handleEditFormChange}
                              className="mr-2 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-500 rounded"
                              disabled={!editFormData.visible}
                            />
                            Enable as Available
                            {!editFormData.visible && (
                              <span className="ml-2 text-xs text-gray-400">(Must be visible to enable)</span>
                            )}
                          </label>
                        </div>
                        
                        <div className="flex justify-end space-x-3 pt-2">
                          <button
                            onClick={cancelEditing}
                            className="px-3 py-1.5 border border-gray-600 text-gray-300 rounded-md hover:bg-gray-700 transition"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => saveGameTypeEdit(gameType.id)}
                            className="px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center">
                            <h4 className="text-white font-medium mr-2">{gameType.name}</h4>
                            {gameType.visible ? (
                              gameType.enabled ? (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-green-900 text-green-300">
                                  Available
                                </span>
                              ) : (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-400">
                                  Coming Soon
                                </span>
                              )
                            ) : (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-red-900 text-red-300">
                                Hidden
                              </span>
                            )}
                          </div>
                          <p className="text-gray-400 text-sm mt-1">{gameType.description}</p>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => moveGameType(index, 'up')}
                            disabled={index === 0}
                            className="p-1.5 rounded-md hover:bg-gray-700 transition disabled:opacity-30 text-gray-400 hover:text-white"
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => moveGameType(index, 'down')}
                            disabled={index === gameTypes.length - 1}
                            className="p-1.5 rounded-md hover:bg-gray-700 transition disabled:opacity-30 text-gray-400 hover:text-white"
                          >
                            ↓
                          </button>
                          <button
                            onClick={() => toggleGameTypeVisibility(gameType.id)}
                            className={`p-1.5 rounded-md hover:bg-gray-700 transition ${
                              gameType.visible ? 'text-green-400' : 'text-red-400'
                            }`}
                            title={gameType.visible ? "Hide from dashboard" : "Show on dashboard"}
                          >
                            {gameType.visible ? <FaToggleOn size={18} /> : <FaToggleOff size={18} />}
                          </button>
                          {gameType.visible && (
                            <button
                              onClick={() => toggleGameTypeEnabled(gameType.id)}
                              className={`p-1.5 rounded-md hover:bg-gray-700 transition ${
                                gameType.enabled ? 'text-blue-400' : 'text-gray-400'
                              }`}
                              title={gameType.enabled ? "Set as Coming Soon" : "Set as Available"}
                            >
                              {gameType.enabled ? "✓" : "○"}
                            </button>
                          )}
                          <button
                            onClick={() => startEditingGameType(gameType)}
                            className="p-1.5 rounded-md hover:bg-gray-700 transition text-indigo-400 hover:text-indigo-300"
                          >
                            <FaEdit size={15} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Other Settings Sections */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <h3 className="text-lg font-semibold mb-4 text-white">General Settings</h3>
        <p className="text-gray-400 text-sm mb-6">
          Configure global site settings.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h4 className="text-white font-medium">Site Information</h4>
            
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-1">
                Site Name
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-white"
                placeholder="Leagues App"
                disabled={isSaving}
              />
            </div>
            
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-1">
                Contact Email
              </label>
              <input
                type="email"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-white"
                placeholder="support@example.com"
                disabled={isSaving}
              />
            </div>
          </div>
          
          <div className="space-y-3">
            <h4 className="text-white font-medium">Registration Settings</h4>
            
            <div className="flex items-center">
              <label className="flex items-center text-gray-300 text-sm font-medium cursor-pointer">
                <input
                  type="checkbox"
                  className="mr-2 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-500 rounded"
                  disabled={isSaving}
                />
                Allow New Registrations
              </label>
            </div>
            
            <div className="flex items-center">
              <label className="flex items-center text-gray-300 text-sm font-medium cursor-pointer">
                <input
                  type="checkbox"
                  className="mr-2 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-500 rounded"
                  disabled={isSaving}
                />
                Require Email Verification
              </label>
            </div>
            
            <div className="flex items-center">
              <label className="flex items-center text-gray-300 text-sm font-medium cursor-pointer">
                <input
                  type="checkbox"
                  className="mr-2 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-500 rounded"
                  disabled={isSaving}
                />
                Allow Social Logins
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SiteSettings;