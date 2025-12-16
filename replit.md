# Pragati Shorthand and Typing

## Overview

Pragati Shorthand and Typing is a professional typing and shorthand skill assessment platform designed for an educational institute. The application enables administrators to create and manage typing/shorthand tests, while students can take timed assessments and track their performance. The platform includes user management with payment integration, PDF resource management, a photo gallery, and selected candidates showcase.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state, local React state for UI
- **Styling**: Tailwind CSS v4 with shadcn/ui component library (New York style)
- **Build Tool**: Vite with custom plugins for Replit integration

The frontend follows a page-based architecture with shared components. Key pages include:
- Landing page (public)
- Authentication (login/register)
- Admin dashboard (content management, user management, results)
- Student dashboard (take tests, view results, access resources)
- Typing test interface with timer and real-time feedback

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ESM modules
- **Session Management**: express-session with PostgreSQL store (connect-pg-simple)
- **API Design**: RESTful JSON APIs under `/api/` prefix

The server handles authentication, content management, result storage, and file uploads. Routes are registered in `server/routes.ts` with the storage layer abstracted in `server/storage.ts`.

### Database
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with drizzle-zod for schema validation
- **Schema Location**: `shared/schema.ts` (shared between frontend and backend)

Key tables:
- `users` - Student and admin accounts with payment status
- `content` - Typing and shorthand test content
- `results` - Test results with detailed metrics
- `pdfFolders` / `pdfResources` - Downloadable resources
- `dictations` - Audio-based shorthand tests
- `galleryImages` - Photo gallery
- `selectedCandidates` - Showcase of successful students
- `settings` - Application configuration

### Authentication
- Session-based authentication stored in PostgreSQL
- Password hashing with bcryptjs
- Role-based access control (admin/student)
- Student IDs generated in PIPS format (PIPS + year + sequential number)

### Test Scoring Logic
**Typing Tests**: Calculate gross speed and net speed based on words typed, time allocated, and mistakes. Mistakes are weighted (wrong word = 1, wrong comma = 0.25, wrong period = 1).

**Shorthand Tests**: Pass/fail based on 5% error tolerance rule.

## External Dependencies

### Third-Party Libraries
- **@tanstack/react-query**: Server state management and caching
- **drizzle-orm**: Type-safe database ORM
- **bcryptjs**: Password hashing
- **express-session** + **connect-pg-simple**: Session management with PostgreSQL
- **jsPDF** + **html2canvas**: PDF generation for results
- **date-fns**: Date formatting and manipulation
- **zod**: Runtime schema validation

### UI Components
- **shadcn/ui**: Component library built on Radix UI primitives
- **Lucide React**: Icon library
- **Embla Carousel**: Image carousel functionality

### Database
- **PostgreSQL**: Primary database (connection via `DATABASE_URL` environment variable)
- Migrations managed through `drizzle-kit push`

### Environment Variables Required
- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Secret key for session encryption (optional, has default for development)