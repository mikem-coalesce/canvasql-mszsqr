import React, { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns'; // v2.30.0
import useDiagramStore from '../../../store/diagram.store';
import YjsProvider from '../../../lib/yjs';
import { Button } from '../../ui/button';
import { CollaborationEventType } from '../../../types/collaboration.types';

// Enhanced interface for history entries with rich metadata
interface HistoryEntry {
  id: string;
  timestamp: Date;
  userId: string;
  userName: string;
  type: 'add' | 'update' | 'delete' | 'sql' | 'batch';
  description: string;
  metadata: Record<string, unknown>;
  undoable: boolean;
}

/**
 * HistoryPanel component for displaying and managing diagram version history
 * with real-time collaboration support and enhanced history tracking
 */
const HistoryPanel: React.FC = () => {
  // Local state for history entries with virtual scrolling support
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Get undo/redo capabilities from diagram store
  const { undo, redo, canUndo, canRedo } = useDiagramStore();

  // Reference to Y.js provider for real-time collaboration
  const [provider, setProvider] = useState<YjsProvider | null>(null);

  /**
   * Formats history entry for display with enhanced metadata
   */
  const formatHistoryEntry = useCallback((entry: HistoryEntry): string => {
    const timestamp = format(entry.timestamp, 'HH:mm:ss');
    const action = entry.type === 'batch' ? 'multiple changes' : `${entry.type}ed`;
    
    let description = `${entry.userName} ${action}`;
    if (entry.description) {
      description += `: ${entry.description}`;
    }
    
    if (entry.metadata.affectedElements) {
      description += ` (${entry.metadata.affectedElements} elements)`;
    }
    
    return `${timestamp} - ${description}`;
  }, []);

  /**
   * Handles undo operation with Y.js synchronization
   */
  const handleUndo = useCallback(async () => {
    if (!canUndo) return;

    try {
      // Start Y.js transaction for atomic updates
      provider?.document.transact(() => {
        undo();
        // Update Y.js history state
        provider?.document.getArray('history').delete(
          provider.document.getArray('history').length - 1,
          1
        );
      });

      // Broadcast undo event to collaborators
      provider?.document.emit(CollaborationEventType.UNDO, {
        userId: provider.document.clientID,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Undo operation failed:', error);
    }
  }, [canUndo, undo, provider]);

  /**
   * Handles redo operation with Y.js synchronization
   */
  const handleRedo = useCallback(async () => {
    if (!canRedo) return;

    try {
      // Start Y.js transaction for atomic updates
      provider?.document.transact(() => {
        redo();
        // Update Y.js history state
        const historyArray = provider?.document.getArray('history');
        if (historyArray) {
          historyArray.push([{
            action: 'redo',
            timestamp: Date.now()
          }]);
        }
      });

      // Broadcast redo event to collaborators
      provider?.document.emit(CollaborationEventType.REDO, {
        userId: provider.document.clientID,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Redo operation failed:', error);
    }
  }, [canRedo, redo, provider]);

  /**
   * Synchronizes history state with Y.js on component mount
   */
  useEffect(() => {
    const syncHistory = async () => {
      try {
        setIsLoading(true);
        const historyArray = provider?.document.getArray('history');
        if (historyArray) {
          const entries = historyArray.toArray().map((item: any) => ({
            id: item.id || crypto.randomUUID(),
            timestamp: new Date(item.timestamp),
            userId: item.userId,
            userName: item.userName || 'Unknown User',
            type: item.type,
            description: item.description || '',
            metadata: item.metadata || {},
            undoable: item.undoable !== false
          }));
          setHistoryEntries(entries);
        }
      } catch (error) {
        console.error('History sync failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (provider) {
      syncHistory();
      // Subscribe to history updates
      provider.document.on('update', syncHistory);
      return () => {
        provider.document.off('update', syncHistory);
      };
    }
  }, [provider]);

  return (
    <div className="flex flex-col h-full bg-background border-l">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">History</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-muted-foreground">Loading history...</span>
          </div>
        ) : (
          <div className="space-y-2 relative">
            {historyEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start space-x-3 text-sm hover:bg-accent/10 p-2 rounded"
              >
                <span className="text-muted-foreground whitespace-nowrap">
                  {format(entry.timestamp, 'HH:mm:ss')}
                </span>
                <span className="font-medium text-primary">{entry.userName}</span>
                <span className="text-foreground flex-1">
                  {formatHistoryEntry(entry)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-between p-4 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <Button
          variant="outline"
          size="sm"
          onClick={handleUndo}
          disabled={!canUndo || isLoading}
        >
          Undo
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRedo}
          disabled={!canRedo || isLoading}
        >
          Redo
        </Button>
      </div>
    </div>
  );
};

export default HistoryPanel;