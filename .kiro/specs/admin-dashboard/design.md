# Admin Dashboard Design Document

## Overview

The Faxi Admin Dashboard is a modern, real-time web application built with Next.js and React that provides comprehensive monitoring, management, and operational capabilities for the Faxi Core System. The dashboard will be deployed at `app.faxi.jp` and communicate with the Faxi Core System API at `api.faxi.jp`.

### Key Design Principles

1. **Real-Time First**: Use Server-Sent Events (SSE) for live updates without polling
2. **Performance**: Optimize for fast initial load and smooth interactions
3. **Security**: Implement robust authentication and role-based access control
4. **Usability**: Intuitive interface requiring minimal training
5. **Scalability**: Handle growing data volumes without performance degradation
6. **Accessibility**: WCAG 2.1 AA compliant for inclusive access

### Technology Stack

**Frontend:**
- **Framework**: Next.js 14 (App Router) with React 18
- **Language**: TypeScript for type safety
- **Styling**: Tailwind CSS for utility-first styling
- **UI Components**: shadcn/ui for consistent, accessible components
- **State Management**: React Query (TanStack Query) for server state
- **Charts**: Recharts for data visualization
- **Real-Time**: EventSource API for Server-Sent Events
- **Forms**: React Hook Form with Zod validation
- **Tables**: TanStack Table for advanced data grids

**Backend API Extensions:**
- **Authentication**: JWT tokens with refresh token rotation
- **Real-Time**: SSE endpoints for live metrics and alerts
- **API Routes**: RESTful endpoints for admin operations
- **Database**: Extend existing PostgreSQL schema for admin users

**Deployment:**
- **Hosting**: Vercel or self-hosted Next.js
- **Domain**: app.faxi.jp
- **CDN**: Cloudflare for static assets
- **SSL**: Automatic HTTPS with certificate management

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     app.faxi.jp                             │
│                  (Next.js Frontend)                         │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  Dashboard   │  │  Job Mgmt    │  │  User Mgmt   │    │
│  │  Components  │  │  Components  │  │  Components  │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                             │
│  ┌──────────────────────────────────────────────────┐     │
│  │         React Query (Server State Cache)         │     │
│  └──────────────────────────────────────────────────┘     │
│                                                             │
│  ┌──────────────────────────────────────────────────┐     │
│  │         EventSource (Real-Time Updates)          │     │
│  └──────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     api.faxi.jp                             │
│                  (Faxi Core System)                         │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  Admin API   │  │  SSE Stream  │  │  Auth API    │    │
│  │  Endpoints   │  │  Endpoints   │  │  Endpoints   │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                             │
│  ┌──────────────────────────────────────────────────┐     │
│  │         Existing Faxi Core Services              │     │
│  └──────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### Component Architecture


```
app/
├── (auth)/
│   ├── login/
│   │   └── page.tsx              # Login page
│   └── layout.tsx                # Auth layout (no sidebar)
│
├── (dashboard)/
│   ├── layout.tsx                # Dashboard layout (with sidebar)
│   ├── page.tsx                  # Operations dashboard (home)
│   ├── jobs/
│   │   ├── page.tsx              # Job list
│   │   └── [id]/
│   │       └── page.tsx          # Job details
│   ├── users/
│   │   ├── page.tsx              # User list
│   │   └── [id]/
│   │       └── page.tsx          # User details
│   ├── mcp/
│   │   └── page.tsx              # MCP server monitoring
│   ├── ai/
│   │   └── page.tsx              # AI interpretation inspector
│   ├── financial/
│   │   └── page.tsx              # Financial dashboard
│   ├── alerts/
│   │   └── page.tsx              # Alert management
│   ├── config/
│   │   └── page.tsx              # Configuration management
│   ├── analytics/
│   │   └── page.tsx              # Analytics and reporting
│   └── audit/
│       └── page.tsx              # Audit log viewer
│
├── api/
│   ├── auth/
│   │   ├── login/route.ts        # Login endpoint
│   │   ├── logout/route.ts       # Logout endpoint
│   │   └── refresh/route.ts      # Token refresh
│   └── proxy/
│       └── [...path]/route.ts    # Proxy to api.faxi.jp
│
└── components/
    ├── ui/                       # shadcn/ui components
    ├── dashboard/                # Dashboard-specific components
    ├── charts/                   # Chart components
    └── layout/                   # Layout components
```


