import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import { debounce } from 'lodash';
import { Spinner } from 'lucide-react';

import DiagramCanvas from '../components/diagram/DiagramCanvas';
import DiagramToolbar from '../components/diagram/DiagramToolbar';
import PropertiesPanel from '../components/diagram/panels/PropertiesPanel';
import useDiagram from '../hooks/useDiagram';

interface DiagramPageProps {
  onError?: (error: Error) => void;
  className?: string;
}

const DiagramPage: React.FC<DiagramPageProps> = ({ onError, className }) => {
  // Get diagram ID from URL parameters
  const { diagramId } = useParams<{ diagramId: string }>();

  // Initialize diagram state
  const {
    diagram,
    isLoading,
    error,
    updateLayout,
    parseSQLDDL,
    performance,
    syncStatus
  } = useDiagram(diagramId);

  // Local state for selected elements
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // Debounced selection handler
  const handleSelectionChange = useCallback(
    debounce((nodeId: string | null, edgeId: string | null) => {
      setSelectedNodeId(nodeId);
      setSelectedEdgeId(edgeId);
    }, 100),
    []
  );

  // Handle property changes
  const handlePropertyChange = useCallback((property: string, value: any) => {
    if (!diagram) return;

    const updatedLayout = { ...diagram.layout };
    
    if (selectedNodeId) {
      const nodeIndex = updatedLayout.nodes.findIndex(n => n.id === selectedNodeId);
      if (nodeIndex !== -1) {
        updatedLayout.nodes[nodeIndex] = {
          ...updatedLayout.nodes[nodeIndex],
          data: {
            ...updatedLayout.nodes[nodeIndex].data,
            [property]: value
          }
        };
      }
    }

    if (selectedEdgeId) {
      const edgeIndex = updatedLayout.edges.findIndex(e => e.id === selectedEdgeId);
      if (edgeIndex !== -1) {
        updatedLayout.edges[edgeIndex] = {
          ...updatedLayout.edges[edgeIndex],
          data: {
            ...updatedLayout.edges[edgeIndex].data,
            [property]: value
          }
        };
      }
    }

    updateLayout(updatedLayout);
  }, [diagram, selectedNodeId, selectedEdgeId, updateLayout]);

  // Monitor performance metrics
  useEffect(() => {
    if (performance.renderTime > 100) {
      console.warn('Diagram render time exceeded threshold:', performance.renderTime);
    }
  }, [performance]);

  // Error fallback component
  const ErrorFallback = ({ error }: { error: Error }) => (
    <div className="flex flex-col items-center justify-center h-screen p-4">
      <h2 className="text-xl font-semibold text-red-600 mb-2">Error Loading Diagram</h2>
      <p className="text-gray-600 mb-4">{error.message}</p>
      <button
        onClick={() => window.location.reload()}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Retry
      </button>
    </div>
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-gray-600">Loading diagram...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    onError?.(error);
    return <ErrorFallback error={error} />;
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div className="flex h-screen w-screen overflow-hidden">
        <main className="flex-1 flex flex-col">
          {/* Toolbar */}
          <DiagramToolbar
            sqlDialect={diagram?.dialect}
            onLayoutChange={(layout) => {
              // Handle layout changes
              updateLayout({ ...diagram.layout, orientation: layout });
            }}
          />

          {/* Canvas */}
          <div className="flex-1 relative">
            <DiagramCanvas
              diagramId={diagramId}
              isReadOnly={false}
              onSelectionChange={handleSelectionChange}
            />

            {/* Sync Status Indicator */}
            <div className="absolute bottom-4 right-4 flex items-center gap-2 px-3 py-1 rounded-full bg-white/90 shadow-sm">
              <div
                className={`w-2 h-2 rounded-full ${
                  syncStatus === 'synced' ? 'bg-green-500' : 'bg-yellow-500'
                }`}
              />
              <span className="text-sm text-gray-600">
                {syncStatus === 'synced' ? 'Changes saved' : 'Syncing...'}
              </span>
            </div>
          </div>
        </main>

        {/* Properties Panel */}
        <PropertiesPanel
          selectedNodeId={selectedNodeId}
          selectedEdgeId={selectedEdgeId}
          isReadOnly={false}
          onPropertyChange={handlePropertyChange}
        />
      </div>
    </ErrorBoundary>
  );
};

export default DiagramPage;