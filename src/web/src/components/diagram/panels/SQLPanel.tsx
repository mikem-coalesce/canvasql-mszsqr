import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import MonacoEditor from '@monaco-editor/react'; // v4.5.0
import { debounce } from 'lodash'; // v4.17.21
import { validateSQLSyntax, formatSQL, generateERDFromSQL } from '../../../utils/sql.utils';
import { useDiagramStore } from '../../../store/diagram.store';
import { Select } from '../../ui/select';
import { SQLDialect } from '../../../types/sql.types';

// Validation states for SQL content
enum ValidationState {
  VALID = 'valid',
  INVALID = 'invalid',
  PENDING = 'pending',
  IDLE = 'idle'
}

// Props interface with comprehensive type safety
interface SQLPanelProps {
  className?: string;
  initialDialect?: SQLDialect;
  onError?: (error: SQLError) => void;
  onValidationComplete?: (isValid: boolean) => void;
}

// SQL error interface for structured error handling
interface SQLError {
  message: string;
  line?: number;
  column?: number;
  details?: string;
}

// Component state interface
interface SQLPanelState {
  isLoading: boolean;
  error: SQLError | null;
  validationState: ValidationState;
  lastSavedContent: string;
}

// SQL dialect options for the selector
const dialectOptions = [
  { value: SQLDialect.POSTGRESQL, label: 'PostgreSQL', description: 'PostgreSQL 12+' },
  { value: SQLDialect.SNOWFLAKE, label: 'Snowflake', description: 'Current version' }
];

// Monaco editor configuration
const editorOptions = {
  minimap: { enabled: false },
  lineNumbers: 'on',
  roundedSelection: true,
  scrollBeyondLastLine: false,
  automaticLayout: true,
  wordWrap: 'on',
  fontSize: 14,
  tabSize: 2,
  formatOnPaste: true,
  formatOnType: true,
  suggestOnTriggerCharacters: true,
  folding: true,
  theme: 'vs-dark'
};

const SQLPanel: React.FC<SQLPanelProps> = memo(({
  className,
  initialDialect = SQLDialect.POSTGRESQL,
  onError,
  onValidationComplete
}) => {
  // Local state management
  const [state, setState] = useState<SQLPanelState>({
    isLoading: false,
    error: null,
    validationState: ValidationState.IDLE,
    lastSavedContent: ''
  });

  // Store integration
  const { updateSQLDDL } = useDiagramStore();
  const [selectedDialect, setSelectedDialect] = useState<SQLDialect>(initialDialect);
  const editorRef = useRef<any>(null);

  // Debounced validation and update handler
  const handleSQLChange = useCallback(
    debounce(async (value: string) => {
      try {
        setState(prev => ({ ...prev, isLoading: true, validationState: ValidationState.PENDING }));

        // Validate SQL syntax
        const isValid = await validateSQLSyntax(value, selectedDialect);
        if (!isValid) {
          throw new Error('Invalid SQL syntax');
        }

        // Format SQL if valid
        const formattedSQL = formatSQL(value, selectedDialect);
        
        // Update diagram store
        await updateSQLDDL(formattedSQL);

        // Generate ERD
        await generateERDFromSQL(formattedSQL, selectedDialect);

        setState(prev => ({
          ...prev,
          isLoading: false,
          error: null,
          validationState: ValidationState.VALID,
          lastSavedContent: formattedSQL
        }));

        onValidationComplete?.(true);

      } catch (error) {
        const sqlError: SQLError = {
          message: error.message,
          details: error.details
        };

        setState(prev => ({
          ...prev,
          isLoading: false,
          error: sqlError,
          validationState: ValidationState.INVALID
        }));

        onError?.(sqlError);
        onValidationComplete?.(false);
      }
    }, 300),
    [selectedDialect, updateSQLDDL, onError, onValidationComplete]
  );

  // Handle dialect changes
  const handleDialectChange = useCallback((dialect: SQLDialect) => {
    setSelectedDialect(dialect);
    
    // Revalidate current content with new dialect
    if (editorRef.current) {
      const content = editorRef.current.getValue();
      if (content) {
        handleSQLChange(content);
      }
    }
  }, [handleSQLChange]);

  // Editor mount handler
  const handleEditorMount = (editor: any) => {
    editorRef.current = editor;
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Dialect selector */}
      <div className="flex items-center p-4 border-b border-gray-200 dark:border-gray-700">
        <Select
          value={selectedDialect}
          onValueChange={(value) => handleDialectChange(value as SQLDialect)}
          items={dialectOptions}
          label="SQL Dialect"
          className="w-48"
          ariaLabel="Select SQL dialect"
        />
        
        {/* Validation status indicator */}
        <div className="ml-4 flex items-center">
          {state.isLoading ? (
            <span className="text-sm text-gray-500 dark:text-gray-400">Validating...</span>
          ) : (
            <span className={`text-sm ${
              state.validationState === ValidationState.VALID
                ? 'text-green-500 dark:text-green-400'
                : state.validationState === ValidationState.INVALID
                ? 'text-red-500 dark:text-red-400'
                : 'text-gray-500 dark:text-gray-400'
            }`}>
              {state.validationState === ValidationState.VALID
                ? 'Valid SQL'
                : state.validationState === ValidationState.INVALID
                ? 'Invalid SQL'
                : 'Enter SQL DDL'}
            </span>
          )}
        </div>
      </div>

      {/* SQL Editor */}
      <div className="flex-1 min-h-0">
        <MonacoEditor
          height="100%"
          defaultLanguage="sql"
          options={editorOptions}
          onChange={handleSQLChange}
          onMount={handleEditorMount}
          className="w-full"
        />
      </div>

      {/* Error display */}
      {state.error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/10 border-t border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400">
            {state.error.message}
            {state.error.details && (
              <span className="block mt-1 text-xs">
                {state.error.details}
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  );
});

SQLPanel.displayName = 'SQLPanel';

export default SQLPanel;