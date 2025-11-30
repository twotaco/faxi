/**
 * App Discovery Service
 * 
 * Analyzes frontend codebase to understand app structure, enabling autonomous navigation.
 * Discovers routes, navigation components, and maps features to URLs.
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

export interface Route {
  path: string;
  filePath: string;
  name: string;
  params?: string[];
  metadata?: {
    title?: string;
    description?: string;
  };
}

export interface NavItem {
  label: string;
  href: string;
  children?: NavItem[];
}

export interface FeatureRouteMap {
  [featureName: string]: {
    routes: string[];
    entryPoint: string;
    relatedSpec?: string;
  };
}

export interface AppStructure {
  routes: Route[];
  navigation: NavItem[];
  features: FeatureRouteMap;
  baseUrl: string;
}

export interface DocumentationPlan {
  feature: string;
  steps: PlannedStep[];
  estimatedScreenshots: number;
}

export interface PlannedStep {
  order: number;
  description: string;
  url: string;
  actions: PlannedAction[];
  screenshotName: string;
}

export interface PlannedAction {
  type: 'click' | 'type' | 'select' | 'wait' | 'scroll';
  target: string;
  value?: string;
  reason: string;
}

class AppDiscoveryService {
  /**
   * Discover application structure by analyzing the codebase
   */
  async discoverStructure(frontendDir?: string): Promise<AppStructure> {
    // Auto-detect frontend directory if not provided
    const detectedDir = frontendDir || this.detectFrontendDirectory();

    // Find routes
    const routes = await this.findRoutes(detectedDir);

    // Find navigation
    const navigation = await this.findNavigation(detectedDir);

    // Map features to routes
    const features = await this.mapFeaturesToRoutes(routes);

    return {
      routes,
      navigation,
      features,
      baseUrl: 'http://localhost:3000', // Default, can be overridden
    };
  }

  /**
   * Detect frontend directory automatically
   */
  private detectFrontendDirectory(): string {
    const possibleDirs = [
      'marketing-website',
      'admin-dashboard',
      'frontend',
      'app',
      'src',
    ];

    for (const dir of possibleDirs) {
      if (fs.existsSync(dir)) {
        // Check if it has Next.js or React structure
        const hasAppDir = fs.existsSync(path.join(dir, 'app'));
        const hasPagesDir = fs.existsSync(path.join(dir, 'pages'));
        const hasPackageJson = fs.existsSync(path.join(dir, 'package.json'));

        if (hasAppDir || hasPagesDir || hasPackageJson) {
          return dir;
        }
      }
    }

    // Default to marketing-website if nothing found
    return 'marketing-website';
  }

  /**
   * Find routes from Next.js app router, pages, or React Router
   */
  async findRoutes(frontendDir: string): Promise<Route[]> {
    const routes: Route[] = [];

    // Check for Next.js App Router (app directory)
    const appDir = path.join(frontendDir, 'app');
    if (fs.existsSync(appDir)) {
      const appRoutes = await this.findNextJsAppRoutes(appDir);
      routes.push(...appRoutes);
    }

    // Check for Next.js Pages Router (pages directory)
    const pagesDir = path.join(frontendDir, 'pages');
    if (fs.existsSync(pagesDir)) {
      const pageRoutes = await this.findNextJsPagesRoutes(pagesDir);
      routes.push(...pageRoutes);
    }

    return routes;
  }

  /**
   * Find Next.js App Router routes
   */
  private async findNextJsAppRoutes(appDir: string): Promise<Route[]> {
    const routes: Route[] = [];

    // Find all page.tsx and page.js files
    const pageFiles = await glob('**/page.{tsx,ts,jsx,js}', {
      cwd: appDir,
      ignore: ['node_modules/**', '.next/**'],
    });

    for (const pageFile of pageFiles) {
      const fullPath = path.join(appDir, pageFile);
      const routePath = this.convertFilePathToRoute(pageFile);

      // Extract metadata from the file
      const metadata = await this.extractMetadata(fullPath);

      // Extract dynamic params
      const params = this.extractDynamicParams(routePath);

      routes.push({
        path: routePath,
        filePath: fullPath,
        name: this.generateRouteName(routePath),
        params,
        metadata,
      });
    }

    return routes;
  }

  /**
   * Find Next.js Pages Router routes
   */
  private async findNextJsPagesRoutes(pagesDir: string): Promise<Route[]> {
    const routes: Route[] = [];

    // Find all page files
    const pageFiles = await glob('**/*.{tsx,ts,jsx,js}', {
      cwd: pagesDir,
      ignore: ['node_modules/**', '_app.*', '_document.*', 'api/**'],
    });

    for (const pageFile of pageFiles) {
      const fullPath = path.join(pagesDir, pageFile);
      const routePath = this.convertFilePathToRoute(pageFile);

      // Extract metadata
      const metadata = await this.extractMetadata(fullPath);

      // Extract dynamic params
      const params = this.extractDynamicParams(routePath);

      routes.push({
        path: routePath,
        filePath: fullPath,
        name: this.generateRouteName(routePath),
        params,
        metadata,
      });
    }

    return routes;
  }

  /**
   * Convert file path to route path
   */
  private convertFilePathToRoute(filePath: string): string {
    // Remove file extension
    let routePath = filePath.replace(/\.(tsx|ts|jsx|js)$/, '');

    // Remove /page suffix (App Router)
    routePath = routePath.replace(/\/page$/, '');

    // Remove /index suffix (Pages Router)
    routePath = routePath.replace(/\/index$/, '');

    // Handle [locale] or other bracketed segments
    routePath = routePath.replace(/\[([^\]]+)\]/g, ':$1');

    // Ensure leading slash
    if (!routePath.startsWith('/')) {
      routePath = '/' + routePath;
    }

    // Handle root index
    if (routePath === '/index') {
      routePath = '/';
    }

    return routePath;
  }

  /**
   * Extract dynamic parameters from route path
   */
  private extractDynamicParams(routePath: string): string[] | undefined {
    const params: string[] = [];
    const paramRegex = /:([^/]+)/g;
    let match;

    while ((match = paramRegex.exec(routePath)) !== null) {
      params.push(match[1]);
    }

    return params.length > 0 ? params : undefined;
  }

  /**
   * Generate a human-readable name for a route
   */
  private generateRouteName(routePath: string): string {
    // Remove leading slash and dynamic params
    let name = routePath.replace(/^\//, '').replace(/:[^/]+/g, '');

    // Replace slashes with spaces
    name = name.replace(/\//g, ' ');

    // Capitalize words
    name = name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    // Handle root
    if (!name) {
      name = 'Home';
    }

    return name;
  }

  /**
   * Extract metadata from a page file
   */
  private async extractMetadata(filePath: string): Promise<{ title?: string; description?: string }> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');

      // Look for metadata export (Next.js 13+)
      const metadataMatch = content.match(/export\s+const\s+metadata\s*=\s*{([^}]+)}/s);
      if (metadataMatch) {
        const metadataContent = metadataMatch[1];
        const titleMatch = metadataContent.match(/title:\s*['"]([^'"]+)['"]/);
        const descMatch = metadataContent.match(/description:\s*['"]([^'"]+)['"]/);

        return {
          title: titleMatch ? titleMatch[1] : undefined,
          description: descMatch ? descMatch[1] : undefined,
        };
      }

      // Look for Head component or title tags
      const titleMatch = content.match(/<title>([^<]+)<\/title>/);
      if (titleMatch) {
        return { title: titleMatch[1] };
      }

      return {};
    } catch (error) {
      return {};
    }
  }

  /**
   * Find navigation components and extract links
   */
  async findNavigation(frontendDir: string): Promise<NavItem[]> {
    const navigation: NavItem[] = [];

    try {
      // Look for common navigation component patterns
      const navFiles = await glob('**/components/**/{nav,header,sidebar,menu}*.{tsx,ts,jsx,js}', {
        cwd: frontendDir,
        ignore: ['node_modules/**', '.next/**'],
        nocase: true,
      });

      for (const navFile of navFiles) {
        const fullPath = path.join(frontendDir, navFile);
        const navItems = await this.extractNavigationFromFile(fullPath);
        navigation.push(...navItems);
      }

      // Remove duplicates
      return this.deduplicateNavItems(navigation);
    } catch (error) {
      // If navigation extraction fails, return empty array
      return [];
    }
  }

  /**
   * Extract navigation items from a file
   */
  private async extractNavigationFromFile(filePath: string): Promise<NavItem[]> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const navItems: NavItem[] = [];

      // Look for Link components with href
      const linkRegex = /<Link\s+[^>]*href=["']([^"']+)["'][^>]*>([^<]+)<\/Link>/g;
      let match;

      while ((match = linkRegex.exec(content)) !== null) {
        const href = match[1];
        const label = match[2].trim();

        if (href && label && !href.startsWith('#')) {
          navItems.push({ label, href });
        }
      }

      // Look for anchor tags
      const anchorRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/g;
      while ((match = anchorRegex.exec(content)) !== null) {
        const href = match[1];
        const label = match[2].trim();

        if (href && label && !href.startsWith('#') && !href.startsWith('http')) {
          navItems.push({ label, href });
        }
      }

      return navItems;
    } catch (error) {
      return [];
    }
  }

  /**
   * Remove duplicate navigation items
   */
  private deduplicateNavItems(items: NavItem[]): NavItem[] {
    const seen = new Set<string>();
    return items.filter(item => {
      const key = `${item.label}:${item.href}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Map features to routes using specs and code analysis
   */
  async mapFeaturesToRoutes(routes: Route[]): Promise<FeatureRouteMap> {
    const featureMap: FeatureRouteMap = {};

    // Check if .kiro/specs exists
    const specsDir = '.kiro/specs';
    if (!fs.existsSync(specsDir)) {
      return featureMap;
    }

    // Get all spec directories
    const specDirs = fs.readdirSync(specsDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    // Map each spec to routes
    for (const specName of specDirs) {
      const relatedRoutes = routes.filter(route => {
        // Match by keywords in route path or name
        const keywords = specName.toLowerCase().split('-');
        const routeLower = (route.path + ' ' + route.name).toLowerCase();
        return keywords.some(keyword => routeLower.includes(keyword));
      });

      if (relatedRoutes.length > 0) {
        featureMap[specName] = {
          routes: relatedRoutes.map(r => r.path),
          entryPoint: relatedRoutes[0].path,
          relatedSpec: path.join(specsDir, specName),
        };
      }
    }

    return featureMap;
  }

  /**
   * Plan a documentation flow for a feature
   */
  async planDocumentationFlow(
    feature: string,
    appStructure: AppStructure
  ): Promise<DocumentationPlan> {
    // Find routes related to this feature
    const featureInfo = appStructure.features[feature];

    if (!featureInfo) {
      // If no feature mapping, try to find routes by keyword
      const keywords = feature.toLowerCase().split('-');
      const relatedRoutes = appStructure.routes.filter(route => {
        const routeLower = (route.path + ' ' + route.name).toLowerCase();
        return keywords.some(keyword => routeLower.includes(keyword));
      });

      if (relatedRoutes.length === 0) {
        throw new Error(
          `No routes found for feature "${feature}". ` +
          `Available features: ${Object.keys(appStructure.features).join(', ')}`
        );
      }

      // Create a simple plan with the found routes
      const steps: PlannedStep[] = relatedRoutes.map((route, index) => ({
        order: index,
        description: `Navigate to ${route.name}`,
        url: route.path,
        actions: [],
        screenshotName: `${feature}-step-${index + 1}`,
      }));

      return {
        feature,
        steps,
        estimatedScreenshots: steps.length,
      };
    }

    // Create a plan based on the feature's routes
    const steps: PlannedStep[] = featureInfo.routes.map((routePath, index) => {
      const route = appStructure.routes.find(r => r.path === routePath);
      return {
        order: index,
        description: route ? `Navigate to ${route.name}` : `Navigate to ${routePath}`,
        url: routePath,
        actions: [],
        screenshotName: `${feature}-step-${index + 1}`,
      };
    });

    return {
      feature,
      steps,
      estimatedScreenshots: steps.length,
    };
  }
}

// Export singleton instance
export const appDiscoveryService = new AppDiscoveryService();
