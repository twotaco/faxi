# Screenshots for Demo Guide

This directory contains screenshots for the Faxi Interactive Demo user guide.

## Required Screenshots

To complete the demo guide documentation, capture the following screenshots:

### 1. Demo Homepage
**Filename:** `demo-homepage.png`
**URL:** http://localhost:4003/en/demo
**Description:** Initial view of the demo page showing header, mode toggle buttons, and sample faxes gallery

### 2. Sample Faxes Gallery
**Filename:** `sample-faxes-gallery.png`
**URL:** http://localhost:4003/en/demo (Sample Faxes mode)
**Description:** Grid view of all available sample fax fixtures with thumbnails

### 3. Sample Fax Preview Dialog
**Filename:** `sample-fax-preview-dialog.png`
**URL:** http://localhost:4003/en/demo (click any sample fax)
**Description:** Modal dialog showing enlarged fax preview with description and action buttons

### 4. Processing Status
**Filename:** `processing-status.png`
**URL:** http://localhost:4003/en/demo (during processing)
**Description:** Loading indicator with status message while fax is being processed

### 5. Results Display
**Filename:** `results-display.png`
**URL:** http://localhost:4003/en/demo (after processing)
**Description:** Complete results showing intent, extracted info, confidence, and planned actions

### 6. Detailed Results
**Filename:** `detailed-results.png`
**URL:** http://localhost:4003/en/demo (after processing, scrolled to show all details)
**Description:** Full results panel with all sections visible

### 7. Create Your Own Mode
**Filename:** `create-your-own-mode.png`
**URL:** http://localhost:4003/en/demo (Create Your Own mode)
**Description:** Drawing canvas interface for creating custom faxes

### 8. Custom Fax Canvas
**Filename:** `custom-fax-canvas.png`
**URL:** http://localhost:4003/en/demo (Create Your Own mode with sample drawing)
**Description:** Canvas with example handwritten text or drawing

### 9. Upload File Mode
**Filename:** `upload-file-mode.png`
**URL:** http://localhost:4003/en/demo (Upload File mode)
**Description:** File upload interface showing drag-and-drop area

### 10. File Upload Area
**Filename:** `file-upload-area.png`
**URL:** http://localhost:4003/en/demo (Upload File mode, hover state)
**Description:** Upload area with hover effect or file selected

## How to Capture Screenshots

### Option 1: Manual Capture

1. Start the marketing website:
   ```bash
   cd marketing-website
   npm run dev
   ```

2. Open http://localhost:4003/en/demo in your browser

3. Use browser screenshot tools or:
   - macOS: Cmd + Shift + 4
   - Windows: Windows + Shift + S
   - Linux: Use screenshot tool

4. Save screenshots to this directory with the filenames listed above

### Option 2: Using Auto-Docs MCP (Automated)

Once the marketing website is running, you can use the Auto-Docs MCP to automatically capture screenshots:

1. Ensure the marketing website is running on port 4003

2. In Kiro IDE, ask:
   ```
   Generate documentation for the demo feature with screenshots
   ```

3. Or use the MCP tool directly:
   ```
   document_user_flow with goal "show how to use the demo page"
   ```

The Auto-Docs MCP will:
- Navigate through the demo page
- Capture screenshots at each step
- Save them to this directory
- Update the demo-guide.md with correct image paths

## Screenshot Guidelines

- **Resolution:** Minimum 1280x720, recommended 1920x1080
- **Format:** PNG (for better quality) or JPG
- **Browser:** Use Chrome or Firefox for consistency
- **Window Size:** Full screen or at least 1280px wide
- **Clean State:** Clear browser cache, use incognito mode
- **Annotations:** No annotations needed (guide provides context)
- **Timing:** Capture at the right moment (e.g., after animations complete)

## Updating the Guide

After capturing screenshots, the guide will automatically display them. The placeholders in `demo-guide.md` are:

```markdown
<!-- SCREENSHOT:demo-homepage -->
<!-- SCREENSHOT:sample-faxes-gallery -->
<!-- SCREENSHOT:sample-fax-preview-dialog -->
<!-- SCREENSHOT:processing-status -->
<!-- SCREENSHOT:results-display -->
<!-- SCREENSHOT:detailed-results -->
<!-- SCREENSHOT:create-your-own-mode -->
<!-- SCREENSHOT:custom-fax-canvas -->
<!-- SCREENSHOT:upload-file-mode -->
<!-- SCREENSHOT:file-upload-area -->
```

These will be replaced with actual image references once screenshots are captured.

