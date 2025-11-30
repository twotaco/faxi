/**
 * Doc Generator Service
 * 
 * Generates markdown documentation from execution results and screenshots.
 * Preserves manual sections marked with special comments.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { ExecutionResult, ScreenshotResult } from './autonomousNavigatorService.js';

export interface ManualSection {
  startLine: number;
  endLine: number;
  content: string;
}

class DocGeneratorService {
  /**
   * Generate complete help documentation from execution result
   */
  generateHelpDoc(
    feature: string,
    spec: any | null,
    executionResult: ExecutionResult
  ): string {
    const sections: string[] = [];

    // Title
    sections.push(`# ${this.formatFeatureName(feature)}`);
    sections.push('');

    // Feature overview from spec
    if (spec) {
      sections.push('## Overview');
      sections.push('');
      sections.push(spec.introduction || `This guide explains how to use the ${feature} feature.`);
      sections.push('');
    }

    // Step-by-step instructions with screenshots
    sections.push('## How to Use');
    sections.push('');
    sections.push(this.generateSteps(executionResult.screenshots));
    sections.push('');

    // Troubleshooting section
    sections.push('## Troubleshooting');
    sections.push('');
    sections.push(this.generateTroubleshooting(feature));
    sections.push('');

    // Footer
    sections.push('---');
    sections.push('');
    sections.push('*This documentation was automatically generated. Last updated: ' + new Date().toLocaleDateString() + '*');
    sections.push('');

    return sections.join('\n');
  }

  /**
   * Format feature name for display
   */
  private formatFeatureName(feature: string): string {
    return feature
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Generate step-by-step instructions from screenshots
   */
  generateSteps(screenshots: ScreenshotResult[]): string {
    if (screenshots.length === 0) {
      return 'No steps available.';
    }

    const steps: string[] = [];

    screenshots.forEach((screenshot, index) => {
      const stepNumber = index + 1;
      const description = screenshot.stepDescription || `Step ${stepNumber}`;

      steps.push(`### Step ${stepNumber}: ${description}`);
      steps.push('');

      // Add screenshot
      const relativePath = this.getRelativeScreenshotPath(screenshot.path);
      steps.push(`![${description}](${relativePath})`);
      steps.push('');
    });

    return steps.join('\n');
  }

  /**
   * Get relative path for screenshot from docs/help/ to docs/screenshots/
   */
  private getRelativeScreenshotPath(absolutePath: string): string {
    // Extract just the filename
    const filename = path.basename(absolutePath);
    // Return relative path from docs/help/ to docs/screenshots/
    return `../screenshots/${filename}`;
  }

  /**
   * Generate troubleshooting section from common issues
   */
  generateTroubleshooting(feature: string): string {
    const troubleshooting: string[] = [];

    troubleshooting.push('### Common Issues');
    troubleshooting.push('');
    troubleshooting.push('**Page not loading?**');
    troubleshooting.push('- Check your internet connection');
    troubleshooting.push('- Try refreshing the page');
    troubleshooting.push('- Clear your browser cache');
    troubleshooting.push('');
    troubleshooting.push('**Feature not working as expected?**');
    troubleshooting.push('- Make sure you\'re logged in');
    troubleshooting.push('- Check that you have the necessary permissions');
    troubleshooting.push('- Contact support if the issue persists');
    troubleshooting.push('');

    return troubleshooting.join('\n');
  }

  /**
   * Update existing doc with new content
   */
  updateDoc(
    existingContent: string,
    newContent: string
  ): string {
    // Find manual sections
    const manualSections = this.findManualSections(existingContent);

    if (manualSections.length === 0) {
      // No manual sections, just return new content
      return newContent;
    }

    // Merge manual sections into new content
    let updatedContent = newContent;

    for (const section of manualSections) {
      // Add manual section at the end before the footer
      const footerIndex = updatedContent.lastIndexOf('---');
      if (footerIndex !== -1) {
        updatedContent =
          updatedContent.slice(0, footerIndex) +
          '\n## Manual Section\n\n' +
          '<!-- MANUAL -->\n' +
          section.content +
          '\n<!-- /MANUAL -->\n\n' +
          updatedContent.slice(footerIndex);
      } else {
        // No footer, add at end
        updatedContent +=
          '\n\n## Manual Section\n\n' +
          '<!-- MANUAL -->\n' +
          section.content +
          '\n<!-- /MANUAL -->\n';
      }
    }

    return updatedContent;
  }

  /**
   * Find manual sections that should be preserved
   */
  findManualSections(content: string): ManualSection[] {
    const sections: ManualSection[] = [];
    const lines = content.split('\n');

    let inManualSection = false;
    let sectionStart = -1;
    let sectionContent: string[] = [];

    lines.forEach((line, index) => {
      if (line.trim() === '<!-- MANUAL -->') {
        inManualSection = true;
        sectionStart = index;
        sectionContent = [];
      } else if (line.trim() === '<!-- /MANUAL -->') {
        if (inManualSection) {
          sections.push({
            startLine: sectionStart,
            endLine: index,
            content: sectionContent.join('\n'),
          });
        }
        inManualSection = false;
      } else if (inManualSection) {
        sectionContent.push(line);
      }
    });

    return sections;
  }

  /**
   * Save documentation to file
   */
  saveDoc(content: string, outputPath: string): void {
    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write file
    fs.writeFileSync(outputPath, content, 'utf-8');
  }

  /**
   * Read existing documentation if it exists
   */
  readExistingDoc(filePath: string): string | null {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8');
    }
    return null;
  }
}

// Export singleton instance
export const docGeneratorService = new DocGeneratorService();
