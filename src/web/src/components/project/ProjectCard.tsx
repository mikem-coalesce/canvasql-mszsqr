import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter
} from '../ui/card';
import type { Project } from '../../types/project.types';
import { useProjectStore } from '../../store/project.store';

// Security level badge colors mapping
const SECURITY_LEVEL_STYLES = {
  PUBLIC: 'bg-green-100 text-green-800',
  INTERNAL: 'bg-blue-100 text-blue-800',
  SENSITIVE: 'bg-yellow-100 text-yellow-800',
  CRITICAL: 'bg-red-100 text-red-800'
} as const;

interface ProjectCardProps {
  project: Project;
  onDelete?: (id: string) => Promise<void>;
}

/**
 * A secure and accessible card component for displaying project information
 * Implements shadcn/ui design system with enhanced security features
 */
export const ProjectCard: React.FC<ProjectCardProps> = React.memo(({ 
  project,
  onDelete 
}) => {
  const navigate = useNavigate();
  const { setCurrentProject, validateProjectAccess } = useProjectStore();

  // Secure project click handler with access validation
  const handleProjectClick = async (e: React.MouseEvent) => {
    try {
      e.preventDefault();
      
      // Validate user access before navigation
      const hasAccess = await validateProjectAccess(project.id);
      if (!hasAccess) {
        throw new Error('Insufficient permissions to access project');
      }

      // Set current project and navigate
      setCurrentProject(project);
      navigate(`/projects/${project.id}`);

    } catch (error) {
      console.error('Project access error:', error);
      // Error handling should be implemented based on UI requirements
    }
  };

  // Secure delete handler with confirmation
  const handleDeleteClick = async (e: React.MouseEvent) => {
    try {
      e.stopPropagation();
      
      if (!onDelete) return;

      // Security confirmation for deletion
      const confirmed = window.confirm(
        'Are you sure you want to delete this project? This action cannot be undone.'
      );

      if (confirmed) {
        await onDelete(project.id);
      }

    } catch (error) {
      console.error('Project deletion error:', error);
      // Error handling should be implemented based on UI requirements
    }
  };

  return (
    <Card
      role="article"
      tabIndex={0}
      onClick={handleProjectClick}
      onKeyPress={(e) => e.key === 'Enter' && handleProjectClick(e as any)}
      className="transition-all hover:shadow-md hover:scale-[1.02] cursor-pointer"
      data-project-id={project.id}
      data-security-level={project.securityLevel}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-semibold truncate" title={project.name}>
            {project.name}
          </CardTitle>
          <span 
            className={`px-2 py-1 text-xs font-medium rounded-full ${
              SECURITY_LEVEL_STYLES[project.securityLevel]
            }`}
            title={`Security Level: ${project.securityLevel}`}
          >
            {project.securityLevel}
          </span>
        </div>
        <CardDescription className="line-clamp-2" title={project.description}>
          {project.description}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>SQL Dialect:</span>
            <span className="font-medium">{project.metadata.sqlDialect}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Version History:</span>
            <span className="font-medium">
              {project.metadata.versionHistory ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          {project.metadata.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {project.metadata.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 text-xs bg-muted rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Created: {format(new Date(project.createdAt), 'MMM d, yyyy')}
        </span>
        {onDelete && (
          <button
            type="button"
            onClick={handleDeleteClick}
            className="text-destructive hover:text-destructive/80 transition-colors"
            aria-label={`Delete project: ${project.name}`}
          >
            Delete
          </button>
        )}
      </CardFooter>
    </Card>
  );
});

ProjectCard.displayName = 'ProjectCard';