import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../../firebase';
import { FaArrowLeft, FaTimes, FaEyeSlash } from 'react-icons/fa';
// Import our UI utilities
import { getColorClass } from '../../../styles/tokens/colors';
import { classNames } from '../../../utils/formatters';
import LoadingSpinner from '../../../components/ui/feedback/LoadingSpinner';

const BaseLeaderboard = ({
  isEmbedded = false,
  leagueId: propLeagueId,
  hideBackButton = false,
  entryType = 'Entry',
  fetchData,
  getVisibleEntries,
  handleViewEntry,
  handleViewPrimary,
  renderTableHeaders,
  renderTableRow,
  renderDetailsModal,
  renderStatusInfo,
  renderEmptyState,
  renderFogOfWarBanner,
  primaryEntryName = 'Official',
  customClasses = {},
  fogOfWarEnabled: propFogOfWarEnabled,
  tournamentCompleted: propTournamentCompleted 
}) => {
  const [leagueData, setLeagueData] = useState(null);
  const [referenceData, setReferenceData] = useState(null);
  const [entries, setEntries] = useState([]);
  const [visibleEntries, setVisibleEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [fogOfWarEnabled, setFogOfWarEnabled] = useState(propFogOfWarEnabled || false);
  const [isCompleted, setIsCompleted] = useState(propTournamentCompleted || false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [settings, setSettings] = useState(null);

  const params = useParams();
  const navigate = useNavigate();
  const leagueId = propLeagueId || params.leagueId;
  const userId = auth.currentUser?.uid;

  useEffect(() => {
    if (!leagueId) {
      setError("League ID is required");
      setIsLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        setIsLoading(true);

        const leagueRef = doc(db, "leagues", leagueId);
        const leagueSnap = await getDoc(leagueRef);

        if (!leagueSnap.exists()) {
          setError("League not found");
          setIsLoading(false);
          return;
        }

        const leagueData = leagueSnap.data();
        setLeagueData(leagueData);
        setIsAdmin(leagueData.ownerId === userId);

        // Use propFogOfWarEnabled if provided, otherwise fetch
        if (propFogOfWarEnabled === undefined) {
          try {
            const visibilityRef = doc(db, "leagues", leagueId, "settings", "visibility");
            const visibilitySnap = await getDoc(visibilityRef);
            if (visibilitySnap.exists()) {
              setFogOfWarEnabled(visibilitySnap.data().fogOfWarEnabled || false);
            }
          } catch (err) {
            console.error("Error loading visibility settings:", err);
          }
        } else {
          setFogOfWarEnabled(propFogOfWarEnabled);
        }

        const { 
          entries = [], 
          referenceData, 
          isCompleted: fetchedIsCompleted,
          settings 
        } = await fetchData(leagueId, userId);

        setEntries(entries);
        setReferenceData(referenceData);
        setIsCompleted(propTournamentCompleted !== undefined ? propTournamentCompleted : fetchedIsCompleted);
        setSettings(settings);

        const visible = getVisibleEntries ? 
          getVisibleEntries(entries, fogOfWarEnabled, propTournamentCompleted !== undefined ? propTournamentCompleted : fetchedIsCompleted, isAdmin, userId) : 
          entries;

        setVisibleEntries(visible);
        setIsLoading(false);
      } catch (err) {
        console.error("Error loading leaderboard data:", err);
        setError("Failed to load leaderboard data. Please try again.");
        setIsLoading(false);
      }
    };

    loadData();
  }, [leagueId, userId, fetchData, getVisibleEntries, propFogOfWarEnabled, propTournamentCompleted]);

  const handleShowDetails = (entry) => {
    setSelectedEntry(entry);
    setShowDetailsModal(true);
  };

  const onViewEntry = (entryId) => {
    if (handleViewEntry) {
      handleViewEntry(entryId, isEmbedded, navigate, leagueId);
    }
  };

  const onViewPrimary = () => {
    if (handleViewPrimary) {
      handleViewPrimary(isEmbedded, navigate, leagueId);
    }
  };

  const handleBack = () => {
    navigate(`/league/${leagueId}`);
  };

  if (isLoading) {
    return (
      <div className={customClasses.loadingContainer || "flex flex-col items-center justify-center p-8"}>
        <LoadingSpinner size="md" />
        <p className={customClasses.loadingText || classNames(getColorClass('text', 'secondary'))}>
          Loading leaderboard...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={customClasses.errorContainer || "max-w-7xl mx-auto p-4 md:p-6 bg-white rounded-lg shadow-md"}>
        {!isEmbedded && !hideBackButton && (
          <div className={customClasses.backButtonContainer || "flex items-center mb-6"}>
            <button
              onClick={handleBack}
              className={customClasses.backButton || classNames(
                "flex items-center",
                getColorClass('text', 'secondary'),
                `hover:${getColorClass('primary', '600', 'text')}`,
                "transition"
              )}
            >
              <FaArrowLeft className="mr-2" /> Back to Dashboard
            </button>
          </div>
        )}
        <div className={customClasses.errorAlert || classNames(
          getColorClass('red', 'light', 'bg'),
          'border',
          getColorClass('red', 'main', 'border'),
          getColorClass('red', 'dark', 'text'),
          'px-4 py-3 rounded mb-4'
        )}>
          <p className="font-bold">Error</p>
          <p>{error}</p>
          {isEmbedded && (
            <button
              onClick={() => window.location.reload()}
              className={customClasses.retryButton || classNames(
                "mt-2 px-4 py-2",
                getColorClass('red', 'main', 'bg'),
                `hover:${getColorClass('red', 'dark', 'bg')}`,
                "text-white rounded transition"
              )}
            >
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return renderEmptyState ? 
      renderEmptyState(handleBack, onViewPrimary, isEmbedded, hideBackButton, entryType) : (
        <div className={customClasses.emptyContainer || "max-w-7xl mx-auto p-4 md:p-6 bg-white rounded-lg shadow-md"}>
          {!isEmbedded && !hideBackButton && (
            <div className={customClasses.backButtonContainer || "flex items-center mb-6"}>
              <button
                onClick={handleBack}
                className={customClasses.backButton || classNames(
                  "flex items-center",
                  getColorClass('text', 'secondary'),
                  `hover:${getColorClass('primary', '600', 'text')}`,
                  "transition"
                )}
              >
                <FaArrowLeft className="mr-2" /> Back to Dashboard
              </button>
            </div>
          )}
          <div className={customClasses.emptyContent || "text-center py-12"}>
            <h2 className={customClasses.emptyTitle || classNames(
              "text-2xl font-bold mb-2",
              getColorClass('text', 'primary')
            )}>
              No Entries Yet
            </h2>
            <p className={customClasses.emptyMessage || classNames(
              getColorClass('text', 'secondary'),
              "mb-6"
            )}>
              No entries have been submitted yet. Check back later!
            </p>
            <button
              onClick={onViewPrimary}
              className={customClasses.primaryButton || classNames(
                "px-4 py-2",
                getColorClass('primary', '600', 'bg'),
                `hover:${getColorClass('primary', '700', 'bg')}`,
                "text-white rounded transition"
              )}
            >
              View {primaryEntryName} {entryType}
            </button>
          </div>
        </div>
      );
  }

  return (
    <div className={customClasses.container || "max-w-7xl mx-auto p-4 md:p-6 bg-white rounded-lg shadow-md"}>
      {!isEmbedded && !hideBackButton && (
        <div className={customClasses.header || "flex flex-wrap justify-between items-center mb-6 pb-4 border-b"}>
          <div className={customClasses.headerLeft || "flex items-center space-x-4 mb-4 md:mb-0"}>
            <button
              onClick={handleBack}
              className={customClasses.backButton || classNames(
                "flex items-center",
                getColorClass('text', 'secondary'),
                `hover:${getColorClass('primary', '600', 'text')}`,
                "transition"
              )}
            >
              <FaArrowLeft className="mr-2" /> Back to Dashboard
            </button>
            {/* FIX 1: Updated h1 to use the color utility instead of hardcoded class */}
            <h1 className={customClasses.title || classNames("text-2xl font-bold", getColorClass('text', 'primary'))}>Leaderboard</h1>
          </div>
          <div>
            <button
              onClick={onViewPrimary}
              className={customClasses.viewPrimaryButton || classNames(
                "flex items-center px-4 py-2",
                getColorClass('primary', '600', 'bg'),
                `hover:${getColorClass('primary', '700', 'bg')}`,
                "text-white rounded transition"
              )}
            >
              View {primaryEntryName} {entryType}
            </button>
          </div>
        </div>
      )}
      {(isEmbedded || hideBackButton) && (
        <div className={customClasses.embeddedHeader || "mb-6 pb-4 border-b"}>
          {/* FIX 2: Updated h1 to use the color utility instead of hardcoded class */}
          <h1 className={customClasses.title || classNames("text-2xl font-bold", getColorClass('text', 'primary'))}>Leaderboard</h1>
        </div>
      )}
      {fogOfWarEnabled && !isCompleted && renderFogOfWarBanner && (
        renderFogOfWarBanner(isAdmin, userId, entries)
      )}
      {renderStatusInfo && (
        renderStatusInfo(leagueData, referenceData, settings)
      )}
      {fogOfWarEnabled && !isCompleted && visibleEntries.length < entries.length && (
        <div className={customClasses.fogOfWarMessage || classNames(
          "mb-6 p-4 rounded-lg",
          getColorClass('info', 'light', 'bg'),
          'border',
          getColorClass('info', 'light', 'border')
        )}>
          <p className={customClasses.fogOfWarText || classNames(
            getColorClass('info', 'dark', 'text'),
            "text-center"
          )}>
            Your current position: {entries.findIndex(e => e.id === userId) + 1} out of {entries.length}
            <br />
            <span className="text-sm">Full leaderboard will be revealed when fog of war is removed.</span>
          </p>
        </div>
      )}
      <div className={customClasses.tableContainer || "overflow-x-auto"}>
        <table className={customClasses.table || "min-w-full divide-y divide-gray-200"}>
          <thead className={customClasses.tableHeader || classNames(
            getColorClass('background', 'paper')
          )}>
            <tr>
              {!renderTableHeaders ? (
                <>
                  <th className={customClasses.tableHeaderCell || classNames(
                    "py-3 px-4 text-left text-xs font-medium uppercase tracking-wider",
                    getColorClass('text', 'secondary')
                  )}>Rank</th>
                  <th className={customClasses.tableHeaderCell || classNames(
                    "py-3 px-4 text-left text-xs font-medium uppercase tracking-wider",
                    getColorClass('text', 'secondary')
                  )}>Player</th>
                  <th className={customClasses.tableHeaderCell || classNames(
                    "py-3 px-4 text-right text-xs font-medium uppercase tracking-wider",
                    getColorClass('text', 'secondary')
                  )}>Score</th>
                  <th className={customClasses.tableHeaderCell || classNames(
                    "py-3 px-4 text-center text-xs font-medium uppercase tracking-wider",
                    getColorClass('text', 'secondary')
                  )}>Actions</th>
                </>
              ) : (
                renderTableHeaders(settings)
              )}
            </tr>
          </thead>
          <tbody className={customClasses.tableBody || "bg-white divide-y divide-gray-200"}>
            {visibleEntries.map((entry, index) => (
              renderTableRow ? 
                renderTableRow(entry, index, handleShowDetails, onViewEntry, settings) : (
                  <tr key={entry.id}>
                    <td className={customClasses.tableCell || "py-3 px-4 whitespace-nowrap"}>{index + 1}</td>
                    {/* FIX 3: Added explicit text color for player names */}
                    <td className={customClasses.tableCell || classNames("py-3 px-4 whitespace-nowrap", getColorClass('text', 'primary'))}>
                      {entry.name} 
                      {entry.id === userId && <span className={classNames("ml-1", getColorClass('info', 'main', 'text'))}>(You)</span>}
                    </td>
                    <td className={customClasses.tableCell || classNames("py-3 px-4 whitespace-nowrap text-right font-bold", getColorClass('text', 'primary'))}>
                      {entry.score}
                    </td>
                    <td className={customClasses.tableCell || "py-3 px-4 whitespace-nowrap text-center"}>
                      <button
                        onClick={() => onViewEntry(entry.id)}
                        className={customClasses.viewButton || classNames(
                          "inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md",
                          getColorClass('primary', '700', 'text'),
                          getColorClass('primary', '100', 'bg'),
                          `hover:${getColorClass('primary', '200', 'bg')}`,
                          "focus:outline-none"
                        )}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                )
            ))}
          </tbody>
        </table>
      </div>
      {showDetailsModal && selectedEntry && renderDetailsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-start justify-center z-50 p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-md shadow-xl w-full max-w-md sm:max-w-lg mx-2 my-4 sm:my-8 flex flex-col h-auto max-h-[90vh] sm:max-h-[80vh]">
            <div className={classNames(
              "flex items-center justify-between p-3 sm:p-4 border-b shrink-0",
              getColorClass('border', 'light'),
              "dark:border-gray-700"
            )}>
              {/* FIX 4: Added explicit text color for modal header */}
              <div className={classNames("font-bold truncate pr-2 text-sm sm:text-base", getColorClass('text', 'primary'))}>
                {selectedEntry.name}
                {selectedEntry.id === userId && <span className={classNames("ml-1", getColorClass('info', 'main', 'text'))}>(You)</span>}
              </div>
              <button 
                onClick={() => setShowDetailsModal(false)}
                className={classNames(
                  getColorClass('text', 'secondary'),
                  "hover:text-gray-700 p-1"
                )}
              >
                <FaTimes className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-3 sm:p-4 flex-grow text-xs sm:text-sm">
              {renderDetailsModal(selectedEntry, settings, visibleEntries, referenceData)}
            </div>
            <div className={classNames(
              "border-t p-3 sm:p-4 flex justify-end shrink-0",
              getColorClass('border', 'light'),
              "dark:border-gray-700"
            )}>
              <button
                onClick={() => onViewEntry(selectedEntry.id)}
                className={classNames(
                  "px-3 py-1 sm:px-4 sm:py-2 text-xs sm:text-sm rounded",
                  getColorClass('primary', '600', 'bg'),
                  `hover:${getColorClass('primary', '700', 'bg')}`,
                  "text-white"
                )}
              >
                View Full {entryType}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BaseLeaderboard;