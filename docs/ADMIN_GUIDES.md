# Admin Dashboard Guides

## Overview

The admin dashboard includes an internal documentation system at `/guides` for operational and technical documentation. This is separate from the end-user help documentation on the marketing website.

## Purpose

- **Audience**: Internal team members, developers, and operations staff
- **Content**: Technical guides, deployment procedures, troubleshooting, and system administration
- **Location**: `admin-dashboard/app/(dashboard)/guides/`

## Structure

```
admin-dashboard/app/(dashboard)/guides/
├── page.tsx                    # Guides index page
├── deployment/
│   └── page.tsx               # Deployment guide
├── security/
│   └── page.tsx               # Security & secrets guide (TODO)
├── database/
│   └── page.tsx               # Database operations guide (TODO)
├── troubleshooting/
│   └── page.tsx               # Troubleshooting guide (TODO)
└── development/
    └── page.tsx               # Development setup guide (TODO)
```

## Navigation

The Guides section is accessible from the admin dashboard sidebar with a BookOpen icon. It appears between "Audit Logs" and "Configuration" in the navigation menu.

## Content Guidelines

### What Belongs in Admin Guides

✅ **Include:**
- Deployment procedures and orchestration
- Database migration instructions
- Security and secrets management
- System configuration and environment variables
- Troubleshooting internal services
- Development environment setup
- MCP server configuration
- Infrastructure operations (Docker, Kubernetes, AWS)
- Monitoring and alerting setup
- Backup and disaster recovery procedures

❌ **Don't Include:**
- End-user fax instructions (belongs in marketing website help)
- Product features for elderly users
- Public-facing documentation
- Marketing content

### Writing Style

- **Technical but clear**: Assume technical knowledge but explain complex concepts
- **Step-by-step**: Use numbered steps for procedures
- **Code examples**: Include actual commands and configuration snippets
- **Visual hierarchy**: Use headings, lists, and callouts effectively
- **Cross-references**: Link to related guides

## Components Used

### Layout Components
- Standard dashboard layout with sidebar and breadcrumbs
- Responsive design for desktop and tablet

### UI Elements
- **Icons**: Lucide React icons for visual clarity
- **Cards**: White background with border for content sections
- **Code blocks**: Gray background for commands and configuration
- **Callouts**: Colored backgrounds for warnings, tips, and important notes
  - Blue: Information
  - Green: Success/confirmation
  - Yellow: Warnings
  - Red: Critical issues

### Color Coding
- **Blue** (`border-blue-500`): Standard steps and information
- **Green** (`border-green-500`): Success states and verification
- **Yellow** (`border-yellow-500`): Warnings and cautions
- **Red** (`border-red-500`): Critical issues and rollback procedures

## Adding New Guides

1. Create a new directory under `admin-dashboard/app/(dashboard)/guides/`
2. Add a `page.tsx` file with the guide content
3. Update the guides index page (`guides/page.tsx`) to include the new guide
4. Follow the existing structure and styling patterns
5. Include:
   - Back navigation link
   - Clear title and description
   - Logical sections with headings
   - Code examples where applicable
   - Related resources section at the bottom

## Example Structure

```tsx
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function GuidePage() {
  return (
    <div className="max-w-4xl space-y-8">
      {/* Header */}
      <div>
        <Link href="/guides" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Guides
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Guide Title</h1>
        <p className="mt-2 text-gray-600">Guide description</p>
      </div>

      {/* Content sections */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Section Title</h2>
        {/* Content */}
      </section>

      {/* Related resources */}
      <section className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-blue-900 mb-3">Related Resources</h2>
        {/* Links */}
      </section>
    </div>
  );
}
```

## Maintenance

- **Review regularly**: Update guides when features or procedures change
- **Version control**: Document which version of the system the guide applies to
- **Feedback loop**: Encourage team members to suggest improvements
- **Keep current**: Remove outdated information promptly

## Integration with Code Changes

When making changes to internal systems (deployment, MCP servers, infrastructure), consider:

1. Does this change affect existing procedures?
2. Should a new guide be created?
3. Do existing guides need updates?
4. Are there new troubleshooting scenarios to document?

The deployment orchestrator change that added TEST_MODE support is a good example - it's now documented in the Deployment Guide under "Environment-Specific Notes > Development".

## Future Enhancements

- [ ] Add search functionality to guides
- [ ] Include video walkthroughs for complex procedures
- [ ] Add interactive examples or sandboxes
- [ ] Create a changelog for guide updates
- [ ] Add printable PDF versions
- [ ] Include architecture diagrams
- [ ] Add API reference documentation
