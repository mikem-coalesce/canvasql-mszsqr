import React, { memo, useCallback, useMemo } from 'react';
import { Handle, NodeProps, Position } from 'reactflow'; // v11.0.0
import classNames from 'classnames'; // v2.3.2
import { Table, Column } from '../../../types/sql.types';
import ColumnList from './ColumnList';

// Constants for node dimensions and positioning
const NODE_WIDTH = 240;
const MIN_NODE_HEIGHT = 100;
const HANDLE_POSITIONS = {
  top: 0,
  right: 0.5,
  bottom: 1,
  left: 0.5
};

// Handle styles for different relationship types
const handleStyles = {
  primary: { backgroundColor: '#EAB308' }, // yellow-500
  foreign: { backgroundColor: '#3B82F6' }, // blue-500
  default: { backgroundColor: '#6B7280' }  // gray-500
};

const TableNode: React.FC<NodeProps<Table>> = memo(({ data, selected, isConnectable }) => {
  // Extract table data for rendering
  const { name, schema, columns } = data;

  // Memoize primary and foreign key columns for handle rendering
  const { primaryKeys, foreignKeys } = useMemo(() => {
    return {
      primaryKeys: columns.filter(col => col.isPrimaryKey),
      foreignKeys: columns.filter(col => col.isForeignKey && !col.isPrimaryKey)
    };
  }, [columns]);

  // Handle double-click for editing (implementation depends on external handler)
  const handleDoubleClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    // Trigger edit mode through external handler
  }, []);

  // Construct node class names based on state
  const nodeClasses = classNames(
    // Base styles
    'group relative bg-white dark:bg-gray-800 rounded-lg shadow-lg',
    'border-2 transition-all duration-200 ease-in-out',
    'min-w-[240px] focus:outline-none',
    // Interactive states
    {
      'border-blue-500 dark:border-blue-400 ring-2 ring-blue-500 dark:ring-blue-400': selected,
      'border-gray-200 dark:border-gray-700': !selected,
      'cursor-grab active:cursor-grabbing': isConnectable
    }
  );

  return (
    <div
      className={nodeClasses}
      style={{ width: NODE_WIDTH }}
      data-testid={`table-node-${schema}-${name}`}
      role="button"
      tabIndex={0}
      onDoubleClick={handleDoubleClick}
      aria-label={`Table ${schema}.${name}`}
    >
      {/* Primary Key Handles */}
      {primaryKeys.map((col, index) => (
        <Handle
          key={`pk-${col.name}`}
          type="source"
          position={Position.Right}
          id={`pk-${col.name}`}
          style={{ ...handleStyles.primary, top: `${(index + 1) * 28}px` }}
          isConnectable={isConnectable}
          aria-label={`Primary key handle for ${col.name}`}
        />
      ))}

      {/* Foreign Key Handles */}
      {foreignKeys.map((col, index) => (
        <Handle
          key={`fk-${col.name}`}
          type="target"
          position={Position.Left}
          id={`fk-${col.name}`}
          style={{ ...handleStyles.foreign, top: `${(index + 1) * 28}px` }}
          isConnectable={isConnectable}
          aria-label={`Foreign key handle for ${col.name}`}
        />
      ))}

      {/* Table Header */}
      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
              {name}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {schema}
            </p>
          </div>
          {/* Drag Handle */}
          <div
            className="opacity-0 group-hover:opacity-100 transition-opacity cursor-move"
            data-testid="drag-handle"
          >
            ⋮
          </div>
        </div>
      </div>

      {/* Column List */}
      <div className="p-2">
        <ColumnList columns={columns} />
      </div>

      {/* Default Handles for general connections */}
      <Handle
        type="target"
        position={Position.Top}
        id={`${schema}.${name}-top`}
        style={handleStyles.default}
        isConnectable={isConnectable}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id={`${schema}.${name}-bottom`}
        style={handleStyles.default}
        isConnectable={isConnectable}
      />
    </div>
  );
});

// Display name for debugging and dev tools
TableNode.displayName = 'TableNode';

export default TableNode;