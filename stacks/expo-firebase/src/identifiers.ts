export interface ProjectIdentifiers {
  slug: string
  scheme: string
  nativeName: string
  bundleIdentifier: string
  emulatorProjectId: string
}

export function projectIdentifiers(projectName: string): ProjectIdentifiers {
  const slug =
    projectName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'my-app'
  const nativeName = slug.replace(/[^a-z0-9]/g, '') || 'myapp'

  return {
    slug,
    scheme: slug,
    nativeName,
    bundleIdentifier: `com.${nativeName}.app`,
    emulatorProjectId: `demo-${slug}`,
  }
}
