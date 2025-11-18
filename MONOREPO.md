# Faxi Monorepo Structure

This repository contains both the Faxi Core System backend and the Admin Dashboard frontend in a monorepo structure using npm workspaces.

## Structure

```
faxi/
├── backend/              # Express.js backend API
│   ├── src/             # Backend source code
│   ├── package.json     # Backend dependencies
│   └── tsconfig.json    # Backend TypeScript config
│
├── admin-dashboard/      # Next.js admin frontend
│   ├── app/             # Next.js app directory
│   ├── components/      # React components
│   ├── lib/             # Utilities and hooks
│   ├── package.json     # Frontend dependencies
│   └── tsconfig.json    # Frontend TypeScript config
│
├── .kiro/               # Kiro specs and configuration
├── docs/                # Shared documentation
├── package.json         # Root workspace configuration
└── README.md            # Main README

```

## Getting Started

### Install Dependencies

From the root directory:

```bash
npm install
```

This will install dependencies for both workspaces.

### Development

**Run backend only:**
```bash
npm run dev
```

**Run admin dashboard only:**
```bash
npm run dev:admin
```

**Run both concurrently:**
```bash
npm run dev:all
```

### Building

**Build both:**
```bash
npm run build
```

**Build backend only:**
```bash
npm run build:backend
```

**Build admin dashboard only:**
```bash
npm run build:admin
```

### Testing

**Test both:**
```bash
npm run test
```

**Test backend only:**
```bash
npm run test:backend
```

**Test admin dashboard only:**
```bash
npm run test:admin
```

## Workspace Commands

You can run commands in specific workspaces:

```bash
# Run a command in backend workspace
npm run <script> --workspace=backend

# Run a command in admin-dashboard workspace
npm run <script> --workspace=admin-dashboard

# Run a command in all workspaces
npm run <script> --workspaces
```

## Environment Variables

### Backend (.env in root or backend/)
- See backend/.env.example for required variables

### Admin Dashboard (admin-dashboard/.env.local)
- `NEXT_PUBLIC_API_URL` - Backend API URL (e.g., http://localhost:3000)

## Ports

- Backend API: `http://localhost:3000`
- Admin Dashboard: `http://localhost:3001`

## Migration from Single Project

The backend code remains in the root `src/` directory for now. As part of the admin dashboard implementation, we'll gradually move backend files to the `backend/` directory to complete the monorepo structure.

## Benefits of Monorepo

1. **Single source of truth** - All code in one repository
2. **Shared types** - Backend types can be imported by frontend
3. **Atomic commits** - Frontend and backend changes in one commit
4. **Easier development** - Run both with one command
5. **Consistent tooling** - Shared linting, testing, CI/CD
