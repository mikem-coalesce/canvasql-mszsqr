"use client";

import React, { useCallback, useState, useEffect, useMemo } from "react";
import { debounce } from "lodash";
import { useVirtualizer } from "@tanstack/react-virtual";
import { z } from "zod";

import { Input } from "../../ui/input";
import { Select } from "../../ui/select";
import useDiagram from "../../../hooks/useDiagram";
import { ColumnType, SQLDialect } from "../../../types/sql.types";
import { cn } from "../../../lib/utils";

// Validation schemas
const tableSchema = z.object({
  name: z.string().min(1, "Table name is required"),
  schema: z.string(),
  columns: z.array(z.object({
    name: z.string().min(1, "Column name is required"),
    type: z.string(),
    nullable: z.boolean(),
    isPrimaryKey: z.boolean(),
    isForeignKey: z.boolean()
  }))
});

interface PropertiesPanelProps {
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  isReadOnly: boolean;
  onPropertyChange: (property: string, value: any) => void;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  selectedNodeId,
  selectedEdgeId,
  isReadOnly,
  onPropertyChange
}) => {
  // Get diagram state and methods
  const { diagram, updateLayout, presence } = useDiagram();

  // Local state for property values
  const [localProperties, setLocalProperties] = useState<any>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Get selected element
  const selectedElement = useMemo(() => {
    if (selectedNodeId) {
      return diagram.layout.nodes.find(node => node.id === selectedNodeId);
    }
    if (selectedEdgeId) {
      return diagram.layout.edges.find(edge => edge.id === selectedEdgeId);
    }
    return null;
  }, [diagram, selectedNodeId, selectedEdgeId]);

  // Set up virtualization for large property lists
  const rowVirtualizer = useVirtualizer({
    count: selectedElement?.data?.columns?.length || 0,
    getScrollElement: () => document.querySelector(".properties-list"),
    estimateSize: () => 40,
    overscan: 5
  });

  // Debounced update handler
  const handlePropertyUpdate = useCallback(
    debounce(async (property: string, value: any) => {
      try {
        if (selectedElement) {
          // Validate updates
          if (property === "name") {
            await tableSchema.parseAsync({ ...selectedElement.data, [property]: value });
          }

          // Update local state
          setLocalProperties(prev => ({
            ...prev,
            [property]: value
          }));

          // Propagate changes
          onPropertyChange(property, value);

          // Clear validation error
          setValidationErrors(prev => ({
            ...prev,
            [property]: ""
          }));
        }
      } catch (error) {
        if (error instanceof z.ZodError) {
          setValidationErrors(prev => ({
            ...prev,
            [property]: error.errors[0].message
          }));
        }
      }
    }, 300),
    [selectedElement, onPropertyChange]
  );

  // Update local state when selection changes
  useEffect(() => {
    if (selectedElement) {
      setLocalProperties(selectedElement.data);
      setValidationErrors({});
    } else {
      setLocalProperties(null);
      setValidationErrors({});
    }
  }, [selectedElement]);

  if (!selectedElement || !localProperties) {
    return (
      <div className="w-80 h-full border-l border-gray-200 bg-white p-4 overflow-y-auto dark:border-gray-700 dark:bg-gray-900">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Select an element to view properties
        </p>
      </div>
    );
  }

  return (
    <div className="w-80 h-full border-l border-gray-200 bg-white p-4 overflow-y-auto dark:border-gray-700 dark:bg-gray-900">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-sm font-medium mb-2 flex items-center justify-between">
          {selectedNodeId ? "Table Properties" : "Relationship Properties"}
          {presence?.collaborators?.map(user => (
            <span
              key={user.id}
              className={cn(
                "w-2 h-2 rounded-full",
                user.id === presence.userId ? "bg-green-500" : "bg-gray-400"
              )}
              title={`${user.name} ${user.id === presence.userId ? "(you)" : ""}`}
            />
          ))}
        </h3>
      </div>

      {/* Table Properties */}
      {selectedNodeId && (
        <>
          <div className="mb-4">
            <Input
              label="Table Name"
              value={localProperties.name}
              error={validationErrors.name}
              disabled={isReadOnly}
              onChange={e => handlePropertyUpdate("name", e.target.value)}
            />
          </div>

          <div className="mb-4">
            <Input
              label="Schema"
              value={localProperties.schema}
              disabled={isReadOnly}
              onChange={e => handlePropertyUpdate("schema", e.target.value)}
            />
          </div>

          {/* Columns */}
          <div className="mb-4">
            <h4 className="text-sm font-medium mb-2">Columns</h4>
            <div className="properties-list h-[300px] overflow-auto">
              {rowVirtualizer.getVirtualItems().map(virtualRow => {
                const column = localProperties.columns[virtualRow.index];
                return (
                  <div
                    key={virtualRow.index}
                    className="py-2"
                    style={{
                      height: virtualRow.size,
                      transform: `translateY(${virtualRow.start}px)`
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <Input
                        value={column.name}
                        disabled={isReadOnly}
                        onChange={e => handlePropertyUpdate(
                          `columns.${virtualRow.index}.name`,
                          e.target.value
                        )}
                      />
                      <Select
                        value={column.type}
                        disabled={isReadOnly}
                        items={Object.values(ColumnType).flat().map(type => ({
                          value: type,
                          label: type
                        }))}
                        onValueChange={value => handlePropertyUpdate(
                          `columns.${virtualRow.index}.type`,
                          value
                        )}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Relationship Properties */}
      {selectedEdgeId && (
        <>
          <div className="mb-4">
            <Select
              label="Relationship Type"
              value={localProperties.type}
              disabled={isReadOnly}
              items={[
                { value: "one_to_one", label: "One-to-One" },
                { value: "one_to_many", label: "One-to-Many" },
                { value: "many_to_many", label: "Many-to-Many" }
              ]}
              onValueChange={value => handlePropertyUpdate("type", value)}
            />
          </div>

          <div className="mb-4">
            <Input
              label="Source Column"
              value={localProperties.sourceColumn}
              disabled={isReadOnly}
              onChange={e => handlePropertyUpdate("sourceColumn", e.target.value)}
            />
          </div>

          <div className="mb-4">
            <Input
              label="Target Column"
              value={localProperties.targetColumn}
              disabled={isReadOnly}
              onChange={e => handlePropertyUpdate("targetColumn", e.target.value)}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default PropertiesPanel;