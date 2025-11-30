# Faxi Help Documentation

This directory contains user-facing help guides and documentation for Faxi features.

## Available Guides

### [Demo Guide](./demo-guide.md)
Comprehensive guide for using the Interactive Demo on the Faxi marketing website.

**Topics covered:**
- Getting started with the demo
- Three ways to try Faxi (Sample Faxes, Create Your Own, Upload File)
- Understanding results
- Common use cases
- Troubleshooting
- Tips for best results
- FAQ

**Target audience:** First-time users, potential customers, demo visitors

---

## Documentation Structure

Each help guide follows this structure:

1. **Overview** - What the feature does
2. **Getting Started** - How to access and begin using
3. **Step-by-Step Instructions** - Detailed walkthrough with screenshots
4. **Use Cases** - Real-world examples
5. **Troubleshooting** - Common issues and solutions
6. **Tips & Best Practices** - How to get the best results
7. **FAQ** - Frequently asked questions
8. **Technical Details** - For advanced users (optional)
9. **Support** - How to get help

---

## Screenshot Guidelines

All screenshots should:
- Be high resolution (minimum 1280x720)
- Use PNG format for better quality
- Show the feature in a clean, uncluttered state
- Include relevant UI elements and context
- Be captured in light mode (default theme)
- Have consistent browser chrome (or no chrome)

Screenshots are stored in `docs/screenshots/` and referenced in guides using:
```markdown
![Description](../screenshots/filename.png)
```

Or using placeholders for automated capture:
```markdown
<!-- SCREENSHOT:identifier -->
```

---

## Creating New Help Guides

To create a new help guide:

1. **Create the markdown file** in this directory:
   ```bash
   touch docs/help/feature-name-guide.md
   ```

2. **Follow the standard structure** (see above)

3. **Add screenshot placeholders**:
   ```markdown
   <!-- SCREENSHOT:feature-step-1 -->
   ```

4. **Capture screenshots** using one of these methods:
   - Manual: Use browser screenshot tools
   - Automated: Use the Auto-Docs MCP
   - Script: Create a custom capture script

5. **Update this README** to list the new guide

---

## Using Auto-Docs MCP for Documentation

The Auto-Docs MCP can automatically generate help documentation with screenshots:

### Generate Documentation for a Feature:
```
In Kiro IDE, ask:
"Generate documentation for the [feature-name] feature"
```

### Document a User Flow:
```
In Kiro IDE, ask:
"Document the user flow for [describe the goal]"
```

### Update All Documentation:
```
In Kiro IDE, ask:
"Update all help documentation with fresh screenshots"
```

The Auto-Docs MCP will:
- Navigate through the feature autonomously
- Capture screenshots at key steps
- Generate markdown documentation
- Save everything to the appropriate directories

---

## Maintenance

### When to Update Documentation:

- **UI Changes** - When the interface is redesigned or updated
- **New Features** - When functionality is added
- **Bug Fixes** - When behavior changes
- **User Feedback** - When users report confusion

### How to Update:

1. **Check freshness** using Auto-Docs MCP:
   ```
   "Check which help docs are outdated"
   ```

2. **Update specific guide**:
   - Edit the markdown file
   - Recapture affected screenshots
   - Test all links and references

3. **Bulk update** using Auto-Docs MCP:
   ```
   "Update all help documentation"
   ```

---

## Translation

Help guides should be available in multiple languages:

- **English** (en) - Primary language
- **Japanese** (ja) - Secondary language

To add translations:

1. Create language-specific directories:
   ```
   docs/help/en/
   docs/help/ja/
   ```

2. Translate markdown content

3. Use language-specific screenshots when UI text differs

4. Update navigation to include language selector

---

## Integration with Website

Help guides can be integrated into the marketing website:

### Option 1: Direct Link
Link to the markdown file in GitHub or docs site:
```html
<a href="https://docs.faxi.app/help/demo-guide">Demo Guide</a>
```

### Option 2: Embedded Content
Convert markdown to HTML and embed in Next.js pages:
```tsx
import { getHelpContent } from '@/lib/help';

export default function HelpPage() {
  const content = getHelpContent('demo-guide');
  return <div dangerouslySetInnerHTML={{ __html: content }} />;
}
```

### Option 3: Help Widget
Add a help button that opens guides in a modal or sidebar:
```tsx
<HelpButton guide="demo-guide" />
```

---

## Future Guides

Planned help documentation:

- [ ] **Getting Started Guide** - Overall introduction to Faxi
- [ ] **Email Management Guide** - How to send and manage emails via fax
- [ ] **Shopping Guide** - How to browse and order products
- [ ] **Payment Setup Guide** - How to register payment methods
- [ ] **Appointment Scheduling Guide** - How to book appointments
- [ ] **Profile Management Guide** - How to update user information
- [ ] **Troubleshooting Guide** - Common issues across all features
- [ ] **Admin Dashboard Guide** - For administrators and support staff

---

## Contributing

To contribute to help documentation:

1. **Identify gaps** - What's missing or unclear?
2. **Draft content** - Write clear, concise instructions
3. **Add screenshots** - Visual aids are essential
4. **Test with users** - Verify clarity and completeness
5. **Submit for review** - Get feedback before publishing

---

## Support

For questions about help documentation:
- **Email**: docs@faxi.app
- **Slack**: #documentation channel
- **GitHub**: Open an issue with label `documentation`

---

**Last Updated:** December 1, 2025  
**Maintained by:** Faxi Documentation Team