## Authentication and Authorization

### Authentication Flow

```typescript
// JWT token structure
interface AuthToken {
  userId: string;
  email: string;
  role: 'super_admin' | 'admin' | 'support' | 'analyst';
  iat: number;  // Issued at
  exp: number;  // Expires at (15 minutes)
}

interface RefreshToken {
  userId: string;
  tokenId: string;  // Unique token ID for revocation
  iat: number;
  exp: number;  // Expires at (7 days)
}
```

**Login Flow:**
1. User submits credentials to `/api/auth/login`
2. Backend validates credentials against admin_users table
3. Backend generates access token (15 min) and refresh token (7 days)
4. Tokens stored in httpOnly cookies
5. Frontend redirects to dashboard

**Token Refresh:**
1. Access token expires after 15 minutes
2. Frontend automatically calls `/api/auth/refresh` with refresh token
3. Backend validates refresh token and issues new access token
4. Process transparent to user

**Logout:**
1. User clicks logout
2. Frontend calls `/api/auth/logout`
3. Backend invalidates refresh token
4. Cookies cleared
5. Redirect to login page

### Role-Based Access Control (RBAC)


```typescript
// Permission matrix
const PERMISSIONS = {
  super_admin: ['*'],  // All permissions
  admin: [
    'dashboard:view',
    'jobs:view', 'jobs:retry', 'jobs:cancel',
    'users:view', 'users:edit',
    'mcp:view', 'mcp:configure',
    'ai:view', 'ai:feedback',
    'financial:view', 'financial:refund',
    'alerts:view', 'alerts:configure', 'alerts:acknowledge',
    'config:view', 'config:edit',
    'analytics:view', 'analytics:export',
    'audit:view', 'audit:export',
  ],
  support: [
    'dashboard:view',
    'jobs:view', 'jobs:retry',
    'users:view',
    'mcp:view',
    'ai:view',
    'financial:view',
    'alerts:view',
    'audit:view',
  ],
  analyst: [
    'dashboard:view',
    'analytics:view', 'analytics:export',
    'audit:view',
  ],
};

// Permission check helper
function hasPermission(role: string, permission: string): boolean {
  const rolePermissions = PERMISSIONS[role] || [];
  return rolePermissions.includes('*') || rolePermissions.includes(permission);
}
```


## Data Models

### Admin User Schema

```sql
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('super_admin', 'admin', 'support', 'analyst')),
  is_active BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_email (email),
  INDEX idx_role (role)
);

CREATE TABLE admin_refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,
  token_id VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_token_id (token_id),
  INDEX idx_admin_user_id (admin_user_id),
  INDEX idx_expires_at (expires_at)
);
```

### Dashboard Preferences Schema

```sql
CREATE TABLE admin_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,
  preferences JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (admin_user_id)
);

-- Example preferences structure:
-- {
--   "theme": "dark",
--   "defaultDateRange": "7d",
--   "dashboardLayout": ["health", "queue", "errors"],
--   "notificationSound": true,
--   "alertChannels": ["email", "slack"]
-- }
```


## API Endpoints

### Authentication Endpoints

```typescript
// POST /api/auth/login
interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  // Tokens set in httpOnly cookies
}

// POST /api/auth/logout
// No body, clears cookies

// POST /api/auth/refresh
// Uses refresh token from cookie
interface RefreshResponse {
  // New access token set in httpOnly cookie
}
```

### Dashboard API Endpoints (via api.faxi.jp)

