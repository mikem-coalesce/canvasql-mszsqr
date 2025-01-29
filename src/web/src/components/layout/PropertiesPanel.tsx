import React, { useCallback, useEffect, useState } from 'react';
import { useReactFlow } from 'reactflow';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { Card, CardHeader, CardContent } from '../ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import useDiagram from '../../hooks/useDiagram';
import useCollaboration from '../../hooks/useCollaboration';
import { DiagramNode, DiagramEdge } from '../../types/diagram.types';
import { Table, Column, TableConstraint, TableIndex } from '../../types/sql.types';

// Validation schemas for properties
const columnSchema = z.object({
  name: z.string().min(1, 'Column name is required'),
  type: z.string().min(1, 'Column type is required'),
  nullable: z.boolean(),
  defaultValue: z.string().optional(),
  isPrimaryKey: z.boolean(),
  isForeignKey: z.boolean(),
  isUnique: z.boolean(),
  isAutoIncrement: z.boolean()
});

const tableSchema = z.object({
  name: z.string().min(1, 'Table name is required'),
  schema: z.string().min(1, 'Schema name is required'),
  columns: z.array(columnSchema),
  primaryKey: z.array(z.string()),
  constraints: z.array(z.object({
    type: z.enum(['UNIQUE', 'CHECK', 'FOREIGN KEY']),
    name: z.string(),
    columns: z.array(z.string()),
    definition: z.string()
  })),
  indices: z.array(z.object({
    name: z.string(),
    columns: z.array(z.string()),
    isUnique: z.boolean(),
    method: z.enum(['BTREE', 'HASH', 'GIST', 'GIN'])
  }))
});

interface PropertiesPanelProps {
  className?: string;
  isCollapsed?: boolean;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  className,
  isCollapsed = false
}) => {
  // Get React Flow instance and selected elements
  const { getNode, getEdge } = useReactFlow();
  const [selectedNode, setSelectedNode] = useState<DiagramNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<DiagramEdge | null>(null);

  // Get diagram and collaboration hooks
  const { diagram, updateLayout } = useDiagram();
  const { broadcastChange, syncStatus } = useCollaboration();

  // Initialize form with validation
  const form = useForm({
    resolver: zodResolver(tableSchema),
    defaultValues: {
      name: '',
      schema: 'public',
      columns: [],
      primaryKey: [],
      constraints: [],
      indices: []
    }
  });

  // Update selected elements when diagram changes
  useEffect(() => {
    const node = diagram?.layout.nodes.find(n => n.selected);
    const edge = diagram?.layout.edges.find(e => e.selected);

    setSelectedNode(node || null);
    setSelectedEdge(edge || null);

    if (node) {
      form.reset(node.data);
    }
  }, [diagram?.layout, form]);

  // Handle property changes with validation and collaboration
  const handlePropertyChange = useCallback(async (
    elementId: string,
    propertyName: string,
    value: any
  ) => {
    try {
      // Validate changes
      if (selectedNode) {
        await tableSchema.parseAsync(value);
      }

      // Update local state
      updateLayout({
        nodes: diagram?.layout.nodes.map(node => 
          node.id === elementId 
            ? { ...node, data: { ...node.data, [propertyName]: value } }
            : node
        ),
        edges: diagram?.layout.edges
      });

      // Broadcast change to collaborators
      await broadcastChange({
        type: 'propertyChange',
        elementId,
        propertyName,
        value
      });

    } catch (error) {
      console.error('Property change validation failed:', error);
    }
  }, [selectedNode, diagram, updateLayout, broadcastChange]);

  // Render table properties section
  const renderTableProperties = () => (
    <form onSubmit={form.handleSubmit(data => handlePropertyChange(selectedNode!.id, 'data', data))}>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium">Table Name</label>
          <input
            {...form.register('name')}
            className="w-full mt-1 rounded-md border"
            aria-label="Table name"
          />
          {form.formState.errors.name && (
            <span className="text-sm text-red-500">{form.formState.errors.name.message}</span>
          )}
        </div>

        <div>
          <label className="text-sm font-medium">Schema</label>
          <input
            {...form.register('schema')}
            className="w-full mt-1 rounded-md border"
            aria-label="Schema name"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Columns</label>
          {form.watch('columns')?.map((column: Column, index: number) => (
            <div key={index} className="mt-2 p-2 border rounded">
              <input
                {...form.register(`columns.${index}.name`)}
                className="w-full mb-1"
                placeholder="Column name"
              />
              <select
                {...form.register(`columns.${index}.type`)}
                className="w-full mb-1"
              >
                {/* Column type options */}
              </select>
              <div className="flex gap-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    {...form.register(`columns.${index}.isPrimaryKey`)}
                  />
                  <span className="ml-1">Primary Key</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    {...form.register(`columns.${index}.nullable`)}
                  />
                  <span className="ml-1">Nullable</span>
                </label>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => form.setValue('columns', [...form.watch('columns'), {}])}
            className="mt-2 text-sm text-blue-500"
          >
            Add Column
          </button>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-500 text-white rounded"
            disabled={!form.formState.isDirty || form.formState.isSubmitting}
          >
            Save Changes
          </button>
        </div>
      </div>
    </form>
  );

  // Render relationship properties section
  const renderRelationshipProperties = () => (
    <div className="space-y-4">
      {selectedEdge && (
        <>
          <div>
            <label className="text-sm font-medium">Relationship Type</label>
            <select
              value={selectedEdge.data.type}
              onChange={e => handlePropertyChange(selectedEdge.id, 'type', e.target.value)}
              className="w-full mt-1 rounded-md border"
            >
              <option value="one_to_one">One-to-One</option>
              <option value="one_to_many">One-to-Many</option>
              <option value="many_to_many">Many-to-Many</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">On Delete</label>
            <select
              value={selectedEdge.data.onDelete}
              onChange={e => handlePropertyChange(selectedEdge.id, 'onDelete', e.target.value)}
              className="w-full mt-1 rounded-md border"
            >
              <option value="CASCADE">CASCADE</option>
              <option value="SET NULL">SET NULL</option>
              <option value="SET DEFAULT">SET DEFAULT</option>
              <option value="RESTRICT">RESTRICT</option>
              <option value="NO ACTION">NO ACTION</option>
            </select>
          </div>
        </>
      )}
    </div>
  );

  if (isCollapsed) {
    return null;
  }

  return (
    <Card className={`w-80 h-full overflow-hidden ${className}`}>
      <CardHeader className="border-b">
        <h3 className="text-lg font-semibold">Properties</h3>
        <div className="text-sm text-muted-foreground">
          {syncStatus === 'synced' ? 'All changes saved' : 'Syncing changes...'}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs defaultValue="properties" className="w-full">
          <TabsList className="w-full border-b">
            <TabsTrigger value="properties" className="flex-1">
              Properties
            </TabsTrigger>
            <TabsTrigger value="style" className="flex-1">
              Style
            </TabsTrigger>
          </TabsList>
          <TabsContent value="properties" className="p-4">
            {selectedNode && renderTableProperties()}
            {selectedEdge && renderRelationshipProperties()}
            {!selectedNode && !selectedEdge && (
              <div className="text-center text-muted-foreground py-4">
                Select an element to edit its properties
              </div>
            )}
          </TabsContent>
          <TabsContent value="style" className="p-4">
            {/* Style properties would go here */}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default PropertiesPanel;