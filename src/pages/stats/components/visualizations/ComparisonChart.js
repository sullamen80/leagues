// src/pages/stats/components/visualizations/ComparisonChart.js
import React from 'react';
import { 
  BarChart, Bar, 
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ScatterChart, Scatter, ZAxis,
  XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer,
  Cell
} from 'recharts';

/**
 * A flexible chart component for comparing different sets of data
 * Supports bar charts (horizontal/vertical), radar charts, and scatter plots
 */
const ComparisonChart = ({
  data,
  type = 'bar',         // 'bar', 'radar', 'scatter', 'horizontalBar'
  comparisonSets = [],  // Array of items to compare
  metrics = [],         // Metrics to show for each item
  title,
  subtitle,
  colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'],
  height = 400,
  sortBy,              // Optional field to sort by
  maxItems = 10        // Limit items to prevent overcrowding
}) => {
  // Process data for different chart types
  const processData = () => {
    if (!data) return [];
    
    // For bar charts with multiple metrics per item
    if (type === 'bar' || type === 'horizontalBar') {
      // If data is already in correct format, return it directly
      if (Array.isArray(data) && data.length > 0 && data[0].name) {
        // Sort if needed
        if (sortBy && metrics.includes(sortBy)) {
          return [...data]
            .sort((a, b) => b[sortBy] - a[sortBy])
            .slice(0, maxItems);
        }
        return data.slice(0, maxItems);
      }
      
      // If data is an object keyed by name, transform it
      if (typeof data === 'object' && !Array.isArray(data)) {
        const transformedData = Object.entries(data).map(([key, value]) => {
          // If value is a primitive, create an object with just one metric
          if (typeof value !== 'object' || value === null) {
            return { name: key, value };
          }
          
          // Otherwise, spread the value object with name set to key
          return { name: key, ...value };
        });
        
        // Sort if needed
        if (sortBy && metrics.includes(sortBy)) {
          return transformedData
            .sort((a, b) => b[sortBy] - a[sortBy])
            .slice(0, maxItems);
        }
        return transformedData.slice(0, maxItems);
      }
    }
    
    // For radar charts comparing multiple items across same metrics
    if (type === 'radar') {
      // If data is already in correct format for radar, return directly
      if (Array.isArray(data) && data.length > 0 && data[0].subject) {
        return data;
      }
      
      // Transform the data for radar format if needed
      // Expected radar format: [{subject: 'A', item1: 120, item2: 80}, {subject: 'B', item1: 90, item2: 110}, ...]
      
      // If comparing different metrics for the same items
      if (comparisonSets.length > 0 && metrics.length > 0) {
        // Create array of metrics with each comparison set's value
        return metrics.map(metric => {
          const metricData = { subject: metric };
          
          comparisonSets.forEach(setKey => {
            if (data[setKey] && data[setKey][metric] !== undefined) {
              metricData[setKey] = data[setKey][metric];
            } else {
              metricData[setKey] = 0;
            }
          });
          
          return metricData;
        });
      }
    }
    
    // For scatter plots
    if (type === 'scatter') {
      // Return data as is if already in correct format
      if (Array.isArray(data)) {
        return data;
      }
      
      // Transform object-based data into array format
      return Object.entries(data).map(([key, values]) => {
        return { name: key, ...values };
      });
    }
    
    return data;
  };

  const chartData = processData();

  // Custom tooltip implementation
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 shadow rounded border border-gray-200">
          <p className="font-medium text-gray-900 mb-2">{label || payload[0].name}</p>
          {payload.map((entry, index) => (
            <p key={`tooltip-${index}`} className="text-sm" style={{ color: entry.color }}>
              <span className="font-medium">{entry.name}: </span>
              <span>{typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}</span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // If no data, show placeholder
  if (!chartData || chartData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-gray-500">No comparison data available</p>
      </div>
    );
  }

  // Render appropriate chart type
  const renderChart = () => {
    switch (type) {
      case 'horizontalBar':
        return (
          <BarChart
            layout="vertical"
            data={chartData}
            margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis type="category" dataKey="name" width={80} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            {metrics.map((metric, index) => (
              <Bar 
                key={`bar-${index}`}
                dataKey={metric} 
                name={metric}
                fill={colors[index % colors.length]} 
              />
            ))}
          </BarChart>
        );
        
      case 'radar':
        return (
          <RadarChart outerRadius={height / 3} data={chartData}>
            <PolarGrid />
            <PolarAngleAxis dataKey="subject" />
            <PolarRadiusAxis />
            <Tooltip content={<CustomTooltip />} />
            {comparisonSets.map((set, index) => (
              <Radar
                key={`radar-${index}`}
                name={set}
                dataKey={set}
                stroke={colors[index % colors.length]}
                fill={colors[index % colors.length]}
                fillOpacity={0.2}
              />
            ))}
            <Legend />
          </RadarChart>
        );
        
      case 'scatter':
        return (
          <ScatterChart
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              type="number" 
              dataKey={metrics[0]} 
              name={metrics[0]} 
              label={{ value: metrics[0], position: 'bottom' }}
            />
            <YAxis 
              type="number" 
              dataKey={metrics[1]} 
              name={metrics[1]}
              label={{ value: metrics[1], angle: -90, position: 'left' }}
            />
            {metrics.length > 2 && (
              <ZAxis 
                type="number" 
                dataKey={metrics[2]} 
                range={[50, 1000]} 
                name={metrics[2]} 
              />
            )}
            <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomTooltip />} />
            <Legend />
            {comparisonSets.map((set, index) => (
              <Scatter 
                key={`scatter-${index}`}
                name={set}
                data={chartData.filter(item => item.group === set)}
                fill={colors[index % colors.length]}
              />
            ))}
            {comparisonSets.length === 0 && (
              <Scatter 
                name={title || "Data"}
                data={chartData}
                fill={colors[0]}
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={colors[index % colors.length]} 
                  />
                ))}
              </Scatter>
            )}
          </ScatterChart>
        );
        
      case 'bar':
      default:
        return (
          <BarChart
            data={chartData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            {metrics.map((metric, index) => (
              <Bar 
                key={`bar-${index}`}
                dataKey={metric} 
                name={metric}
                fill={colors[index % colors.length]} 
              />
            ))}
          </BarChart>
        );
    }
  };
  
  return (
    <div className="bg-white p-4 rounded-lg shadow">
      {title && <h3 className="text-lg font-medium text-gray-900">{title}</h3>}
      {subtitle && <p className="text-sm text-gray-500 mb-4">{subtitle}</p>}
      
      <div style={{ height: `${height}px` }}>
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ComparisonChart;