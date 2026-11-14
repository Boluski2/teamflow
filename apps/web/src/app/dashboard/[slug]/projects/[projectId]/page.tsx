import { notFound } from "next/navigation";

import { ensureUser } from "@/lib/auth/ensure-user";
import { getOrganizationBySlug } from "@/lib/organizations/get-organization-by-slug";
import { getProject } from "@/lib/projects/service";
import { ProjectDetailsView } from "@/components/projects/project-details-view";
import type { OrganizationRole } from "@/lib/organizations/authorization";



type ProjectDetailsPageProps = {
  params: Promise<{
    slug: string;
    projectId: string;
  }>;
};

export default async function ProjectDetailsPage({
  params,
}: ProjectDetailsPageProps) {
  const { slug, projectId } = await params;

  const user = await ensureUser();

  const organization = await getOrganizationBySlug(slug, user.id);

  if (!organization) {
    notFound();
  }

  const project = await getProject(
    organization.id,
    projectId,
    user.id,
  );

  if (!project) {
    notFound();
  }

  return (
 <ProjectDetailsView
  project={project}
  workspaceName={organization.name}
  workspaceSlug={organization.slug}
  currentUserId={user.id}
  currentUserRole={organization.role as OrganizationRole}
  canEdit={organization.role === "owner" || organization.role === "admin"}
  canArchive={organization.role === "owner" || organization.role === "admin"}
  canUpdateTasks={organization.role !== "viewer"}
  canCreateTasks={organization.role !== "viewer"}
  canDeleteTasks={
    organization.role === "owner" || organization.role === "admin"
  }
/>
  );
}
