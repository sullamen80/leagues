// src/pages/stats/components/visualizations/LeaderboardTable.js
import React, { useState, useMemo } from 'react';
import { classNames } from '../../../../utils/formatters';

/**
 * A flexible leaderboard table component for displaying rankings
 */
const LeaderboardTable = ({
  data = [],
  columns = [],
  title,
  subtitle,
  pageSize = 10,
  defaultSortField = 'rank',
  defaultSortDirection = 'asc',
  highlightTop = 3,
  showPagination = true,
  emptyMessage = 'No leaderboard data available',
  onRowClick
}) => {
  // State for sorting and pagination
  const [sortField, setSortField] = useState(defaultSortField);
  const [sortDirection, setSortDirection] = useState(defaultSortDirection);
  const [currentPage, setCurrentPage] = useState(1);

  // Handle sorting
  const handleSort = (field) => {
    if (field === sortField) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default direction
      setSortField(field);
      setSortDirection(defaultSortDirection);
    }
    // Reset to first page when sorting changes
    setCurrentPage(1);
  };

  // Process data with sorting and pagination
  const processedData = useMemo(() => {
    // Make a copy to avoid mutating original data
    let result = [...data];

    // Apply sorting if a sort field is specified
    if (sortField) {
      result.sort((a, b) => {
        // Handle numeric fields
        if (typeof a[sortField] === 'number' && typeof b[sortField] === 'number') {
          return sortDirection === 'asc' 
            ? a[sortField] - b[sortField] 
            : b[sortField] - a[sortField];
        }
        
        // Handle string fields
        const aValue = String(a[sortField] || '').toLowerCase();
        const bValue = String(b[sortField] || '').toLowerCase();
        
        if (sortDirection === 'asc') {
          return aValue.localeCompare(bValue);
        } else {
          return bValue.localeCompare(aValue);
        }
      });
    }

    return result;
  }, [data, sortField, sortDirection]);

  // Calculate pagination
  const totalPages = Math.ceil(processedData.length / pageSize);
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return processedData.slice(startIndex, startIndex + pageSize);
  }, [processedData, currentPage, pageSize]);

  // Format cell value based on type
  const formatCellValue = (column, value) => {
    if (value === null || value === undefined) {
      return '-';
    }

    // Handle specific column types
    switch (column.type) {
      case 'number':
        return typeof value === 'number' 
          ? value.toLocaleString(undefined, column.format || {})
          : value;
        
      case 'percent':
        return typeof value === 'number'
          ? `${(value * 100).toFixed(column.decimals || 1)}%`
          : value;
        
      case 'boolean':
        return value ? (column.trueLabel || 'Yes') : (column.falseLabel || 'No');
        
      case 'date':
        return value instanceof Date 
          ? value.toLocaleDateString()
          : value;
          
      case 'custom':
        return column.formatter ? column.formatter(value, column) : value;
        
      default:
        return value;
    }
  };

  // If no data or no columns defined, show placeholder
  if (!data || data.length === 0 || !columns || columns.length === 0) {
    return (
      <div className="bg-white shadow overflow-hidden sm:rounded-lg p-4">
        {title && <h3 className="text-lg font-medium text-gray-900 mb-1">{title}</h3>}
        {subtitle && <p className="text-sm text-gray-500 mb-4">{subtitle}</p>}
        <div className="flex justify-center items-center h-24 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-gray-500">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      {title && (
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg font-medium text-gray-900">{title}</h3>
          {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
        </div>
      )}
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column, colIndex) => (
                <th
                  key={colIndex}
                  scope="col"
                  className={classNames(
                    "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",
                    column.sortable !== false && "cursor-pointer hover:bg-gray-100"
                  )}
                  onClick={() => column.sortable !== false && handleSort(column.field)}
                >
                  <div className="flex items-center">
                    {column.header || column.field}
                    
                    {column.sortable !== false && sortField === column.field && (
                      <span className="ml-2">
                        {sortDirection === 'asc' ? (
                          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedData.map((row, rowIndex) => {
              // Determine rank for highlighting
              const rank = row.rank || (sortField === 'rank' && sortDirection === 'asc' 
                ? ((currentPage - 1) * pageSize) + rowIndex + 1
                : null);
                
              // Determine if row should be highlighted
              const isHighlighted = 
                rank !== null && 
                highlightTop > 0 && 
                rank <= highlightTop;
              
              return (
                <tr 
                  key={rowIndex} 
                  className={classNames(
                    onRowClick ? "cursor-pointer hover:bg-gray-50" : "",
                    isHighlighted ? "bg-yellow-50" : ""
                  )}
                  onClick={() => onRowClick && onRowClick(row)}
                >
                  {columns.map((column, colIndex) => (
                    <td 
                      key={colIndex} 
                      className={classNames(
                        "px-6 py-4 whitespace-nowrap text-sm",
                        column.className || "",
                        column.important ? "font-medium text-gray-900" : "text-gray-500"
                      )}
                    >
                      {formatCellValue(column, row[column.field])}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {/* Pagination controls */}
      {showPagination && totalPages > 1 && (
        <div className="px-4 py-3 bg-white border-t border-gray-200 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className={classNames(
                  "relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white",
                  currentPage === 1 
                    ? "opacity-50 cursor-not-allowed" 
                    : "hover:bg-gray-50"
                )}
              >
                Previous
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                className={classNames(
                  "ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white",
                  currentPage === totalPages 
                    ? "opacity-50 cursor-not-allowed" 
                    : "hover:bg-gray-50"
                )}
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{((currentPage - 1) * pageSize) + 1}</span> to{' '}
                  <span className="font-medium">
                    {Math.min(currentPage * pageSize, processedData.length)}
                  </span>{' '}
                  of <span className="font-medium">{processedData.length}</span> results
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(1)}
                    className={classNames(
                      "relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500",
                      currentPage === 1 
                        ? "opacity-50 cursor-not-allowed" 
                        : "hover:bg-gray-50"
                    )}
                  >
                    <span className="sr-only">First</span>
                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                      <path fillRule="evenodd" d="M8.707 5.293a1 1 0 010 1.414L5.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    className={classNames(
                      "relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500",
                      currentPage === 1 
                        ? "opacity-50 cursor-not-allowed" 
                        : "hover:bg-gray-50"
                    )}
                  >
                    <span className="sr-only">Previous</span>
                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                  
                  {/* Page number buttons */}
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    // Show pages around current page
                    let pageNum;
                    if (totalPages <= 5) {
                      // Show all pages if 5 or fewer
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      // Near start
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      // Near end
                      pageNum = totalPages - 4 + i;
                    } else {
                      // Middle
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={classNames(
                          "relative inline-flex items-center px-4 py-2 border text-sm font-medium",
                          pageNum === currentPage
                            ? "z-10 bg-indigo-50 border-indigo-500 text-indigo-600"
                            : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                        )}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    className={classNames(
                      "relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500",
                      currentPage === totalPages 
                        ? "opacity-50 cursor-not-allowed" 
                        : "hover:bg-gray-50"
                    )}
                  >
                    <span className="sr-only">Next</span>
                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(totalPages)}
                    className={classNames(
                      "relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500",
                      currentPage === totalPages 
                        ? "opacity-50 cursor-not-allowed" 
                        : "hover:bg-gray-50"
                    )}
                  >
                    <span className="sr-only">Last</span>
                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      <path fillRule="evenodd" d="M11.293 14.707a1 1 0 010-1.414L14.586 10l-3.293-3.293a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                </nav>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaderboardTable;