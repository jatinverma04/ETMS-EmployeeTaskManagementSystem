# Employee Task Management System (ETMS)

A MERN application for managing employees and their assigned tasks. Employees can be searched, filtered, created, viewed, edited, and deleted. Tasks support assignment, priorities, due dates, status transitions, overdue indicators, filtering, sorting, pagination, and CSV export.

## Stack

- **Frontend:** React 18, React Router 6, Vite, Tailwind CSS 3.4, Axios
- **Backend:** Node.js, Express 4, Mongoose 8, express-validator
- **Database:** MongoDB replica set

## Features

- Dashboard with employee/task totals, overdue count, and employee workload
- Employee CRUD with validation, department/status filters, search, sorting, and pagination
- Task CRUD with employee assignment, priority and date filters, search, sorting, and pagination
- Enforced task status transitions and backend-managed completion dates
- Active-task capacity limit of three per employee, enforced transactionally
- Inclusive On Leave checks using the task start date
- UTC date-only overdue calculation
- Filtered CSV export covering every matching task, independent of pagination
- URL-persisted list search, filters, sorting, and pagination
- Loading, empty, validation, API-error, conflict, and notification states
- Responsive keyboard-accessible custom controls

## Repository Layout

```text
etms/
  client/                 React/Vite frontend
    src/
      api/                API request functions
      components/         Shared layout, form, table, badge, and control components
      hooks/              API resource and URL list-state hooks
      layouts/            Application shell
      pages/              Dashboard, employee, task, and not-found screens
      utils/              Validation, dates, constants, and styles
  server/                 Express/Mongoose API
    src/
      config/             Environment and database setup
      constants/          Domain values
      controllers/        HTTP handlers
      middleware/         Validation and error handling
      models/             Employee, Task, Counter
      routes/             API routes
      scripts/            Capacity reconciliation script
      services/           Business logic
      utils/              Query, date, CSV, snapshot, and rule helpers
      validators/         Request validation
    tests/                Node test suites and helpers
  PHASE_0_PLAN.md         Approved implementation plan
```

## Prerequisites

- Node.js 20 or later
- npm
- A MongoDB **replica set** (MongoDB Atlas or a locally configured single-node replica set)

Standalone MongoDB servers do not support the transactions used for task capacity, assignment, status changes, and employee deletion.

For a local single-node replica set, start MongoDB with replica-set mode and initiate it once:

```bash
mongod --replSet rs0 --dbpath <data-directory>
mongosh --eval "rs.initiate()"
```

Use a connection URI that targets that replica set and includes its replica-set name. MongoDB Atlas provides a compatible URI directly.

## Environment Variables

Create `server/.env` from `server/.env.example`, and `client/.env` when a non-default API URL is required. Never commit either `.env` file.

### Server

| Name | Purpose |
| --- | --- |
| `NODE_ENV` | Runtime environment name |
| `PORT` | HTTP port for the API |
| `MONGODB_URI` | MongoDB replica-set connection URI |
| `CLIENT_ORIGIN` | Exact frontend origin allowed by CORS, without a trailing slash |

`MONGODB_URI` must reference a replica set. The example file is a template; use the replica-set URI supplied by Atlas or your local replica-set configuration.

### Client

| Name | Purpose |
| --- | --- |
| `VITE_API_BASE_URL` | API root URL, including `/api` |

Vite reads client environment variables at build time, so rebuild after changing `VITE_API_BASE_URL`.

## Setup and Run

Dependencies are installed separately in each application folder. This repository does not use a root workspace package.

### Backend

```bash
cd server
npm install
npm run dev
```

For a production-style start:

```bash
cd server
npm start
```

Health check: `GET /api/health` returns `200` when MongoDB is connected and `503` when it is unavailable.

### Frontend

```bash
cd client
npm install
npm run dev
```

The default client API URL is `http://localhost:5000/api` when `VITE_API_BASE_URL` is not set.

### Production Build

```bash
cd client
npm run build
npm run preview
```

The build output is written to `client/dist`.

## Tests

Backend:

```bash
cd server
npm test
```

The backend suite uses Node's built-in test runner and a disposable `mongodb-memory-server` replica set by default. To use a dedicated external test database instead, set `MONGODB_TEST_URI`; its database name must contain `test`. The API integration suites issue real HTTP requests and exercise transaction-enabled MongoDB behavior.

Frontend:

```bash
cd client
npm run build
```

The client currently has no configured automated test runner or `test` script. Production-build compilation is the available automated frontend check.

## API

