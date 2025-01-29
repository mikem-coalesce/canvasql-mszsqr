/**
 * @fileoverview A secure and accessible workspace card component with role-based access control
 * and data classification features.
 * @version 1.0.0
 */

import * as React from 'react';
import { format } from 'date-fns'; // v2.30.0
import { useAuditLog } from '@internal/audit'; // v1.0.0
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/card';
import type { Workspace, WorkspaceRole } from '../../types/workspace.types';
import { useWorkspaceStore } from '../../store/workspace.store';

/**
 * Props interface for the WorkspaceCard component with security features
 */
interface WorkspaceCardProps {
  workspace: Workspace;
  userRole: WorkspaceRole;
  className?: string;
}

/**
 * A secure and accessible card component for displaying workspace information
 * with role-based access control and data classification features.
 */
export const WorkspaceCard: React.FC<WorkspaceCardProps> = ({
  workspace,
  userRole,
  className
}) => {
  const { setCurrentWorkspace } = useWorkspaceStore();
  const auditLog = useAuditLog();

  /**
   * Securely handles workspace selection with role validation and audit logging
   */
  const handleWorkspaceSelect = React.useCallback(async (
    event: React.MouseEvent
  ) => {
    event.preventDefault();

    try {
      // Log access attempt
      await auditLog.log({
        action: 'workspace.access.attempt',
        resourceId: workspace.id,
        userRole,
        metadata: {
          workspaceName: workspace.name,
          securityLevel: workspace.securityLevel
        }
      });

      // Set selected workspace
      await setCurrentWorkspace(workspace, {
        userId: workspace.ownerId,
        role: userRole,
        clearanceLevel: workspace.securityLevel
      });

      // Log successful access
      await auditLog.log({
        action: 'workspace.access.success',
        resourceId: workspace.id,
        userRole
      });

    } catch (error) {
      // Log access failure
      await auditLog.log({
        action: 'workspace.access.failure',
        resourceId: workspace.id,
        userRole,
        error
      });
      console.error('Workspace access error:', error);
    }
  }, [workspace, userRole, setCurrentWorkspace, auditLog]);

  /**
   * Renders the security classification badge
   */
  const SecurityBadge: React.FC = () => (
    <span
      className={`px-2 py-1 text-xs font-medium rounded-full ${
        workspace.securityLevel === 'CRITICAL' 
          ? 'bg-red-100 text-red-800'
          : workspace.securityLevel === 'SENSITIVE'
          ? 'bg-orange-100 text-orange-800'
          : workspace.securityLevel === 'INTERNAL'
          ? 'bg-blue-100 text-blue-800'
          : 'bg-green-100 text-green-800'
      }`}
      role="status"
      aria-label={`Security Level: ${workspace.securityLevel}`}
    >
      {workspace.securityLevel}
    </span>
  );

  return (
    <Card
      className={`relative hover:shadow-md transition-shadow ${className}`}
      onClick={handleWorkspaceSelect}
      role="button"
      tabIndex={0}
      aria-label={`Select workspace: ${workspace.name}`}
      data-security-level={workspace.securityLevel}
      data-user-role={userRole}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-semibold truncate">
            {workspace.name}
          </CardTitle>
          <SecurityBadge />
        </div>
        <CardDescription>
          Created {format(new Date(workspace.createdAt), 'PPP')}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="inline font-medium">Owner: </dt>
            <dd className="inline ml-1">{workspace.ownerId}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Projects: </dt>
            <dd className="inline ml-1">
              {workspace.settings.maxProjects} maximum
            </dd>
          </div>
          <div>
            <dt className="inline font-medium">MFA Required: </dt>
            <dd className="inline ml-1">
              {workspace.settings.requireMfa ? 'Yes' : 'No'}
            </dd>
          </div>
        </dl>
      </CardContent>

      <CardFooter className="text-sm text-gray-500">
        <div className="flex items-center justify-between w-full">
          <span>
            Last accessed: {format(new Date(workspace.lastAccessedAt), 'PPp')}
          </span>
          <span className="font-medium">
            Your role: {userRole}
          </span>
        </div>
      </CardFooter>
    </Card>
  );
};

// Add display name for debugging
WorkspaceCard.displayName = 'WorkspaceCard';

// Default export
export default WorkspaceCard;