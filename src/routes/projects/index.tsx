import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

export const Route = createFileRoute('/projects/')({
  component: ProjectsPage,
})

function ProjectsPage() {
  const projects = useQuery(api.projects.getProjects)
  const createProject = useMutation(api.projects.createProject)
  const [isCreating, setIsCreating] = useState(false)
  const [name, setName] = useState('')
  const [domain, setDomain] = useState('')

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !domain) return

    try {
      await createProject({ name, domain })
      setName('')
      setDomain('')
      setIsCreating(false)
    } catch (error) {
      console.error('Error creating project:', error)
    }
  }

  return (
    <div className="container mx-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="text-muted-foreground mt-2">
            Manage your attribution tracking projects
          </p>
        </div>
        <Button onClick={() => setIsCreating(true)}>Create Project</Button>
      </div>

      {isCreating && (
        <div className="mb-8 p-6 border rounded-lg bg-card">
          <h2 className="text-xl font-semibold mb-4">Create New Project</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Project Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                placeholder="My Marketing Campaign"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Domain</label>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                placeholder="example.com"
                required
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit">Create</Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreating(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {projects === undefined ? (
        <div>Loading projects...</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-card">
          <p className="text-muted-foreground mb-4">
            No projects yet. Create your first project to start tracking
            attribution.
          </p>
          <Button onClick={() => setIsCreating(true)}>Create Project</Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link
              key={project._id}
              to="/projects/$projectId"
              params={{ projectId: project._id }}
              className="block"
            >
              <div className="p-6 border rounded-lg bg-card text-card-foreground hover:border-primary transition-colors cursor-pointer">
                <h3 className="text-xl font-semibold mb-2">{project.name}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {project.domain}
                </p>
                <div className="text-xs font-mono bg-muted p-2 rounded overflow-x-auto">
                  {project.apiKey}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