Base path: `/api`

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/health` | API/database health |
| `GET` | `/dashboard` | Employee counts, task counts, overdue count, workload |
| `GET` | `/employees` | List employees |
| `POST` | `/employees` | Create employee |
| `GET` | `/employees/:id` | Get employee |
| `PUT` | `/employees/:id` | Update employee |
| `DELETE` | `/employees/:id` | Delete employee when no active tasks exist |
| `GET` | `/tasks` | List tasks |
| `GET` | `/tasks/export` | Export all filtered tasks as CSV |
| `POST` | `/tasks` | Create task |
| `GET` | `/tasks/:id` | Get task |
| `PUT` | `/tasks/:id` | Update task |
| `PUT` | `/tasks/:id/status` | Perform a status transition |
| `DELETE` | `/tasks/:id` | Delete task |

### Response Shapes

- List endpoints: `{ "data": [...], "pagination": { "page", "limit", "total", "totalPages" } }`
- Single-resource endpoints: `{ "data": { ... } }`
- Delete endpoints: `204 No Content`
- Errors: `{ "message": "...", "errors": [{ "field": "...", "message": "..." }] }`

Common status codes:

- `400` for validation, malformed queries, or invalid identifiers
- `404` for missing resources or routes
- `409` for duplicate employee ID/email values, capacity conflicts, invalid status transitions, edits to terminal tasks, and blocked employee deletion
- `500` for unexpected server errors
- `503` for an unhealthy database connection

### Employee List Parameters

`search`, `department`, `status`, `sort`, `order`, `page`, `limit`

- Search matches employee ID, full name, or email.
- Sort: `fullName`, `joiningDate`, or `employeeId`; default is `fullName` ascending.
- Pagination defaults to page 1 and 10 records; the maximum limit is 100.

### Task List Parameters

`search`, `department`, `priority`, `status`, `dueFrom`, `dueTo`, `sort`, `order`, `page`, `limit`

- Search matches task title or the employee snapshot name.
- `dueFrom` and `dueTo` are inclusive `YYYY-MM-DD` boundaries.
- Sort: `createdAt`, `dueDate`, `priority`, or `title`; default is `createdAt` descending.
- Pagination defaults to page 1 and 10 records; the maximum limit is 100.

The CSV endpoint accepts the same filters and sorting parameters but intentionally ignores `page` and `limit`, streaming every matching task.

### Employee Fields

`employeeId`, `fullName`, `email`, `phone`, `department`, `role`, `joiningDate`, `status`, `skills`, `leaveStart`, `leaveEnd`

- Departments: `Development`, `Design`, `QA`, `HR`, `Sales`
- Statuses: `Active`, `Inactive`, `On Leave`
- Employee IDs and emails are unique. Employee IDs are normalized to uppercase; emails are normalized to lowercase.
- `On Leave` employees require `leaveStart` and `leaveEnd`.

### Task Fields

`title`, `description`, `assignedEmployee`, `department`, `priority`, `startDate`, `dueDate`

- Priorities: `Low`, `Medium`, `High`, `Critical`
- Statuses: `Todo`, `In Progress`, `Completed`, `Cancelled`
- New tasks always begin as `Todo`; status is changed only through the status endpoint.
- The due date must be on or after the start date.

## Data Model

### Mongoose Schema Summary

**Employee**

- Unique normalized `employeeId` and `email`
- Name, phone, department, role, joining date, status, and skills
- Optional leave start/end dates required for On Leave status
- Denormalized `activeTaskCount`, hidden from normal serialization, used for transactional capacity checks
- Timestamps

**Task**

- Unique generated `taskId`
- Title, description, department, priority, status, start date, due date, and backend-set completed date
- `assignedEmployee` ObjectId reference to Employee
- Immutable `employeeSnapshot` containing employee ID, full name, email, and department
- Timestamps

**Counter**

- Named atomic sequence document used to generate task IDs without duplicates

### Employee to Task Relationship

An employee has many tasks. Each task stores an `assignedEmployee` reference for operational linking and an `employeeSnapshot` for durable display. The snapshot is intentionally not rewritten when the employee changes, so historical tasks retain the employee details captured at assignment time. Capacity is tracked separately with `Employee.activeTaskCount` and verified transactionally against actual Todo/In Progress tasks.

### Employee Deletion Strategy

Employees are hard-deleted only when they have no Todo or In Progress tasks. Completed and Cancelled task history is preserved; existing task documents keep their employee reference plus the immutable snapshot. Deleting a permitted employee does not cascade-delete tasks.

## Assumptions

- The assignment does not require authentication or role-based authorization.
- Dates such as joining, start, due, and leave dates are calendar dates interpreted in UTC.
- Only Todo and In Progress count against the three-active-task limit.
- Changing an employee to Inactive or On Leave does not automatically cancel or reassign existing tasks; new assignment attempts use the current status and leave range.
- Employee snapshots are historical records and are not updated after later employee edits.
- A single configured `CLIENT_ORIGIN` is sufficient for the deployed frontend.
- MongoDB is available as a replica set so transactions are supported.

## Business Rules

- Only `Active` employees can receive new task assignments.
- `Inactive` employees are always rejected.
- `On Leave` employees are rejected when the task's start date falls within the inclusive leave range.
- An employee can have at most three active tasks: `Todo` and `In Progress`.
- Capacity is enforced through a conditional atomic counter update inside a MongoDB transaction, so concurrent requests cannot exceed the limit.
- Employees with active tasks cannot be deleted.
- Task employee snapshots preserve the employee ID, name, email, and department after later employee changes or permitted deletion.
- Completed and Cancelled tasks are immutable through the normal task update route.
- The backend sets `completedDate` when a task becomes Completed.
- Overdue tasks are active tasks whose due date is earlier than the current UTC date; Completed and Cancelled tasks are never overdue.
- Task IDs are generated from an atomic MongoDB counter and formatted as `TSK-###`.

