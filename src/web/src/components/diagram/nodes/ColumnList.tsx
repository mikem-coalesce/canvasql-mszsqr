import React, { memo, useMemo } from 'react';
import classNames from 'classnames'; // v2.3.2
import { Column } from '../../../types/sql.types';

// Constants for styling and accessibility
const COLUMN_HEIGHT = 28; // pixels

interface ColumnListProps {
  columns: Column[];
}

const ColumnList: React.FC<ColumnListProps> = memo(({ columns }) => {
  // Sort columns: primary keys first, then foreign keys, then regular columns
  const sortedColumns = useMemo(() => {
    return [...columns].sort((a, b) => {
      if (a.isPrimaryKey && !b.isPrimaryKey) return -1;
      if (!a.isPrimaryKey && b.isPrimaryKey) return 1;
      if (a.isForeignKey && !b.isForeignKey) return -1;
      if (!a.isForeignKey && b.isForeignKey) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [columns]);

  return (
    <div
      role="list"
      className="space-y-1 max-h-[calc(100vh-200px)] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600"
      aria-label="Table columns"
    >
      {sortedColumns.map((column, index) => (
        <div
          key={column.name}
          role="listitem"
          className={classNames(
            'flex items-center justify-between px-2 py-1 text-sm',
            'hover:bg-gray-50 dark:hover:bg-gray-700',
            'focus:outline-none focus:ring-2 focus:ring-blue-500',
            'rounded transition-colors duration-150',
            {
              'border-l-2 border-yellow-500': column.isPrimaryKey,
              'border-l-2 border-blue-500': column.isForeignKey && !column.isPrimaryKey
            }
          )}
          style={{ height: COLUMN_HEIGHT }}
          tabIndex={0}
          data-testid={`column-${column.name}`}
        >
          <div className="flex items-center space-x-2 max-w-[70%]">
            <span
              className={classNames('truncate font-medium', {
                'text-yellow-500 dark:text-yellow-400': column.isPrimaryKey,
                'text-blue-500 dark:text-blue-400': column.isForeignKey && !column.isPrimaryKey,
                'text-gray-900 dark:text-gray-100': !column.isPrimaryKey && !column.isForeignKey,
                'italic': column.nullable
              })}
              title={column.name}
            >
              {column.name}
              {column.isPrimaryKey && (
                <span className="ml-1" aria-label="Primary Key">
                  🔑
                </span>
              )}
              {column.isForeignKey && !column.isPrimaryKey && (
                <span className="ml-1" aria-label="Foreign Key">
                  🔗
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <span
              className="text-gray-500 dark:text-gray-400 text-xs"
              title={`${column.type}${column.length ? `(${column.length})` : ''}`}
            >
              {column.type.toLowerCase()}
              {column.length && `(${column.length})`}
            </span>
            {column.isUnique && !column.isPrimaryKey && (
              <span className="text-purple-500 dark:text-purple-400 text-xs" title="Unique">
                U
              </span>
            )}
            {column.isAutoIncrement && (
              <span className="text-green-500 dark:text-green-400 text-xs" title="Auto Increment">
                AI
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
});

ColumnList.displayName = 'ColumnList';

export default ColumnList;