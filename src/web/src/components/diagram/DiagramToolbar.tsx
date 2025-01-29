import React, { useCallback, useState } from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  ZoomFit, 
  RotateCcw, 
  Upload, 
  Download, 
  Layout 
} from 'lucide-react'; // ^0.284.0
import { Button, buttonVariants } from '../ui/button';
import { useDiagram } from '../../hooks/useDiagram';
import { useZoom } from '../../hooks/useZoom';
import { SQLDialect } from '../../types/sql.types';

// Interface for toolbar props with accessibility support
interface DiagramToolbarProps {
  className?: string;
  onLayoutChange?: (layout: 'horizontal' | 'vertical') => void;
  sqlDialect?: SQLDialect;
}

/**
 * Enhanced toolbar component for diagram manipulation with accessibility support
 * Implements comprehensive controls for zoom, layout, and SQL import/export
 */
const DiagramToolbar: React.FC<DiagramToolbarProps> = ({
  className,
  onLayoutChange,
  sqlDialect = SQLDialect.POSTGRESQL
}) => {
  // Initialize hooks
  const { diagram, parseSQLDDL, generateSQLDDL } = useDiagram();
  const { zoomIn, zoomOut, resetZoom, fitView } = useZoom();
  
  // Local state for loading states
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  /**
   * Handles SQL file import with dialect support and validation
   */
  const handleSQLImport = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setIsImporting(true);
      const file = event.target.files?.[0];
      if (!file) return;

      // Validate file type
      if (!file.name.endsWith('.sql')) {
        throw new Error('Please select a valid SQL file');
      }

      // Read file content
      const content = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsText(file);
      });

      // Parse SQL with selected dialect
      await parseSQLDDL(content);

    } catch (error) {
      console.error('SQL import failed:', error);
      // Error handling would be implemented here
    } finally {
      setIsImporting(false);
      // Reset file input
      event.target.value = '';
    }
  }, [parseSQLDDL]);

  /**
   * Handles SQL export with dialect-specific formatting
   */
  const handleSQLExport = useCallback(async () => {
    try {
      setIsExporting(true);

      // Generate SQL DDL for current diagram
      const sql = await generateSQLDDL(sqlDialect);

      // Create downloadable file
      const blob = new Blob([sql], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `diagram_${diagram.id}_${sqlDialect.toLowerCase()}.sql`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error('SQL export failed:', error);
      // Error handling would be implemented here
    } finally {
      setIsExporting(false);
    }
  }, [diagram.id, generateSQLDDL, sqlDialect]);

  return (
    <div
      className="flex items-center justify-between p-2 bg-background border-b shadow-sm"
      role="toolbar"
      aria-label="Diagram controls"
    >
      {/* Zoom Controls */}
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={zoomIn}
          aria-label="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={zoomOut}
          aria-label="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={fitView}
          aria-label="Fit to view"
        >
          <ZoomFit className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={resetZoom}
          aria-label="Reset zoom"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      {/* Layout Controls */}
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onLayoutChange?.('horizontal')}
          aria-label="Horizontal layout"
        >
          <Layout className="h-4 w-4 rotate-90" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onLayoutChange?.('vertical')}
          aria-label="Vertical layout"
        >
          <Layout className="h-4 w-4" />
        </Button>
      </div>

      {/* SQL Import/Export */}
      <div className="flex items-center gap-1">
        <div className="relative">
          <input
            type="file"
            accept=".sql"
            onChange={handleSQLImport}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            aria-label="Import SQL file"
          />
          <Button
            variant="outline"
            size="sm"
            disabled={isImporting}
            aria-label="Import SQL"
          >
            <Upload className="h-4 w-4 mr-2" />
            Import SQL
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSQLExport}
          disabled={isExporting}
          aria-label="Export SQL"
        >
          <Download className="h-4 w-4 mr-2" />
          Export SQL
        </Button>
      </div>
    </div>
  );
};

export default DiagramToolbar;