### Allowed Status Transitions

| From | To |
| --- | --- |
| `Todo` | `In Progress`, `Cancelled` |
| `In Progress` | `Completed`, `Cancelled` |
| `Completed` | None |
| `Cancelled` | None |

### Capacity Reconciliation

If counters are suspected to be inconsistent after manual database changes or an interrupted deployment, run this during a maintenance window with capacity-changing writes paused:

```bash
cd server
node src/scripts/reconcileActiveTaskCounts.js
```

The script compares stored `activeTaskCount` values with actual Todo/In Progress tasks, logs mismatches, repairs them, and reports active tasks whose employee no longer exists.

## Required Brief Answers

### 1. Where are status transitions validated, and why?

The server validates transitions in the task service before saving. It owns a single transition map: Todo to In Progress/Cancelled, and In Progress to Completed/Cancelled. The status endpoint checks the current database status, rejects every other transition with `409 Conflict`, and prevents normal task updates from changing status. This placement keeps the rule authoritative even when clients are bypassed, stale, or modified. The frontend mirrors the map only to offer valid actions.

### 2. Why is the Completed Date set and validated only by the backend?

`completedDate` is not a client-writable task field. When a valid transition changes a task to Completed, the backend records the server-side time. This prevents clients from backdating or forging completion, keeps completion consistent with the transition rule, and ensures terminal tasks remain immutable.

### 3. How are Inactive and On Leave employees prevented from being assigned tasks?

Every create/assignment change reloads the employee inside the transaction. Inactive employees are always rejected. On Leave employees are rejected only when the task start date falls inside the inclusive leave window. The frontend disables Inactive employee options and explains unavailable employees, but every assignment decision is independently enforced by the API.

### 4. Why are filtering and pagination handled by the backend?

The backend can query the full collection, return the correct total, and avoid loading every employee or task into the browser. Search, filters, sorting, and page boundaries are applied consistently in MongoDB, while the client keeps only one page. CSV export reuses the same query parser, filter builder, and sort builder while deliberately ignoring `page` and `limit`, then streams all matching tasks. This prevents the export from being limited to records already loaded on the current page.

### 5. Why do filters live in the URL?

URL search parameters make list state refresh-safe, back-button-safe, and shareable. `useListState` owns that state through React Router's `useSearchParams`, validates URL values, writes only non-default values, resets the page when filters/search change, and exposes matching API and export parameters. Links to detail/edit screens carry the current filtered URL so Back actions return to the same view. Keeping the state in component memory instead would lose it on refresh, navigation, or sharing.

### 6. What can go wrong if two requests assign a fourth active task simultaneously?

If both requests read a stale count of two and independently insert tasks, the employee can end up with four active tasks. The solution is not a read-then-write check alone. Task writes run in MongoDB transactions, and assignment performs an atomic conditional increment on the employee document only when `activeTaskCount` is below three. Two concurrent fourth assignments contend on that document; only one can increment from two to three, and the other receives a conflict and rolls back. Reassignment updates both counters in one transaction, terminal transitions decrement the counter, and the reconciliation script can repair drift.

## Deployment Guidance

No deployment is performed as part of this repository state. Frontend and backend deployment URLs are therefore not available; the project owner must add them after deploying. No live URL is claimed here.

When deploying:

1. Use MongoDB Atlas or another MongoDB replica set. Confirm transactions are supported.
2. Deploy `server` to a Node.js host. Set `MONGODB_URI`, `CLIENT_ORIGIN`, `PORT`, and `NODE_ENV`. Use `npm start`.
3. Deploy `client` to a static host. Set `VITE_API_BASE_URL` before `npm run build`, publish `client/dist`, and configure SPA fallback rewrites to `index.html`.
4. Set the server's `CLIENT_ORIGIN` to the exact deployed frontend origin.
5. Restrict MongoDB network access to the backend and keep credentials only in the hosting environment.
6. Verify `GET /api/health`, create/read/update flows, CSV download, and filtered pagination after deployment.

## Submission Notes

- Do not include `node_modules`, `.env` files, build output, logs, or secrets in a submission archive.
- Include the two application folders, lockfiles, source, tests, and this README.
- Repository and live deployment links are not included because no deployment was performed in this phase. The project owner must add the final repository/deployment URLs before assignment submission.