```typescript
// GET /admin/dashboard/metrics
interface DashboardMetrics {
  health: {
    database: 'up' | 'down' | 'degraded';
    redis: 'up' | 'down' | 'degraded';
    s3: 'up' | 'down' | 'degraded';
    faxQueue: 'up' | 'down' | 'degraded';
    emailQueue: 'up' | 'down' | 'degraded';
  };
  activeJobs: {
    id: string;
    status: string;
    stage: string;
    startedAt: string;
  }[];
  queue: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    processingRate: number;  // jobs per minute
    avgWaitTime: number;     // seconds
  };
  errors: {
    lastHour: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    topErrors: { message: string; count: number }[];
  };
  performance: {
    avgResponseTime: number;
    p50: number;
    p95: number;
    p99: number;
  };
  resources: {
    cpu: number;      // percentage
    memory: number;   // percentage
    disk: number;     // percentage
  };
}

// GET /admin/dashboard/stream (SSE)
// Real-time updates for dashboard metrics
```


### Fax Job Management Endpoints

```typescript
// GET /admin/jobs?status=&user=&intent=&from=&to=&page=&limit=
interface JobListResponse {
  jobs: {
    id: string;
    referenceId: string;
    userId: string;
    userPhone: string;
    direction: 'inbound' | 'outbound';
    status: string;
    intent: string;
    createdAt: string;
    updatedAt: string;
  }[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// GET /admin/jobs/:id
interface JobDetailsResponse {
  job: {
    id: string;
    referenceId: string;
    faxId: string;
    userId: string;
    fromNumber: string;
    toNumber: string;
    direction: 'inbound' | 'outbound';
    status: string;
    imageUrl: string;
    interpretation: InterpretationResult;
    actionResults: any[];
    contextId: string;
    createdAt: string;
    updatedAt: string;
  };
  user: {
    id: string;
    phoneNumber: string;
    emailAddress: string;
    name: string;
  };
  context: ConversationContext | null;
  relatedJobs: { id: string; referenceId: string; createdAt: string }[];
  processingHistory: {
    stage: string;
    status: string;
    timestamp: string;
    details: any;
  }[];
}

// POST /admin/jobs/:id/retry
interface RetryJobResponse {
  success: boolean;
  jobId: string;
  message: string;
}

// POST /admin/jobs/:id/cancel
interface CancelJobResponse {
  success: boolean;
  jobId: string;
  message: string;
}
```


### User Management Endpoints

```typescript
// GET /admin/users?search=&page=&limit=
// POST /admin/users/:id/feature-flags
// GET /admin/users/:id/activity
// GET /admin/users/:id/orders
// GET /admin/users/:id/payments
// DELETE /admin/users/:id/contexts/:contextId
```

### MCP Server Monitoring Endpoints

```typescript
// GET /admin/mcp/servers
// GET /admin/mcp/servers/:name/tools
// GET /admin/mcp/servers/:name/metrics
// POST /admin/mcp/servers/:name/enable
// POST /admin/mcp/servers/:name/disable
// GET /admin/mcp/external-apis
```

### AI Interpretation Endpoints

```typescript
// GET /admin/ai/interpretations?confidence=&intent=&page=&limit=
// GET /admin/ai/interpretations/:id
// POST /admin/ai/interpretations/:id/feedback
// GET /admin/ai/metrics
```

### Financial Endpoints

```typescript
// GET /admin/financial/overview?from=&to=
// GET /admin/financial/payments?status=&page=&limit=
// GET /admin/financial/payments/:id
// POST /admin/financial/payments/:id/retry
// POST /admin/financial/payments/:id/refund
// GET /admin/financial/export?from=&to=&format=csv
```

### Alert Management Endpoints

```typescript
// GET /admin/alerts
// GET /admin/alerts/history
// GET /admin/alerts/rules
// POST /admin/alerts/rules
// PUT /admin/alerts/rules/:id
// DELETE /admin/alerts/rules/:id
// POST /admin/alerts/:id/acknowledge
// GET /admin/alerts/stream (SSE)
```

### Configuration Endpoints

```typescript
// GET /admin/config
// PUT /admin/config/:category/:key
// GET /admin/config/feature-flags
// PUT /admin/config/feature-flags/:flag
```

### Analytics Endpoints

```typescript
// GET /admin/analytics/usage?from=&to=
// GET /admin/analytics/intents?from=&to=
// GET /admin/analytics/conversion?from=&to=
// GET /admin/analytics/retention?from=&to=
// GET /admin/analytics/errors?from=&to=
// GET /admin/analytics/performance?from=&to=
// POST /admin/analytics/export
```

