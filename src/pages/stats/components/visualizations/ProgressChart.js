// src/pages/stats/components/visualizations/ProgressChart.js
import React from 'react';
import { LineChart, Line, BarChart, Bar, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
console.log('recharts components:', { LineChart, BarChart, ComposedChart });


/**
 * Chart for visualizing progress/sequential data (e.g., round-by-round performance)
 * Supports line charts, bar charts, or a combination of both
 */
const ProgressChart = ({
  data,
  series = [],
  type = 'line', // 'line', 'bar', or 'composed'
  xAxisKey = 'name',
  title,
  subtitle,
  colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'],
  height = 400,
  percent = false,
  stacked = false
}) => {
  // Transform data if needed
  const processData = () => {
    // If data is an object with nested structure, transform to array format
    if (data && !Array.isArray(data) && typeof data === 'object') {
      return Object.entries(data).map(([key, value]) => {
        // If the value is a primitive, create a simple object
        if (typeof value !== 'object' || value === null) {
          return { [xAxisKey]: key, value: value };
        }
        
        // Otherwise, spread the object contents with the key as xAxis
        return {
          [xAxisKey]: key,
          ...value
        };
      });
    }
    return data;
  };

  const chartData = processData();

  // Format for tooltip
  const formatValue = (value) => {
    if (typeof value !== 'number') return value;
    
    if (percent) {
      return `${(value * 100).toFixed(1)}%`;
    }
    
    return value.toLocaleString();
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 shadow rounded border border-gray-200">
          <p className="font-medium text-gray-900 mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p key={`tooltip-${index}`} className="text-sm" style={{ color: entry.color }}>
              <span className="font-medium">{entry.name}: </span>
              <span>{formatValue(entry.value)}</span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Determine the chart component based on type
  const getChartComponent = () => {
    switch (type) {
      case 'bar':
        return (
          <BarChart
            data={chartData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xAxisKey} />
            <YAxis tickFormatter={percent ? (value) => `${(value * 100).toFixed(0)}%` : undefined} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            {series.map((item, index) => (
              <Bar 
                key={`bar-${index}`}
                dataKey={item.dataKey} 
                name={item.name || item.dataKey}
                fill={item.color || colors[index % colors.length]}
                stackId={stacked ? "stack" : undefined}
              />
            ))}
          </BarChart>
        );
      case 'composed':
        return (
          <ComposedChart
            data={chartData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xAxisKey} />
            <YAxis tickFormatter={percent ? (value) => `${(value * 100).toFixed(0)}%` : undefined} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            {series.map((item, index) => {
              if (item.type === 'line') {
                return (
                  <Line
                    key={`line-${index}`}
                    type="monotone"
                    dataKey={item.dataKey}
                    name={item.name || item.dataKey}
                    stroke={item.color || colors[index % colors.length]}
                    activeDot={{ r: 8 }}
                    strokeWidth={2}
                  />
                );
              } else {
                return (
                  <Bar
                    key={`bar-${index}`}
                    dataKey={item.dataKey}
                    name={item.name || item.dataKey}
                    fill={item.color || colors[index % colors.length]}
                    stackId={stacked && item.stack ? item.stack : undefined}
                  />
                );
              }
            })}
          </ComposedChart>
        );
      case 'line':
      default:
        return (
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xAxisKey} />
            <YAxis tickFormatter={percent ? (value) => `${(value * 100).toFixed(0)}%` : undefined} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            {series.map((item, index) => (
              <Line
                key={`line-${index}`}
                type="monotone"
                dataKey={item.dataKey}
                name={item.name || item.dataKey}
                stroke={item.color || colors[index % colors.length]}
                activeDot={{ r: 8 }}
                strokeWidth={2}
              />
            ))}
          </LineChart>
        );
    }
  };

  // If no data or no series defined, show placeholder
  if (!chartData || chartData.length === 0 || !series || series.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-gray-500">No data available</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      {title && <h3 className="text-lg font-medium text-gray-900">{title}</h3>}
      {subtitle && <p className="text-sm text-gray-500 mb-4">{subtitle}</p>}
      
      <div style={{ height: `${height}px` }}>
        <ResponsiveContainer width="100%" height="100%">
          {getChartComponent()}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ProgressChart;