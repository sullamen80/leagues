// src/pages/stats/components/visualizations/DistributionChart.js
import React, { useState } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

/**
 * A flexible chart component for displaying distribution data
 * Supports both pie charts and bar charts
 */
const DistributionChart = ({ 
  data, 
  type = 'pie', 
  dataKey = 'value', 
  nameKey = 'name',
  title,
  subtitle,
  colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6'],
  height = 400
}) => {
  // Format for tooltip
  const formatPercent = (value) => {
    if (typeof value !== 'number') return '0%';
    return `${(value * 100).toFixed(1)}%`;
  };

  // Custom tooltip for pie chart
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-2 shadow rounded border border-gray-200">
          <p className="font-medium">{payload[0].name}</p>
          <p className="text-sm">
            <span className="font-medium">{payload[0].value.toLocaleString()}</span>
            {payload[0].payload.percentage !== undefined && (
              <span className="ml-2 text-gray-500">
                ({formatPercent(payload[0].payload.percentage)})
              </span>
            )}
          </p>
        </div>
      );
    }
    return null;
  };

  // Process the data if needed
  const processData = () => {
    // If data is an object like {category1: {value, percentage}, category2: {...}}
    if (data && !Array.isArray(data) && typeof data === 'object') {
      return Object.entries(data).map(([key, value]) => {
        // Handle case where value might be an object with nested properties
        if (typeof value === 'object' && value !== null) {
          return {
            name: key,
            value: value[dataKey] || 0,
            percentage: value.percentage || null,
            ...value
          };
        }
        // Handle case where value is a direct primitive
        return {
          name: key,
          value: value,
        };
      });
    }
    return data;
  };

  const chartData = processData();

  // If no data or empty array, show placeholder
  if (!chartData || chartData.length === 0) {
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
          {type === 'pie' ? (
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={height / 3}
                fill="#8884d8"
                dataKey={dataKey}
                nameKey={nameKey}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend layout="vertical" verticalAlign="middle" align="right" />
            </PieChart>
          ) : (
            <BarChart
              data={chartData}
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={nameKey} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey={dataKey} name={title || dataKey}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default DistributionChart;