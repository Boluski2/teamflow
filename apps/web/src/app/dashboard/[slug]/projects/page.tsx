import { notFound } from "next/navigation";

import { ensureUser } from "@/lib/auth/ensure-user";
import { listProjects } from "@/lib/projects/service";
import { getOrganizationBySlug } from "@/lib/organizations/get-organization-by-slug";
import { ProjectsView } from "@/components/projects/projects-view";

type ProjectsPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ProjectsPage({
  params,
}: ProjectsPageProps) {
  const { slug } = await params;

  const user = await ensureUser();
  const organization = await getOrganizationBySlug(slug, user.id);

  if (!organization) {
    notFound();
  }

  const projects = await listProjects(organization.id, user.id);

  return (
    <ProjectsView
      projects={projects}
      workspaceName={organization.name}
      organizationId={organization.id}
      canCreate={organization.role !== "viewer"}
      workspaceSlug={organization.slug}
    />
  );
}