### Audit Log Endpoints

```typescript
// GET /admin/audit?entity=&action=&user=&from=&to=&page=&limit=
// GET /admin/audit/:id
// GET /admin/audit/export?from=&to=&format=csv
```


## Real-Time Updates with Server-Sent Events

### SSE Implementation

```typescript
// Frontend: EventSource connection
const eventSource = new EventSource('/api/admin/dashboard/stream', {
  withCredentials: true
});

eventSource.addEventListener('metrics', (event) => {
  const metrics = JSON.parse(event.data);
  updateDashboard(metrics);
});

eventSource.addEventListener('alert', (event) => {
  const alert = JSON.parse(event.data);
  showAlertNotification(alert);
});

eventSource.onerror = () => {
  // Reconnect logic with exponential backoff
};

// Backend: SSE endpoint
app.get('/admin/dashboard/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendMetrics = () => {
    const metrics = getDashboardMetrics();
    res.write(`event: metrics\n`);
    res.write(`data: ${JSON.stringify(metrics)}\n\n`);
  };

  // Send initial metrics
  sendMetrics();

  // Send updates every 5 seconds
  const interval = setInterval(sendMetrics, 5000);

  req.on('close', () => {
    clearInterval(interval);
  });
});
```

### Event Types

- `metrics`: Dashboard metrics update
- `alert`: New alert triggered
- `job`: Job status change
- `config`: Configuration change
- `user`: User action


## UI Components and Design System

### Color Palette

**Brand Colors (from Faxi logo and website):**

```typescript
// Tailwind config extension - Faxi Brand Colors
const colors = {
  // Primary: Faxi Orange (from fox logo)
  primary: {
    50: '#fff7ed',   // Lightest orange tint
    100: '#ffedd5',  // Very light orange
    200: '#fed7aa',  // Light orange
    300: '#fdba74',  // Soft orange
    400: '#fb923c',  // Medium orange
    500: '#f97316',  // Main Faxi orange (logo color)
    600: '#ea580c',  // Darker orange
    700: '#c2410c',  // Deep orange
    800: '#9a3412',  // Very dark orange
    900: '#7c2d12',  // Darkest orange
  },
  
  // Secondary: Warm Brown (from website earth tones)
  secondary: {
    50: '#fafaf9',
    100: '#f5f5f4',
    200: '#e7e5e4',
    300: '#d6d3d1',
    400: '#a8a29e',
    500: '#78716c',  // Warm brown from website
    600: '#57534e',
    700: '#44403c',
    800: '#292524',
    900: '#1c1917',
  },
  
  // Success: Green (for positive actions)
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    500: '#22c55e',  // Success green
    600: '#16a34a',
    700: '#15803d',
  },
  
  // Warning: Amber (complementary to orange)
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    500: '#f59e0b',  // Warning amber
    600: '#d97706',
    700: '#b45309',
  },
  
  // Error: Red (for errors and critical alerts)
  error: {
    50: '#fef2f2',
    100: '#fee2e2',
    500: '#ef4444',  // Error red
    600: '#dc2626',
    700: '#b91c1c',
  },
  
  // Info: Blue (for informational messages)
  info: {
    50: '#eff6ff',
    100: '#dbeafe',
    500: '#3b82f6',  // Info blue
    600: '#2563eb',
    700: '#1d4ed8',
  },
  
  // Neutral: Warm grays (matching website aesthetic)
  neutral: {
    50: '#fafaf9',   // Almost white
    100: '#f5f5f4',  // Very light gray
    200: '#e7e5e4',  // Light gray
    300: '#d6d3d1',  // Medium light gray
    400: '#a8a29e',  // Medium gray
    500: '#78716c',  // Medium dark gray
    600: '#57534e',  // Dark gray
    700: '#44403c',  // Very dark gray
    800: '#292524',  // Almost black
    900: '#1c1917',  // Black
  },
};
```

**Design Rationale:**
- **Primary Orange (#f97316)**: Directly from the Faxi fox logo, represents energy, warmth, and accessibility
- **Warm Earth Tones**: Reflects the website's comfortable, approachable aesthetic for elderly users
- **High Contrast**: Ensures readability and accessibility (WCAG AA compliant)
- **Complementary Colors**: Success (green), warning (amber), error (red) work harmoniously with the orange brand
- **Professional Yet Warm**: Balances the need for a serious admin tool with Faxi's friendly brand personality

### Key Components

**Dashboard Layout:**
- Sidebar navigation (collapsible)
- Top bar with user menu and notifications
- Main content area with breadcrumbs
- Footer with version and status

**Data Display:**
- Metric cards with trend indicators
- Status badges (healthy/degraded/down)
- Data tables with sorting, filtering, pagination
- Charts (line, bar, pie, area)
- Timeline views for history

**Interactive Elements:**
- Search bars with autocomplete
- Date range pickers
- Filter dropdowns
- Action buttons with confirmation modals
- Form inputs with validation

**Feedback:**
- Toast notifications
- Loading skeletons
- Empty states
- Error boundaries
- Success/error messages


## Page Designs

### 1. Operations Dashboard (Home)

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ [Logo] Operations Dashboard          [Notifications] [User] │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  System Health                                                │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐             │
│  │  DB  │ │Redis │ │  S3  │ │ Fax  │ │Email │             │
│  │  ✓   │ │  ✓   │ │  ✓   │ │  ✓   │ │  ✓   │             │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘             │
│                                                               │
│  Active Jobs (3)                    Queue Status             │
│  ┌─────────────────────────────┐   ┌──────────────────┐    │
│  │ FX-2025-001234              │   │ Pending: 12      │    │
│  │ Processing: AI Vision       │   │ Processing: 3    │    │
│  │ Started: 2 min ago          │   │ Rate: 45/min     │    │
│  ├─────────────────────────────┤   │ Avg Wait: 8s     │    │
│  │ FX-2025-001235              │   └──────────────────┘    │
│  │ Processing: Agent           │                            │
│  │ Started: 1 min ago          │   Error Rate (1h)         │
│  ├─────────────────────────────┤   ┌──────────────────┐    │
│  │ FX-2025-001236              │   │ 2 errors         │    │
│  │ Processing: Response Gen    │   │ ↓ Decreasing     │    │
│  │ Started: 30s ago            │   └──────────────────┘    │
│  └─────────────────────────────┘                            │
│                                                               │
│  Performance (Last Hour)                                      │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ [Line chart showing response times]                 │    │
│  │ Avg: 1.2s  P95: 2.8s  P99: 4.1s                    │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  Resource Usage                                               │
│  ┌──────┐ ┌──────┐ ┌──────┐                                │
│  │ CPU  │ │Memory│ │ Disk │                                │
│  │ 45%  │ │ 62%  │ │ 38%  │                                │
│  └──────┘ └──────┘ └──────┘                                │
└─────────────────────────────────────────────────────────────┘
```

**Features:**
- Auto-refresh every 5 seconds
- Click service for details
- Click job to view details
- Visual alerts for issues


### 2. Fax Job Management

**Job List View:**
```
┌─────────────────────────────────────────────────────────────┐
│ Fax Jobs                                                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  [Search: Reference ID, User, Phone]  [Filters ▼]           │
│                                                               │
│  Status: [All ▼]  Intent: [All ▼]  Date: [Last 7 days ▼]   │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Ref ID        │ User      │ Intent   │ Status │ Date  │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │ FX-2025-001234│ +81...123 │ Email    │ ✓ Done │ 2h ago│  │
│  │ FX-2025-001235│ +81...456 │ Shopping │ ⟳ Proc │ 1h ago│  │
│  │ FX-2025-001236│ +81...789 │ AI Chat  │ ✗ Fail │ 30m   │  │
│  │ FX-2025-001237│ +81...234 │ Payment  │ ✓ Done │ 15m   │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  [< Previous]  Page 1 of 45  [Next >]                        │
└─────────────────────────────────────────────────────────────┘
```

**Job Details Modal:**
```
┌─────────────────────────────────────────────────────────────┐
│ Job Details: FX-2025-001236                          [Close] │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  [Overview] [Interpretation] [Actions] [Response] [History]  │
│                                                               │
│  Overview                                                     │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Status: Failed                                      │    │
│  │ User: +81-90-1234-5678 (user@me.faxi.jp)          │    │
│  │ Direction: Inbound                                  │    │
│  │ Created: 2025-11-18 14:30:00                       │    │
│  │ Updated: 2025-11-18 14:32:15                       │    │
│  │                                                     │    │
│  │ Original Fax:                                       │    │
│  │ [Fax image with zoom controls]                     │    │
│  │                                                     │    │
│  │ Error: AI Vision service timeout                   │    │
│  │                                                     │    │
│  │ [Retry Job] [Cancel Job] [Download Fax]           │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```


### 3. User Management

**User List:**
```
┌─────────────────────────────────────────────────────────────┐
│ Users                                                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  [Search: Phone, Email, Name]                                │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Phone         │ Email          │ Faxes │ Orders │ Join│  │
│  ├───────────────────────────────────────────────────────┤  │
│  │ +81-90-123... │ 8190123@me...  │ 45    │ 12     │ 3mo │  │
│  │ +81-80-456... │ 8180456@me...  │ 23    │ 5      │ 2mo │  │
│  │ +81-70-789... │ 8170789@me...  │ 67    │ 18     │ 6mo │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  [< Previous]  Page 1 of 123  [Next >]                       │
└─────────────────────────────────────────────────────────────┘
```

**User Details:**
```
┌─────────────────────────────────────────────────────────────┐
│ User: +81-90-1234-5678                              [Close]  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  [Profile] [Activity] [Orders] [Payments] [Contacts]         │
│                                                               │
│  Profile                                                      │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Phone: +81-90-1234-5678                            │    │
│  │ Email: 8190123@me.faxi.jp                          │    │
│  │ Name: Tanaka Taro                                  │    │
│  │ Registered: 2025-08-15                             │    │
│  │ Last Fax: 2025-11-18 (3 hours ago)                │    │
│  │                                                     │    │
│  │ Statistics:                                         │    │
│  │ • Total Faxes: 45 (32 in, 13 out)                 │    │
│  │ • Total Orders: 12                                 │    │
│  │ • Total Spend: ¥45,600                             │    │
│  │                                                     │    │
│  │ Feature Flags:                                      │    │
│  │ ☑ Email Enabled                                    │    │
│  │ ☑ Shopping Enabled                                 │    │
│  │ ☑ AI Chat Enabled                                  │    │
│  │ ☐ Beta Features                                    │    │
│  │                                                     │    │
│  │ Active Contexts: 2                                  │    │
│  │ • FX-2025-001234 (Shopping, expires in 5 days)    │    │
│  │ • FX-2025-001189 (Email, expires in 3 days)       │    │
│  │                                                     │    │
│  │ [Edit Feature Flags] [Clear Contexts]              │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```


### 4. MCP Server Monitoring

```
┌─────────────────────────────────────────────────────────────┐
│ MCP Servers                                                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Server Status                                                │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Server      │ Status │ Tools │ Calls/h │ Success │    │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │ Email       │ ✓ Up   │ 3     │ 145     │ 98.5%   │ ⚙ │  │
│  │ Shopping    │ ✓ Up   │ 9     │ 67      │ 95.2%   │ ⚙ │  │
│  │ Payment     │ ✓ Up   │ 5     │ 89      │ 99.1%   │ ⚙ │  │
│  │ AI Chat     │ ✓ Up   │ 3     │ 234     │ 97.8%   │ ⚙ │  │
│  │ User Profile│ ✓ Up   │ 9     │ 178     │ 99.5%   │ ⚙ │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  External API Health                                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Service     │ Status │ Latency │ Rate Limit │ Cost   │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │ Telnyx      │ ✓ Up   │ 245ms   │ 45% used   │ $234   │  │
│  │ Stripe      │ ✓ Up   │ 189ms   │ 12% used   │ $89    │  │
│  │ Gemini      │ ⚠ Slow │ 1.2s    │ 78% used   │ $456   │  │
│  │ Amazon API  │ ✓ Up   │ 567ms   │ 34% used   │ $123   │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  Tool Usage (Last 24h)                                        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ [Bar chart showing tool call frequency]             │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 5. AI Interpretation Inspector

```
┌─────────────────────────────────────────────────────────────┐
│ AI Interpretations                                            │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Confidence: [All ▼]  Intent: [All ▼]  Date: [Last 7 days ▼]│
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Ref ID        │ Intent   │ Confidence │ Annotations │  │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │ FX-2025-001234│ Email    │ 95%        │ 3 circles   │✓│  │
│  │ FX-2025-001235│ Shopping │ 87%        │ 5 checks    │✓│  │
│  │ FX-2025-001236│ AI Chat  │ 62% ⚠     │ 1 arrow     │?│  │
│  │ FX-2025-001237│ Payment  │ 91%        │ 2 circles   │✓│  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  Accuracy Metrics                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Overall Accuracy: 94.2%                             │    │
│  │ [Line chart showing accuracy trend]                 │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```


### 6. Financial Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│ Financial Overview                                            │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Period: [Last 30 days ▼]                                    │
│                                                               │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │ Total Revenue│ │ Orders       │ │ Avg Order    │        │
│  │ ¥1,234,567   │ │ 456          │ │ ¥2,706       │        │
│  │ ↑ +12.5%     │ │ ↑ +8.3%      │ │ ↑ +3.8%      │        │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
│                                                               │
│  Revenue Trend                                                │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ [Line chart showing daily revenue]                  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  Payment Methods                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ [Pie chart: Credit Card 65%, Konbini 35%]          │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  Recent Transactions                                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Date       │ User      │ Amount  │ Method  │ Status  │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │ 11/18 14:30│ +81...123 │ ¥3,500  │ Card    │ ✓ Paid  │  │
│  │ 11/18 13:15│ +81...456 │ ¥2,800  │ Konbini │ ⏳ Pend │  │
│  │ 11/18 12:45│ +81...789 │ ¥4,200  │ Card    │ ✗ Fail  │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  [Export CSV] [Export PDF]                                   │
└─────────────────────────────────────────────────────────────┘
```

### 7. Alert Management

```
┌─────────────────────────────────────────────────────────────┐
│ Alerts                                                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Active Alerts (2)                                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 🔴 CRITICAL: Database connection pool exhausted       │  │
│  │    Triggered: 5 minutes ago                           │  │
│  │    [Acknowledge] [View Details]                       │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │ ⚠️  WARNING: Gemini API rate limit at 85%            │  │
│  │    Triggered: 15 minutes ago                          │  │
│  │    [Acknowledge] [View Details]                       │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  Alert Rules                                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Rule Name           │ Condition      │ Severity │ ⚙   │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │ High Error Rate     │ Errors > 10/h  │ Critical │ ⚙   │  │
│  │ Queue Backlog       │ Queue > 100    │ Warning  │ ⚙   │  │
│  │ Slow Response       │ P95 > 5s       │ Warning  │ ⚙   │  │
│  │ Service Down        │ Health = down  │ Critical │ ⚙   │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  [+ Create Alert Rule]                                        │
│                                                               │
│  Notification Channels                                        │
│  ☑ Email: ops@faxi.jp                                        │
│  ☑ Slack: #faxi-alerts                                       │
│  ☐ PagerDuty: (not configured)                               │
└─────────────────────────────────────────────────────────────┘
```


## Security Considerations

### Authentication Security

1. **Password Requirements:**
   - Minimum 12 characters
   - Must include uppercase, lowercase, number, special character
   - Hashed with bcrypt (cost factor 12)
   - Password history (prevent reuse of last 5 passwords)

2. **Session Management:**
   - Access tokens expire after 15 minutes
   - Refresh tokens expire after 7 days
   - Tokens stored in httpOnly, secure, sameSite cookies
   - Token rotation on refresh
   - Revocation on logout

3. **Brute Force Protection:**
   - Rate limiting: 5 failed attempts per 15 minutes
   - Account lockout after 10 failed attempts
   - CAPTCHA after 3 failed attempts
   - Audit log of all login attempts

### Authorization Security

1. **Role-Based Access Control:**
   - Permissions checked on every request
   - Frontend hides unauthorized UI elements
   - Backend enforces permissions on API calls
   - Audit log of all permission checks

2. **API Security:**
   - All endpoints require authentication
   - CORS restricted to app.faxi.jp
   - CSRF protection on state-changing operations
   - Input validation on all parameters

### Data Security

1. **Sensitive Data:**
   - Payment methods masked in UI
   - Full card numbers never displayed
   - PII access logged in audit log
   - Data encryption at rest and in transit

2. **Audit Logging:**
   - All admin actions logged
   - All data modifications logged
   - Logs immutable and tamper-evident
   - Log retention per compliance requirements


## Performance Optimization

### Frontend Performance

1. **Code Splitting:**
   - Route-based code splitting with Next.js
   - Dynamic imports for heavy components
   - Lazy loading for charts and tables

2. **Data Fetching:**
   - React Query for caching and deduplication
   - Stale-while-revalidate strategy
   - Prefetching on hover for navigation
   - Pagination for large datasets

3. **Rendering Optimization:**
   - Virtual scrolling for long lists
   - Memoization of expensive computations
   - Debouncing of search inputs
   - Skeleton loading states

4. **Asset Optimization:**
   - Image optimization with Next.js Image
   - Font subsetting and preloading
   - CSS purging with Tailwind
   - Gzip/Brotli compression

### Backend Performance

1. **Database Optimization:**
   - Indexed queries for common searches
   - Connection pooling
   - Query result caching
   - Pagination with cursor-based navigation

2. **API Optimization:**
   - Response compression
   - ETags for conditional requests
   - Rate limiting to prevent abuse
   - Batch endpoints for multiple operations

3. **Real-Time Optimization:**
   - SSE connection pooling
   - Selective event broadcasting
   - Heartbeat for connection health
   - Automatic reconnection with backoff

## Testing Strategy

### Unit Testing
- Component testing with React Testing Library
- Hook testing with @testing-library/react-hooks
- Utility function testing with Vitest
- API route testing with supertest

### Integration Testing
- End-to-end flows with Playwright
- Authentication flows
- Data fetching and mutations
- Real-time updates

### Performance Testing
- Lighthouse CI for performance budgets
- Load testing with k6
- Real user monitoring (RUM)

### Security Testing
- OWASP ZAP for vulnerability scanning
- Dependency scanning with Snyk
- Penetration testing before production


## Deployment Architecture

### Production Deployment

```
┌─────────────────────────────────────────────────────────────┐
│                     Cloudflare CDN                            │
│                  (SSL, DDoS Protection)                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     app.faxi.jp                               │
│                  (Vercel / Self-hosted)                       │
│                                                               │
│  ┌──────────────────────────────────────────────────┐       │
│  │         Next.js Application                      │       │
│  │  - Static pages (pre-rendered)                   │       │
│  │  - API routes (serverless functions)             │       │
│  │  - SSR for dynamic content                       │       │
│  └──────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     api.faxi.jp                               │
│                  (Faxi Core System)                           │
│                                                               │
│  - Admin API endpoints                                        │
│  - SSE streaming endpoints                                    │
│  - Authentication services                                    │
│  - Database access                                            │
└─────────────────────────────────────────────────────────────┘
```

### Environment Configuration

**Development:**
- Local Next.js dev server
- Hot module replacement
- Mock API responses
- Test database

**Staging:**
- Vercel preview deployment
- Staging API endpoint
- Staging database
- Real-time monitoring

**Production:**
- Vercel production deployment
- Production API endpoint
- Production database
- Full monitoring and alerting

### Monitoring and Observability

1. **Application Monitoring:**
   - Vercel Analytics for performance
   - Sentry for error tracking
   - LogRocket for session replay
   - Custom metrics to Prometheus

2. **Infrastructure Monitoring:**
   - Uptime monitoring with UptimeRobot
   - SSL certificate monitoring
   - DNS monitoring
   - CDN performance monitoring

3. **User Analytics:**
   - Admin user activity tracking
   - Feature usage analytics
   - Performance metrics per user
   - Error rates per feature

