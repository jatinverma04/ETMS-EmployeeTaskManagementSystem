# Phase 0 Plan — Employee & Task Management System (ETMS)

**Assignment:** Roots Media Marketing — MERN Stack Developer Intern Technical Assignment
**Project:** Employee Task Management System (ETMS)
**Document status:** Phase 0 complete and approved — planning only. No application implementation, dependency installation, Git operation, deletion, or test execution has occurred.
**Last updated:** 2026-10-20
**Approval status:** Approved by the project owner on 2026-10-20. Phase 1 starts only after the owner's explicit instruction.

### Phase 0 approval record — 2026-10-20

The project owner approved these four decisions with conditions:

1. **Tailwind entry file:** `client/src/index.css` is permitted only as the Tailwind CSS v3 entry file, containing exactly the three required Tailwind directives. No custom CSS rules, component stylesheets, CSS Modules, inline styles, or `@apply`.
2. **Custom controls:** Tailwind-styled custom listboxes and date fields may be used only when necessary to avoid blue native control styling. They must be keyboard accessible, mobile usable, properly labelled, and validated.
3. **Employee snapshots:** immutable assignment-time snapshots are approved. Historical tasks retain the assigned employee's details after employee deletion. Reassignment captures a new snapshot.
4. **Capacity transactions:** MongoDB transactions are approved for capacity enforcement. Production uses MongoDB Atlas; development/testing uses a local single-node replica set when transactions are required. Conditional employee-counter updates, transactional task writes, safe retries, and concurrency tests are required.

Mandatory constraints for all later phases:

- React, Node.js, Express, MongoDB, and Mongoose with JavaScript only.
- Tailwind CSS v3.4 exclusively for frontend styling.
- The project owner installs all dependencies manually.
- The project owner manages all Git commands and commits manually.
- The agent must not execute package installation commands or Git commands.
- No application source code is created during Phase 0.
- No temporary or unrelated files are deleted.
- No tests are run during Phase 0.
- No blue, cyan, sky, or indigo colors in the UI.

---

## 1. Purpose and scope

Build a company-facing Employee & Task Management System that lets a company manage employees, assign tasks, track task status, view a dashboard, and export filtered tasks to CSV.

### Required stack (non-negotiable)

| Layer | Technology |
|---|---|
| Frontend | React (JavaScript) |
| Frontend styling | **Tailwind CSS v3.4 exclusively** — no other styling system |
| Backend | Node.js + Express (JavaScript) |
| Database | MongoDB with Mongoose |
| Language | JavaScript only. TypeScript is not approved for this project. |
| Authentication | None required by the assignment |

### Technology guardrails

- **No Python** in the application, backend, frontend, tests, scripts, or repository.
- No second backend framework, no SQL database, no Prisma, no Python service.
- The MERN stack is the only implementation stack.
- **Tailwind CSS v3.4 exclusively** for all frontend styling. No CSS Modules, styled-components, inline styles, Sass/Less, or other styling frameworks.
- No custom CSS stylesheets for components, layouts, themes, or responsive behavior. The only CSS artifact permitted is the approved minimal Tailwind entry stylesheet, containing exactly the three Tailwind directives. See Section 7.2.
- Dependency installation and Git operations are performed only by the project owner. The agent does not execute them. Application implementation begins only after the owner's explicit Phase 1 instruction, as described in Sections 9.7 and 10.

### In scope

- Employee CRUD with pagination.
- Task CRUD with pagination.
- Backend-enforced business rules.
- Task status transition API.
- Dashboard counts and employee workload calculated on the server.
- Server-side search, combined filters, sorting, and pagination.
- CSV export of all tasks matching the current filters.
- Responsive React screens: Dashboard, Employee List/Add/Edit/View, Task List/Add/Edit/View.
- URL-persisted list state (search, filters, sorting, page).
- README, `.env.example`, deployment, and final submission.

### Out of scope (not requested)

- Login, registration, roles/permissions, JWT, sessions.
- Notifications by email/SMS.
- File uploads or attachments.
- Multi-tenancy.
- Real-time updates/websockets.
- Audit-log UI beyond the required `Completed Date` and timestamps.
- Any feature not stated in the assignment or this plan.

---

## 2. Architecture

### 2.1 High-level architecture

```text
Browser
  │
  │ HTTPS / JSON
  ▼
React SPA (Vite build)
  │  React Router, reusable components, API client
  │
  │ REST API / CORS
  ▼
Node.js + Express API
  │  Routes → Validators → Controllers → Services → Mongoose models
  │  Central error handler, business-rule enforcement
  ▼
MongoDB Atlas / local MongoDB
  ├── employees
  ├── tasks
  └── counters (internal task-ID sequence)
```

### 2.2 Responsibilities

**Frontend**
- Render responsive screens and reusable components.
- Validate fields for fast user feedback.
- Keep list state in the URL.
- Display server validation/business-rule errors in friendly notifications and inline messages.
- Never decide business rules or filter/paginate records in React.

**Backend**
- Validate every field again.
- Enforce all business rules authoritatively.
- Perform search, filtering, sorting, pagination, dashboard aggregation, and CSV generation.
- Return consistent HTTP status codes and error shapes.
- Generate Task IDs, Created Date, and Completed Date.

**Database**
- Persist employees, tasks, and the internal task-ID counter.
- Enforce uniqueness with indexes.
- Support efficient filtering/sorting/pagination with indexes.

### 2.3 Proposed repository structure

```text
etms/
├── client/                         # React frontend
│   ├── public/
│   ├── src/
│   │   ├── api/                    # Axios client + endpoint modules
│   │   ├── components/
│   │   │   ├── common/             # Button, Input, Select, Modal, Toast, etc.
│   │   │   ├── employees/          # Employee-specific components
│   │   │   ├── tasks/              # Task-specific components
│   │   │   └── dashboard/          # Dashboard cards/workload table
│   │   ├── hooks/                  # useDebounce, useUrlFilters, useToast
│   │   ├── layouts/                # AppLayout, navigation shell
│   │   ├── pages/                  # Route-level pages
│   │   ├── utils/                  # Formatting, class composition, client validation
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css               # Minimal Tailwind entry file only; no custom rules
│   ├── tailwind.config.js          # Tailwind theme, colors, breakpoints
│   ├── postcss.config.js
│   ├── .env.example
│   └── package.json
├── server/                         # Express backend
│   ├── src/
│   │   ├── config/                 # DB connection, environment
│   │   ├── constants/              # Enums and shared constants
│   │   ├── controllers/            # HTTP request/response handling
│   │   ├── middleware/             # Validation, errors, 404, async wrapper
│   │   ├── models/                 # Employee, Task, Counter
│   │   ├── routes/                 # Employee, Task, Dashboard routes
│   │   ├── services/               # Business rules, queries, CSV, dashboard
│   │   ├── utils/                  # Dates, query parsing, errors, task IDs
│   │   ├── app.js
│   │   └── server.js
│   ├── tests/
│   ├── .env.example
│   └── package.json
├── README.md
├── .gitignore
└── PHASE_0_PLAN.md
```

### 2.4 Request flow

1. React page reads URL query parameters and calls the API.
2. Express route applies request validation.
3. Controller calls a service.
4. Service loads referenced documents and enforces business rules.
5. Mongoose reads/writes MongoDB. Capacity-changing operations run inside a MongoDB session transaction and update the employee document as the serialization point.
6. Service serializes the response (including derived `isOverdue`).
7. React renders data, loading state, or a friendly error notification.

All errors flow through one Express error handler so the response shape and status codes stay consistent.

---

## 3. Data models

### 3.1 Shared enums

| Enum | Values |
|---|---|
| Department | Development, Design, QA, HR, Sales |
| Employee Status | Active, Inactive, On Leave |
| Task Priority | Low, Medium, High, Critical |
| Task Status | Todo, In Progress, Completed, Cancelled |

Priority importance order for sorting: **Critical > High > Medium > Low**.

### 3.2 Employee model

Collection: `employees`

| Field | Type | Required | Rules |
|---|---|---|---|
| `_id` | ObjectId | auto | Internal Mongo identifier used by API routes. |
| `employeeId` | String | Yes | Business Employee ID. Trimmed, normalized to uppercase, 2–30 chars, unique. |
| `fullName` | String | Yes | 2–100 chars, trimmed. |
| `email` | String | Yes | Valid email, trimmed, lowercased before uniqueness check and storage, unique. |
| `phone` | String | Yes | Commonly valid phone format, 7–15 digits (spaces, `+`, `-`, parentheses allowed). |
| `department` | String | Yes | One of the five fixed departments. |
| `role` | String | Yes | 2–80 chars, trimmed. |
| `joiningDate` | Date | Yes | Valid date. |
| `status` | String | Yes | Active / Inactive / On Leave; default Active. |
| `skills` | String[] | No | Max 20 entries; each trimmed, 1–50 chars; duplicates removed; empty strings rejected. |
| `leaveStart` | Date / null | Conditional | Required when status is On Leave; otherwise must be absent/null. |
| `leaveEnd` | Date / null | Conditional | Required when status is On Leave; must be on/after `leaveStart`; otherwise absent/null. |
| `activeTaskCount` | Number | Internal | Default 0, minimum 0. Capacity counter updated only inside the same MongoDB transaction as the corresponding task write. Never accepted from the client and not returned by the API. Rebuilt by the reconciliation routine if drift is ever detected. |
| `createdAt`, `updatedAt` | Date | auto | Mongoose timestamps. |

**Indexes**
- Unique: `employeeId`
- Unique: `email`
- List/query support: `{ department: 1, status: 1, fullName: 1 }`
- Search support: index `fullName`; case-insensitive partial search is still bounded by the API.

**Delete strategy**
- Hard delete the employee only when they have no Todo/In Progress tasks.
- Completed/Cancelled tasks remain and keep the immutable employee assignment snapshot.
- Deletion, an active-task existence check, and the `activeTaskCount === 0` check occur in one transaction, so a concurrent task creation cannot slip through.
- If the count is ever suspect, run the reconciliation routine in Section 4.5 before deleting.

### 3.3 Task model

Collection: `tasks`

| Field | Type | Required | Rules |
|---|---|---|---|
| `_id` | ObjectId | auto | Internal Mongo identifier used by API routes. |
| `taskId` | String | auto | Display ID generated by the backend as `TSK-001`, `TSK-002`, … Unique and immutable. |
| `title` | String | Yes | 3–150 chars, trimmed. |
| `description` | String | Yes | 1–2,000 chars, trimmed. |
| `assignedEmployee` | ObjectId ref Employee | Yes at creation | Existing employee; assignment rules apply. Kept after employee deletion; display uses snapshot. |
| `employeeSnapshot` | Object | Yes | Immutable assignment-time copy: `employeeId`, `fullName`, `email`, `department`. Written on task creation and on reassignment to a different employee. Never rewritten when the employee is edited. Retained after employee deletion. |
| `department` | String | Yes | One of the five fixed departments. Selected independently; the assignment does not require it to match the employee's department. |
| `priority` | String | Yes | Low / Medium / High / Critical. |
| `status` | String | Yes | Todo / In Progress / Completed / Cancelled; default Todo. Changed only through the status endpoint. |
| `startDate` | Date | Yes | Valid date. |
| `dueDate` | Date | Yes | Valid date, on/after `startDate`. |
| `completedDate` | Date / null | auto | Null until the task becomes Completed; set by the backend, never accepted from the frontend. |
| `createdAt`, `updatedAt` | Date | auto | Mongoose timestamps; `createdAt` is the Created Date. |

**Indexes**
- Unique: `taskId`
- Capacity/assignment: `{ assignedEmployee: 1, status: 1 }`
- Status/overdue: `{ status: 1, dueDate: 1 }`
- Filters: `{ department: 1, priority: 1, status: 1 }`
- Sorting: `{ createdAt: -1 }`, `{ dueDate: 1 }`, `{ title: 1 }`
- Employee-name search: `{ "employeeSnapshot.fullName": 1 }`

### 3.4 Counter model (internal)

Collection: `counters`

| Field | Type | Purpose |
|---|---|---|
| `_id` / `name` | String | Counter key, e.g. `task`. |
| `seq` | Number | Last issued sequence. |

`findOneAndUpdate({ name: 'task' }, { $inc: { seq: 1 } }, { upsert: true, new: true })` atomically issues the next Task ID. Format: `TSK-` + zero-padded sequence (at least 3 digits).

### 3.5 Employee → Task relationship

- One Employee has many Tasks.
- `Task.assignedEmployee` references `Employee._id` for the live relationship.
- `Task.employeeSnapshot` stores the meaningful employee details at assignment time.
- On employee deletion, the employee document is removed but snapshots remain, so old tasks still display Employee ID, name, email, and department.
- Tasks are never cascade-deleted when an employee is deleted.

### 3.6 Employee snapshot policy (approved 2026-10-20)

**Approved decision: the snapshot is immutable for the life of the task assignment.**

- The snapshot is written when a task is created.
- The snapshot is rewritten only when the task is reassigned to a different employee, because that is a new assignment event.
- Editing employee details (name, email, phone, department, role, status, skills, leave dates) **does not** update existing task snapshots.
- Task list, task detail, CSV, and search use the snapshot for employee display and employee-name search.
- The live employee document remains linked through `assignedEmployee`; the UI may offer a link to the employee view while the employee still exists.
- After employee deletion, the snapshot is the only source of employee details for old tasks and remains sufficient for meaningful display.

**Trade-off**

| Approach | Advantages | Disadvantages |
|---|---|---|
| **Immutable snapshot (recommended)** | Historical accuracy; simple writes; no bulk task updates; employee edits cannot partially fail across tasks; deletion is straightforward | After an employee rename or email change, old tasks continue to show the assignment-time details; searching by the new name will not find old tasks |
| Refreshed snapshot | Old tasks always show current employee details; current-name search works | Employee edits require bulk updates to every related task; partial failure can leave inconsistent snapshots; historical assignment details are overwritten; larger transaction scope |

**Recommendation:** keep the snapshot immutable. It directly satisfies the assignment requirement that old tasks retain meaningful employee details after deletion, avoids cross-collection bulk-update failure modes, and gives each task a stable historical record. If the product owner prefers current-name display, that requires an explicit change to the snapshot policy and a transactional bulk refresh.

### 3.7 Date policy

- Frontend sends date-only values (`YYYY-MM-DD`) for joining, leave, start, and due dates.
- Backend validates and normalizes date-only input to UTC midnight.
- Overdue comparisons use the current UTC date at midnight.
- Responses expose date-only values in `YYYY-MM-DD` format; `completedDate` is stored as a timestamp but displayed as a date.
- This avoids timezone drift between client, server, and CSV.

---

## 4. Business rules and enforcement

All rules below are enforced on the **backend** in the service layer. Frontend validation is a UX convenience only.

| # | Rule | Backend enforcement | Failure |
|---|---|---|---|
| 1 | Departments are fixed | Validate against enum on employee and task create/update. | 400 |
| 2 | No authentication | No auth middleware; APIs are public as required. | — |
| 3 | Assign only to an Active employee | Load the employee and require `status === 'Active'`. | 400 |
| 4 | Inactive employee is always rejected | Explicit status check. | 400 |
| 5 | On Leave employee allowed only when task Start Date is outside the leave period | Reject when `leaveStart <= startDate <= leaveEnd` (both inclusive). Allow when start date is before `leaveStart` or after `leaveEnd`. Only Start Date is checked. | 400 |
| 6 | Due Date cannot be earlier than Start Date | Normalize both dates and compare. | 400 |
| 7 | New tasks always start as Todo | Ignore/force server default; reject client-supplied `status` and `completedDate`. | 400 |
| 8 | Status flow is restricted | Validate against the transition matrix. | 400 |
| 9 | Status changes only through `PUT /api/tasks/:id/status` | Normal task update rejects a `status` field; status service is the only writer. | 400 |
| 10 | Completed and Cancelled tasks cannot be edited | Normal update checks current status and rejects. | 400 |
| 11 | Completed Date is backend-only | Set when transitioning to Completed; never read from request body. | — |
| 12 | Maximum 3 active tasks per employee | Active = Todo + In Progress. Transactional conditional increment of `activeTaskCount` on the employee document before inserting/reassigning an active task. The employee-document write serializes concurrent capacity decisions. | 400 |
| 13 | Overdue definition | `today > dueDate` AND status is not Completed/Cancelled. One shared helper used by list, detail, dashboard, and CSV. | — |
| 14 | Employee deletion blocked while active tasks exist | Transactional delete guarded by both an active-task existence check and `activeTaskCount === 0`; Completed/Cancelled tasks do not block. | 400 |
| 15 | Old tasks keep meaningful employee details | Immutable assignment snapshot retained on every task; no cascade delete; employee edits do not rewrite snapshots. | — |
| 16 | Duplicate Employee ID or email | Unique indexes plus pre-checks; email normalized lowercase; Employee ID normalized uppercase. | 409 |
| 17 | Invalid/missing records | Validate ObjectId and existence. | 400 invalid ID / 404 missing |
| 18 | Invalid data or broken rule | Field-level validation and service checks. | 400 |

### 4.1 Status transition matrix

| From \ To | Todo | In Progress | Completed | Cancelled |
|---|---|---|---|---|
| **Todo** | Rejected | Allowed | Rejected | Allowed |
| **In Progress** | Rejected | Rejected | Allowed | Allowed |
| **Completed** | Rejected | Rejected | Rejected | Rejected |
| **Cancelled** | Rejected | Rejected | Rejected | Rejected |

- Todo → In Progress
- In Progress → Completed (sets `completedDate` server-side)
- Todo → Cancelled
- In Progress → Cancelled
- Completed and Cancelled are terminal.
- Same-status requests are rejected as invalid transitions.
- The frontend status control shows only the valid next statuses, but the backend remains authoritative.

### 4.2 Capacity and concurrency — approved transactional design (2026-10-20)

- Active tasks: Todo + In Progress. Completed and Cancelled free capacity.
- `Employee.activeTaskCount` is a denormalized capacity guard, not an independent source of truth.
- **Why a transaction alone is not enough:** two transactions that each count 2 active tasks and then insert different task documents do not write to the same document, so both can commit and create a 4th task. The transaction must also write to the **same employee document** as a serialization point.
- **Create task** — one session transaction:
  1. Load and validate the employee (existence, status, leave conflict, dates).
  2. Conditionally increment the employee counter only when `activeTaskCount < 3`:
     `findOneAndUpdate({ _id, activeTaskCount: { $lt: 3 } }, { $inc: { activeTaskCount: 1 } }, { session, new: true })`.
  3. If no employee matches, abort with 400 "Employee already has 3 active tasks."
  4. Insert the task as Todo with its immutable snapshot.
  5. Commit.
  Concurrent creates for the same employee conflict on the employee document; one retries, sees the updated count, and is rejected if the limit is reached.
- **Reassign an active task** — one session transaction:
  - If the target employee is different: conditionally decrement the old employee (guard count `> 0`), conditionally increment the new employee (guard `< 3`), update `assignedEmployee` and the immutable snapshot, then commit.
  - If the target employee is the same: no counter change; revalidate leave/date rules.
  - Any failed write aborts the whole move; there is no partial reassignment.
- **Status update** — one session transaction:
  - Validate the transition, update `status` and `completedDate`, and decrement the counter when moving from Todo/In Progress to Completed/Cancelled.
  - Completed and Cancelled are terminal; no counter is decremented twice.
- **Delete task** — one session transaction:
  - Delete the task and, only if it was Todo/In Progress, decrement the employee counter.
- **Delete employee** — one session transaction:
  - Verify no Todo/In Progress task exists for the employee inside the transaction (defense in depth).
  - `findOneAndDelete({ _id, activeTaskCount: 0 }, { session })`.
  - If either check fails, return 400. Completed/Cancelled tasks are not cascade-deleted.
- **Dashboard workload** is computed from actual task aggregation, not trusted from `activeTaskCount`. The counter is only the capacity guard.

**Failure and recovery behavior**

| Failure point | Result |
|---|---|
| Validation fails before any write | No task/counter change. |
| Task insert, snapshot write, or employee update fails | Transaction aborts; counter and task are unchanged. |
| Status/delete transaction fails | Transaction aborts; status, completed date, task, and counter remain consistent. |
| Reassignment fails for the target employee | Transaction aborts; neither employee counter nor task assignment changes. |
| Transient error or write conflict | `session.withTransaction()` retries within a bounded retry policy; after exhaustion return a friendly 409/500 and no partial writes. |
| Unknown commit result | Retry the commit/transaction; MongoDB transactions are atomic. A committed write may be retried by the client, so create requests may optionally use an idempotency key to avoid duplicates. The counter remains correct for the committed state. |
| Retry after an ambiguous commit | Status/delete handlers re-read current state and return the committed result without decrementing twice; creation should use an idempotency key if the client retries automatically. |
| Process crash mid-transaction | MongoDB aborts the uncommitted transaction; no counter leak. |
| Suspected drift | Run the reconciliation routine in Section 4.5 before serving traffic or during a maintenance window. |

**Deployment and driver requirements**

- MongoDB must run as a **replica set**; multi-document transactions are unavailable on standalone `mongod`.
- Use MongoDB Atlas (replica-set cluster) in production, or a local single-node replica set for development.
- Use Mongoose sessions and `session.withTransaction()`; set transaction read/write concerns consistently (write concern majority for durability; snapshot/local read concern as appropriate).
- MongoDB 4.0+ is required; current Mongoose 8 / MongoDB Node driver 6 is expected.
- Integration tests must use `MongoMemoryReplSet` or an Atlas test database, never a standalone server.
- The task-ID counter may be incremented outside the task transaction to avoid a global hot document; gaps after failed transactions are acceptable because display IDs only need uniqueness, not gapless sequence. A unique index on `taskId` protects correctness.
- README answer #6 explains the race and why the employee-document write plus transaction is required.

### 4.3 Employee status changes after assignment

- Changing an employee to Inactive or On Leave does not automatically change or cancel existing tasks. The assignment does not require this.
- New assignment attempts are validated against the employee's current status and leave dates.
- Existing tasks remain visible and retain their history.

### 4.4 Task deletion

- Tasks may be deleted through the required CRUD API.
- Deleting an active (Todo/In Progress) task frees one capacity slot.
- Deleting a Completed/Cancelled task does not affect capacity.

### 4.5 Capacity reconciliation routine

Transactions should keep `activeTaskCount` exact, but a reconciliation routine provides operational recovery and a safety net after manual database changes or an unexpected failure.

1. Aggregate all tasks grouped by `assignedEmployee` where `status` is Todo or In Progress.
2. Compare each employee's actual count with `activeTaskCount`.
3. Update mismatched counters in a controlled batch.
4. Log every mismatch (employee ID, stored count, actual count).
5. Run before the HTTP listener starts or as a maintenance script with application writes paused; never run it concurrently with normal capacity-changing requests.
6. Test the routine with deliberately corrupted counts and verify it repairs them without changing task data.

The routine is not a substitute for transactions. It is a recovery tool, not the primary concurrency mechanism.

---

## 5. API design

### 5.1 Conventions

- Base URL: `/api`
- JSON request/response bodies.
- IDs in routes are Mongo `_id` values. Business IDs (`employeeId`, `taskId`) are returned in payloads.
- Success envelope:
  - Single: `{ "data": { ... } }`
  - List: `{ "data": [ ... ], "pagination": { "page": 1, "limit": 10, "total": 23, "totalPages": 3 } }`
  - Delete: `204 No Content`
- Error envelope:
  ```json
  {
    "message": "Human-readable summary",
    "errors": [{ "field": "dueDate", "message": "Due Date cannot be earlier than Start Date." }]
  }
  ```
- Status codes: `200`, `201`, `204`, `400` (validation/broken rule), `404` (missing record), `409` (duplicate employee ID/email), `500` (unexpected).
- Pagination defaults: `page=1`, `limit=10`, maximum `limit=100`.
- Invalid pagination or sort values return 400, not silent fallbacks.
- All list endpoints use the same query-parsing utility so filters combine with `$and` and do not overwrite each other.

### 5.2 Employee endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/employees` | List employees with pagination, search, filters, and sorting. |
| GET | `/api/employees/:id` | View one employee. |
| POST | `/api/employees` | Create an employee. |
| PUT | `/api/employees/:id` | Update an employee. |
| DELETE | `/api/employees/:id` | Delete an employee when no active tasks exist. |

**List query parameters**

| Parameter | Values / behavior |
|---|---|
| `search` | Partial, case-insensitive match on full name, employee ID, or email. |
| `department` | One of the five departments. |
| `status` | Active / Inactive / On Leave. |
| `sort` | `fullName` (default), `joiningDate`, `employeeId`. |
| `order` | `asc` (default) / `desc`. |
| `page`, `limit` | Pagination. |

**Create/update payload**

`employeeId`, `fullName`, `email`, `phone`, `department`, `role`, `joiningDate`, `status`, `skills`, `leaveStart`, `leaveEnd`.

- `leaveStart`/`leaveEnd` are required only when `status` is On Leave; otherwise they are rejected or normalized to null.
- `activeTaskCount` is ignored/rejected if sent by the client.
- Duplicate `employeeId` or `email` returns 409 with the offending field.
- Delete returns 400 when the employee has Todo/In Progress tasks; otherwise 204.

### 5.3 Task endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/tasks` | List tasks with pagination, search, combined filters, and sorting. |
| GET | `/api/tasks/:id` | View one task, including employee snapshot and `isOverdue`. |
| POST | `/api/tasks` | Create a task (always Todo). |
| PUT | `/api/tasks/:id` | Update task fields except status/completedDate; blocked for Completed/Cancelled. |
| DELETE | `/api/tasks/:id` | Delete a task. |
| PUT | `/api/tasks/:id/status` | Change status through the allowed transition matrix. |
| GET | `/api/tasks/export` | Download CSV of all tasks matching current filters/sort, ignoring pagination. |

**List query parameters**

| Parameter | Values / behavior |
|---|---|
| `search` | Partial, case-insensitive match on task title or employee name. |
| `department` | One of the five departments. |
| `priority` | Low / Medium / High / Critical. |
| `status` | Todo / In Progress / Completed / Cancelled. |
| `dueFrom`, `dueTo` | Inclusive date range on Due Date. `dueFrom <= dueTo`. |
| `sort` | `createdAt` (default), `dueDate`, `priority`, `title`. |
| `order` | `asc` / `desc`; default `createdAt desc`. For `priority`, `asc` means Critical → Low? Define explicitly: `priority` sorting uses importance rank. Default direction for priority is most important first. |
| `page`, `limit` | Pagination. |

- Search/filter/sort parameters combine; no filter replaces another.
- `isOverdue` is computed server-side for every row/detail.
- Task list rows include: `id`, `taskId`, `title`, `employee` snapshot, `department`, `priority`, `status`, `startDate`, `dueDate`, `createdAt`, `completedDate`, `isOverdue`.
- Export route must be registered before `/:id` to avoid being captured as an ID.

**Create payload**

`title`, `description`, `assignedEmployee` (employee `_id`), `department`, `priority`, `startDate`, `dueDate`.

- Reject any client-provided `taskId`, `status`, `completedDate`, or `createdAt`.
- Apply assignment, leave, date, and capacity rules.

**Update payload**

Same editable fields as create. Reject `status`, `completedDate`, `taskId`, and `createdAt`. Reject entirely when the current status is Completed or Cancelled.

**Status payload**

```json
{ "status": "In Progress" }
```

- Validate the transition against the matrix.
- Set `completedDate` to the server's current time when the new status is Completed.
- Return the updated task.
- The status endpoint is the only place that writes `status` after creation.

### 5.4 Dashboard endpoint

`GET /api/dashboard`

Returns all numbers from the server:

```json
{
  "data": {
    "employees": { "total": 12, "active": 8, "inactive": 2, "onLeave": 2 },
    "tasks": {
      "total": 40,
      "todo": 14,
      "inProgress": 9,
      "completed": 14,
      "cancelled": 3,
      "overdue": 5
    },
    "workload": [
      {
        "id": "employeeObjectId",
        "employeeId": "EMP-001",
        "fullName": "Rahul Sharma",
        "department": "Development",
        "activeTasks": 3
      }
    ]
  }
}
```

- Employee counts: total, Active, Inactive, On Leave.
- Task counts: total, Todo, In Progress, Completed, Cancelled, Overdue.
- Workload: active task count per employee (Todo + In Progress), sorted by count descending.
- No count is calculated in React.

### 5.5 CSV export

`GET /api/tasks/export?search=&department=&priority=&status=&dueFrom=&dueTo=&sort=&order=`

- Uses the same filter/search/sort builder as the list endpoint.
- **Ignores `page` and `limit`** and exports every matching task.
- Columns: Task ID, Title, Description, Employee ID, Employee Name, Employee Email, Department, Priority, Status, Start Date, Due Date, Created Date, Completed Date, Overdue.
- Properly quotes/escapes commas, quotes, and line breaks.
- Response headers:
  - `Content-Type: text/csv; charset=utf-8`
  - `Content-Disposition: attachment; filename="tasks-YYYY-MM-DD.csv"`
- Frontend uses the current URL filters (not just the visible page) and shows a loading state during download.

### 5.6 Health endpoint

`GET /api/health` → `200 { "status": "ok" }` for deployment health checks.

---

## 6. Frontend design

### 6.1 Routes

| Route | Screen |
|---|---|
| `/` | Redirect to `/dashboard` |
| `/dashboard` | Dashboard |
| `/employees` | Employee list |
| `/employees/new` | Add employee |
| `/employees/:id` | Employee view |
| `/employees/:id/edit` | Edit employee |
| `/tasks` | Task list |
| `/tasks/new` | Add task |
| `/tasks/:id` | Task view |
| `/tasks/:id/edit` | Edit task |
| `*` | Not found |

Each entity has separate List, Add, Edit, and View routes, as required.

### 6.2 Layout and navigation

- Persistent top header with brand/project name and navigation: Dashboard, Employees, Tasks.
- Dark charcoal header with warm off-white text; no blue.
- Mobile: compact header with a menu toggle; navigation stacks or opens as a panel.
- Main content constrained to a readable max width with generous spacing.
- Page-level headings, primary action buttons, and breadcrumb/back links on form/view pages.
- Responsive breakpoints: mobile (<640px), tablet (640–1023px), desktop (≥1024px).

### 6.3 Screen details

**Dashboard**
- Employee summary cards: Total Employees, Active, Inactive, On Leave.
- Task summary cards: Total Tasks, Todo, In Progress, Completed, Cancelled, Overdue.
- Employee Workload table: Employee, Department, Active Tasks.
- Optional quick links to filtered task lists (e.g., overdue) using URL query parameters.
- All values come from `GET /api/dashboard`.
- Loading skeletons and an error/retry state.

**Employee List**
- Search by name/Employee ID/email.
- Filters: department, status.
- Sorting: name, joining date, Employee ID.
- Pagination with page numbers and total count.
- Add Employee button.
- Row actions: View, Edit, Delete (with confirmation).
- Delete blocked message shown from the server if active tasks exist.
- URL state: `search`, `department`, `status`, `sort`, `order`, `page`.

**Employee Add/Edit**
- Fields: Employee ID, Full Name, Email, Phone, Department, Role, Joining Date, Status, Skills, Leave Start, Leave End.
- Leave dates appear only when Status = On Leave and are required in that case.
- Skills entered as a tag/comma-separated list and stored as an array.
- Client-side validation mirrors the server rules.
- Server field errors are displayed inline and as a friendly notification.
- Submit button shows loading state and prevents double submission.
- Edit page preloads the employee and handles 404.

**Employee View**
- Read-only employee details grouped into identity, contact, employment, and leave sections.
- Skills displayed as chips.
- Actions: Edit, Back, Delete (if allowed).
- Link to the task list filtered by the employee's name, using the same URL-search mechanism.

**Task List**
- Search by task title or employee name.
- Filters: department, priority, status, Due Date from/to.
- Sorting: created date, due date, priority importance, title.
- Export CSV button uses current filters.
- Add Task button.
- Columns: Task ID, Title, Employee, Priority, Status, Due Date (with overdue badge), Action.
- Status control shows only valid next statuses:
  - Todo → In Progress, Cancelled
  - In Progress → Completed, Cancelled
  - Completed/Cancelled → no status control
- Row actions: View, Edit (hidden/disabled for Completed/Cancelled), Delete (confirmation).
- Pagination and total count.
- URL state: `search`, `department`, `priority`, `status`, `dueFrom`, `dueTo`, `sort`, `order`, `page`.
- Example: `/tasks?status=In%20Progress&priority=High&page=2`.
- Refresh or opening the copied URL reproduces the same view.

**Task Add/Edit**
- Fields: Title, Assigned Employee, Priority, Department, Start Date, Due Date, Description.
- Employee selector shows name, Employee ID, department, and status; Inactive employees are visually marked and cannot be selected.
- On Leave employees remain selectable but the server rejects a Start Date inside their leave period; the form can show a hint.
- Status is not editable in this form.
- Completed/Cancelled tasks open as read-only or redirect to View; the Edit route is not offered.
- Server errors such as capacity, leave conflict, invalid dates, or assignment rejection are shown inline and in a toast.
- Submit loading state and double-submit protection.

**Task View**
- Read-only details: Task ID, title, description, employee snapshot, department, priority, status, start/due/created/completed dates, overdue badge.
- Status action showing only valid next statuses.
- Edit/Delete actions where allowed.
- Back link preserving previous list URL state.

### 6.4 URL state contract

- Use `useSearchParams` (React Router) as the single source of truth for list state.
- Defaults are omitted from the URL; invalid values are corrected or rejected safely.
- Changing search/filters resets `page` to 1.
- Debounce text search (approximately 300 ms) before updating the URL and refetching.
- Use browser back/forward safely; the view matches the URL.
- Export reads the current URL filters and excludes pagination.
- Employee list follows the same pattern with its own supported keys.

### 6.5 Reusable components

- Layout: `AppLayout`, `Header`, `MobileNav`, `PageHeader`, `Breadcrumbs`.
- Inputs: `TextInput`, `EmailInput`, `PhoneInput`, `DateInput`, `Select`, `TextArea`, `TagInput`, `FormField`, `FormError`.
- Data display: `DataTable`, `Pagination`, `StatusBadge`, `PriorityBadge`, `OverdueBadge`, `EmptyState`, `LoadingSkeleton`, `ErrorState`.
- Actions: `Button`, `IconButton`, `ActionMenu`, `ConfirmDialog`, `Toast`/`ToastProvider`.
- Domain: `EmployeeForm`, `TaskForm`, `EmployeeSummary`, `TaskSummary`, `WorkloadTable`.
- No page should contain duplicated form/table logic.
- No inline styles. All visual styling is expressed with Tailwind utility classes composed in components and variant helpers (for example, `clsx` + `tailwind-merge`). No CSS Modules, styled-components, Sass/Less, or component stylesheets.

### 6.6 Data fetching and state

- Central API client (Axios) with base URL from `VITE_API_BASE_URL`.
- Endpoint modules: employees, tasks, dashboard.
- Request cancellation for stale searches (AbortController) to avoid out-of-order results.
- Loading, empty, error, and success states for every data view.
- Global toast notifications for success/failure; inline field errors for validation.
- Confirmation dialog for destructive actions.
- No business-rule calculation in React; only display derived server values such as `isOverdue`.

### 6.7 Client-side validation

Mirror the server’s field rules:

- Required fields.
- Name/title/description length limits.
- Valid email and normalized display.
- Phone format.
- Employee ID format.
- Enums for department, status, priority.
- Date validity and Due Date ≥ Start Date.
- Leave dates required only for On Leave and Leave End ≥ Leave Start.
- Skills count/length.
- Assignment and capacity errors are server-only and displayed from the API response.

Client validation improves UX but never replaces backend enforcement.

### 6.8 Responsive behavior

- Desktop: full tables, inline filters, multi-column forms.
- Tablet: two-column forms collapse where needed; filter bar wraps.
- Mobile: single-column forms; tables either scroll horizontally with a clear affordance or switch to stacked record cards; primary actions remain reachable; header navigation collapses.
- Touch targets at least 44×44 px.
- Responsive behavior is implemented only with Tailwind breakpoint prefixes (`sm:`, `md:`, `lg:`, `xl:`); no custom media queries or component stylesheets.
- Test at common widths (360, 390, 768, 1024, 1440 px).

### 6.9 Accessibility

- Labels tied to every input.
- Keyboard-operable menus, dialogs, and pagination.
- Visible focus rings using Tailwind `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2` utilities.
- `aria-live` for toast notifications.
- Sufficient color contrast; status is never conveyed by color alone (text labels included).
- Semantic headings and table markup.
- Respect reduced-motion preferences for non-essential animation.

---

## 7. Tailwind-only, no-blue design system

The assignment’s reference design uses a warm, editorial palette. The implementation must contain **no blue, cyan, sky, indigo, or blue-tinted color** in any UI state, including links, focus rings, selection highlights, badges, forms, tables, charts, or component defaults.

### 7.1 Mandatory styling policy

- **Tailwind CSS is the only styling system.**
- No normal CSS files for components, layouts, themes, or responsive behavior.
- No CSS Modules, styled-components, Emotion, Sass/Less, Bootstrap, Material UI, Chakra, or another styling framework.
- No inline `style` attributes.
- No `@apply`, `@layer components`, custom selectors, or hand-written media queries.
- Use Tailwind utility classes for color, spacing, typography, layout, responsiveness, hover, focus, disabled, and dark/light surfaces.
- Reusable visual variants are composed in JavaScript with utility class strings (using `clsx` and `tailwind-merge` as utility composition helpers), not with CSS.
- Tailwind configuration belongs in `tailwind.config.js`; component behavior and styling remain in JSX utility classes.

### 7.2 Tailwind entry file — approved 2026-10-20

The project owner approved exactly one CSS entry file:

```text
client/src/index.css
```

It must contain exactly these three Tailwind directives and nothing else:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

This is a Tailwind build entry file, not a custom stylesheet. It contains no custom rules, component styles, layout rules, theme overrides, responsive rules, or `@apply`. Any additional CSS requires a new explicit owner decision; none is planned.

Tailwind CSS v3.4 is the approved version because its theme lives in `tailwind.config.js`, keeping the entry file free of custom theme rules. Tailwind v4’s CSS-first `@theme` configuration would place theme rules in a CSS file and conflict with the approved constraint.

### 7.3 Tailwind theme configuration

Define the design system in `tailwind.config.js` using a **custom `theme.colors` palette** rather than extending the default palette. Replacing the default palette prevents Tailwind from generating `blue-*`, `cyan-*`, `sky-*`, `indigo-*`, or other blue-tinted utility classes at all.

| Tailwind token | Value | Usage |
|---|---|---|
| `canvas` | `#F6F2EA` | Page background (warm off-white) |
| `surface` | `#FFFCF7` | Cards, forms, tables |
| `surface-muted` | `#EDE7DD` | Table headers, subtle panels |
| `border` | `#DDD4C6` | Borders and dividers |
| `ink` | `#26241F` | Primary text |
| `ink-muted` | `#666157` | Secondary text, metadata |
| `header` | `#2E2B25` | Dark top navigation bar |
| `primary` | `#8C432E` | Primary buttons, links |
| `primary-hover` | `#733524` | Primary hover/active |
| `primary-soft` | `#F5E5DE` | Primary-tinted backgrounds |
| `olive` | `#5E6B45` | Secondary accent |
| `olive-soft` | `#E7EBDC` | Success/completed backgrounds |
| `amber` | `#8A5A36` | In-progress/warning accent |
| `amber-soft` | `#F2E7D9` | In-progress/warning backgrounds |
| `rust` | `#96452F` | Overdue/danger accent |
| `rust-soft` | `#F4E4DE` | Overdue/danger backgrounds |
| `focus` | `#A34E36` | Focus ring |

The custom palette also includes `transparent`, `current`, `inherit`, `white`, and `black` for utility completeness. Configure content paths for `./index.html` and `./src/**/*.{js,jsx}`. No default Tailwind color family is available, so accidental blue classes fail to generate instead of leaking into the UI. Do not safelist blue utilities.

### 7.4 Status and priority utilities

**Status**

| Status | Tailwind classes |
|---|---|
| Todo | `bg-surface-muted text-ink-muted` |
| In Progress | `bg-amber-soft text-amber` |
| Completed | `bg-olive-soft text-olive` |
| Cancelled | `bg-rust-soft text-rust` |
| Overdue | `bg-rust-soft text-rust` plus an explicit “Overdue” label |

**Priority**

| Priority | Tailwind classes |
|---|---|
| Low | `text-ink-muted` |
| Medium | `text-amber` |
| High | `text-primary` |
| Critical | `bg-rust-soft text-primary-hover` |

Status is always conveyed by text as well as color; color alone is never the only signal.

### 7.5 Links, focus, selection, and native controls

- **Links:** use a shared `AppLink` component with `text-primary underline underline-offset-2 hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2`. Tailwind Preflight removes the browser’s default link styling; every link still uses these utilities explicitly.
- **Focus:** every interactive element uses `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas`. No browser-default blue outline.
- **Selection:** apply `selection:bg-primary-soft selection:text-ink` at the app shell so selected text is warm terracotta, not browser blue.
- **Checkboxes/radios:** use `accent-primary` plus the focus utilities; the checked fill is terracotta.
- **Selects:** use a custom accessible listbox/combobox built with Tailwind utilities (`button` + `ul`/`li`, `aria-expanded`, `aria-selected`, keyboard handling) instead of a native `<select>` popup. Native option highlighting is controlled by the operating system and can be blue.
- **Dates:** use a Tailwind-styled text input with `YYYY-MM-DD` placeholder and strict validation, or a custom Tailwind calendar only when needed. Native date-picker popups can highlight selections in browser blue and cannot be fully controlled with Tailwind utilities. Any custom control must be keyboard accessible, mobile usable, labelled, and validated.
- **`color-scheme`:** use the Tailwind arbitrary property `[color-scheme:light]` on form controls where supported. This is a Tailwind utility, not a custom stylesheet. It reduces dark-mode/native control interference but does not override every OS popup color.
- **Disabled states:** use `disabled:opacity-50 disabled:cursor-not-allowed` and explicit disabled classes, not custom CSS.
- **Browser-controlled surfaces:** autofill overlays, scrollbars, and native validation bubbles are not fully styleable with Tailwind utilities. If any such surface renders blue, implementation will pause and request approval rather than adding custom CSS.

### 7.6 Dark and light surfaces

- The application uses a light warm canvas with dark charcoal header/navigation surfaces.
- Use `bg-header text-surface` for dark surfaces and `bg-canvas text-ink` / `bg-surface` for light surfaces.
- No global dark-mode toggle is required by the assignment. If one is requested later, use Tailwind’s `dark:` variants with `darkMode: 'class'` and the same custom palette; no separate theme stylesheet.

### 7.7 Typography, spacing, and motion

- System font stack or a single warm readable sans-serif; no custom font stylesheet required.
- Use Tailwind’s `text-*`, `font-*`, `tracking-*`, and `leading-*` utilities for the type scale.
- Use Tailwind spacing utilities on the 4/8 px scale; no custom spacing CSS.
- Use `rounded-*`, `border-*`, `shadow-*`, and warm palette utilities for surfaces.
- Use `transition-*`, `duration-*`, and `motion-reduce:*` utilities for interaction feedback; no custom keyframes or CSS animations are planned.

### 7.8 Accessibility and no-blue audit

- Verify WCAG 2.1 AA contrast during Phase 9 (target ≥4.5:1 for body text and ≥3:1 for large text/UI boundaries). Adjust Tailwind palette values if a pair fails; never introduce blue.
- Audit the rendered UI and source for `blue`, `cyan`, `sky`, `indigo`, and blue-tinted hex values.
- Because the default Tailwind palette is replaced, blue utility classes are not generated. Verify that no arbitrary values, icons, images, or third-party components introduce blue.
- Test keyboard focus, selected text, checkboxes/radios, custom listboxes, custom date fields, and disabled states.
- Verify status is not conveyed by color alone.

**If any requirement cannot be met with Tailwind utilities or supported configuration, implementation must pause and request approval rather than adding a CSS file or inline style.**

---

## 8. Testing strategy

**Phase 0 status:** this section is a plan only. No tests have been run for this project. Test claims will only be made after the relevant commands are actually executed in later phases.

### 8.1 Backend tests

**Tools:** Jest + Supertest + `MongoMemoryReplSet` (replica set required for transactions) or a dedicated Atlas test database. A standalone MongoDB instance is not valid for capacity tests.

**Unit tests**
- Date normalization, date-only parsing, overdue helper.
- Priority importance rank.
- Status transition map.
- CSV escaping.
- Query parsing (page/limit/sort validation).
- Employee and task validators.

**Integration tests**
- Employee CRUD, pagination, search/filter/sort combinations.
- Duplicate Employee ID/email → 409; email normalization.
- Leave validation: required only for On Leave; end ≥ start.
- Employee delete blocked by Todo/In Progress tasks; allowed when only Completed/Cancelled; immutable snapshots survive deletion.
- Editing employee details does not rewrite existing task snapshots; reassignment writes a new snapshot.
- Task create: auto Task ID, forced Todo, null Completed Date.
- Assignment: Active allowed; Inactive rejected; On Leave rejected only when Start Date is inside the inclusive leave period; outside allowed; task spanning leave allowed when start is outside.
- Due Date before Start Date → 400.
- Capacity: 3 allowed, 4th rejected; Completed/Cancelled free a slot; reassignment checks target capacity.
- Concurrent create requests: no employee exceeds 3 active tasks; run against a replica set.
- Transaction rollback: inject a failure after the counter increment but before task insert, and after task insert but before commit; assert task and counter are unchanged.
- Reassignment rollback: target employee full or write failure leaves both employees and the task unchanged.
- Status/delete rollback: forced failure leaves status, completed date, task, and counter consistent.
- Reconciliation routine repairs deliberately corrupted counters and logs mismatches.
- Status transitions: every allowed transition succeeds; every other transition fails; Completed Date set only on completion.
- Normal update rejects `status`; Completed/Cancelled update rejected.
- Overdue appears consistently in list, detail, dashboard, and CSV.
- Search matches task title and employee name.
- Filters combine correctly; sorting works for createdAt, dueDate, priority, title.
- Pagination metadata is correct.
- CSV exports all filtered rows, not only the current page, and escapes correctly.
- Dashboard counts and workload match known test fixtures.
- 400/404/409 error responses and friendly messages.
- Invalid ObjectIds and missing records.

### 8.2 Frontend tests

**Tools:** Vitest + React Testing Library + Mock Service Worker.

- Component tests for inputs, badges, pagination, dialogs, toasts.
- Form validation tests for employee and task forms.
- Leave fields visibility/requirements.
- Task status dropdown options per status.
- Completed/Cancelled tasks cannot be edited from the UI.
- URL query parsing/serialization; refresh restores state.
- Filters reset page to 1.
- API error messages render inline and as notifications.
- Loading and empty states.
- Export builds the correct URL without pagination.
- Tailwind-only styling: no `style` props, no CSS Module imports, no styled-components imports.
- Custom listbox/date field keyboard behavior and focus-visible ring classes.
- No generated `blue-*`, `cyan-*`, `sky-*`, or `indigo-*` classes in the build output.

### 8.3 End-to-end tests

**Tool:** Playwright (critical flows only).

1. Create an employee.
2. Create a task for an Active employee.
3. Reject an Inactive employee assignment.
4. Reject an On Leave assignment whose Start Date is inside leave.
5. Reject a fourth active task.
6. Move Todo → In Progress → Completed; verify Completed Date.
7. Verify invalid status transitions are not offered.
8. Filter/sort/paginate tasks; refresh the URL; verify the same view.
9. Export CSV and verify it contains all matching rows.
10. Verify an employee with an active task cannot be deleted; after completion, deletion succeeds and old tasks still show employee details.

### 8.4 Manual QA

- Mobile/tablet/desktop layouts using Tailwind breakpoints.
- Keyboard-only navigation.
- Screen-reader labels for forms, tables, and notifications.
- No-blue visual audit (including focus, links, selected text, custom listboxes, custom date fields, and disabled states).
- Source/build audit confirms no blue/cyan utility classes or blue hex values.
- No inline styles or non-Tailwind stylesheets.
- Browser console free of errors.
- Empty, loading, error, and success states.
- CSV opens correctly in a spreadsheet application.
- Deployed frontend/backend smoke test.

### 8.5 Definition of done

- All required business rules pass automated tests.
- Frontend build and backend start without errors.
- All list state survives refresh via the URL.
- CSV matches the active filters, not the visible page.
- No blue, cyan, sky, or indigo appears in the UI.
- README and `.env.example` are complete.
- Deployment URLs are live and documented.
- Assignment checklist in Section 11 is fully satisfied.

---

## 9. Deployment plan

### 9.1 Environments

| Environment | Purpose |
|---|---|
| Local | Local single-node MongoDB replica set or Atlas development cluster. Standalone MongoDB is not supported for the transactional capacity path. |
| Production | MongoDB Atlas replica-set cluster + Render/Railway backend + Vercel/Netlify frontend. |

### 9.2 Environment variables

**`server/.env.example`**

```text
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/etms
CLIENT_ORIGIN=http://localhost:5173
```

**`client/.env.example`**

```text
VITE_API_BASE_URL=http://localhost:5000/api
```

Production values are set in the hosting dashboards, never committed.

### 9.3 Backend deployment

- Create a MongoDB Atlas cluster and database user with least privilege.
- Configure network access for the hosting provider.
- Deploy `server/` as a Node web service on Render/Railway.
- The project owner configures and runs dependency installation/build/start commands; the agent does not execute or configure automated package installation.
- Start `src/server.js` after the owner’s dependency setup.
- Set production `MONGODB_URI`, `PORT`, `CLIENT_ORIGIN`, and `NODE_ENV`.
- The Atlas cluster must be a replica set so transactions work; verify the selected tier supports multi-document transactions.
- Use `/api/health` as the health check.
- CORS allows only the deployed frontend origin(s).

### 9.4 Frontend deployment

- Deploy `client/` to Vercel or Netlify.
- The project owner runs the install/build commands; the agent recommends but does not execute them.
- Build output directory: `dist`.
- Set `VITE_API_BASE_URL` to the deployed backend `/api` URL.
- Add SPA rewrite: all non-file routes → `index.html` so React Router deep links work.
- Verify the Tailwind-only build, no-blue palette, and responsive layout on the deployed build.

### 9.5 Post-deployment smoke tests

- Open every route directly (deep link).
- Dashboard loads server counts.
- Create/edit/view employee.
- Create/edit/view task.
- Test assignment rules and capacity.
- Test status transitions and Completed Date.
- Test search/filter/sort/pagination and URL refresh.
- Download CSV with filters and verify all matching rows.
- Test employee deletion with/without active tasks.

### 9.6 README and submission

`README.md` must include:

- Project overview and stack.
- Local setup for client, server, and MongoDB.
- Environment variables and `.env.example` references.
- API overview with methods and routes.
- Mongoose schema summary and Employee → Task relationship.
- Employee deletion strategy (hard delete + immutable task snapshot).
- Assumptions.
- Deployment URLs (frontend and backend).
- The six required brief answers:
  1. Where status transitions are validated and why.
  2. Why Completed Date comes from the backend.
  3. How inactive/on-leave assignment is blocked.
  4. Why filtering and pagination are on the backend.
  5. Why filters live in the URL.
  6. What can go wrong if two requests assign a fourth active task at the same time.

Final submission: owner-managed Git repository or zip named `FirstName_LastName.zip`, with no `node_modules`, no `.env`, and no secrets committed.

### 9.7 Recommended dependencies and manual installation commands

**Policy:** the project owner installs all dependencies manually. The agent will not run `npm install`, `npm i`, `npx`, `npm create`, or any other package installation/scaffolding command. The commands below are recommendations for later phases only.

Recommended runtime: Node.js 20 LTS or newer, npm included with Node.

**Client runtime dependencies**

```bash
cd client
npm install react react-dom react-router-dom axios clsx tailwind-merge
```

**Client development dependencies**

```bash
cd client
npm install -D vite @vitejs/plugin-react tailwindcss@^3.4.17 postcss autoprefixer
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event msw @playwright/test
npx tailwindcss init -p
```

The `npx tailwindcss init -p` command is run manually by the owner and generates `tailwind.config.js` and `postcss.config.js`. The minimal `client/src/index.css` Tailwind entry file is created during Phase 1 and contains only the three Tailwind directives described in Section 7.2.

**Server runtime dependencies**

```bash
cd server
npm install express mongoose cors dotenv express-validator
```

**Server development dependencies**

```bash
cd server
npm install -D nodemon jest supertest mongodb-memory-server
```

**Notes**

- `mongodb-memory-server` must be used as `MongoMemoryReplSet` for transaction tests.
- No CSV library is required; the CSV writer is implemented with native JavaScript.
- No date library is required; date-only normalization uses native `Date`/UTC helpers.
- `helmet`, `morgan`, `compression`, ESLint, and Prettier are optional improvements, not required dependencies.
- No package installation, lockfile generation, or dependency setup will be performed by the agent.

### 9.8 Git and phase handoff policy

- The project owner manages Git entirely.
- The agent will **not** run `git init`, `git add`, `git commit`, `git push`, `git reset`, or any other command that changes repository state.
- Read-only inspection of files is permitted when needed.
- After each phase, the agent will report:
  1. A summary of the phase.
  2. Every file created or modified.
  3. Commands actually run (or “none”).
  4. Tests actually run and their real results, or “not run.”
  5. A suggested commit message.
- The owner reviews and commits manually. The agent will not claim tests passed unless they were actually executed.

**Suggested commit messages (owner applies manually)**

| Phase | Suggested commit message |
|---|---|
| 0 | `docs: add phase 0 implementation plan` |
| 1 | `chore: scaffold MERN apps with Tailwind theme` |
| 2 | `feat(server): add employee, task, and counter models` |
| 3 | `feat(server): implement employee APIs and validation` |
| 4 | `feat(server): implement task APIs with transactional capacity` |
| 5 | `feat(server): add workflow, dashboard, and CSV export` |
| 6 | `feat(client): add Tailwind app shell and dashboard` |
| 7 | `feat(client): add employee list and CRUD screens` |
| 8 | `feat(client): add task list and workflow screens` |
| 9 | `test: harden validation, accessibility, and documentation` |
| 10 | `chore: prepare deployment and final submission` |

---

## 10. Phase-wise implementation

### 10.1 Roadmap overview

| Phase | Stage | Focus |
|---|---|---|
| 0 | Planning | Assignment analysis, architecture, rules, approved plan |
| 1 | Foundation | Repository structure, Tailwind theme, database connection, health check |
| 2 | Backend | Data models, enums, shared domain rules |
| 3 | Backend | Employee APIs and validation |
| 4 | Backend | Task APIs, assignment rules, transactional capacity |
| 5 | Backend | Status workflow, dashboard, CSV export |
| 6 | Frontend | Tailwind foundation, app shell, dashboard |
| 7 | Frontend | Employee screens |
| 8 | Frontend | Task screens |
| 9 | Testing and hardening | Full test pass, accessibility, no-blue audit, documentation |
| 10 | Deployment | Atlas/Render/Vercel configuration, smoke tests, submission |

### Phase 0 — Planning: analysis and plan (current)

**Deliverable:** `PHASE_0_PLAN.md`
**Exit criteria:** Phase 0 approved on 2026-10-20. Stack, scope, models, rules, APIs, UI, palette, testing, deployment, dependency policy, and Git policy are recorded. No application code, installs, Git operations, or tests.

### Phase 1 — Foundation: project scaffolding and Tailwind setup

- Create `client/` (React + Vite) and `server/` (Express) with separate `package.json` files.
- Add folder structure, linting/formatting, `.gitignore`, `.env.example` files.
- Add MongoDB connection, environment loading, `/api/health`, central error middleware.
- Configure Tailwind v3 with the custom warm palette in `tailwind.config.js`.
- Add the minimal `client/src/index.css` entry file containing only Tailwind directives.
- Build the base app shell and typography using Tailwind utility classes only.
- **Exit:** Both apps run locally; health endpoint returns 200; no blue utility classes are generated; no business features yet.

### Phase 2 — Backend: data models and shared domain

- Implement Employee, Task, and Counter models with indexes and timestamps.
- Add shared enums, date utilities, priority rank, status transition map.
- Add model-level validation and serialization helpers.
- Add the immutable employee snapshot structure to the Task model.
- **Exit:** Model tests pass; indexes verified; transaction/replica-set test harness is available.

### Phase 3 — Backend: employee APIs

- Employee CRUD, pagination, search, filters, sorting.
- Duplicate ID/email handling (409), email normalization.
- Leave date validation.
- Employee deletion guard; employee edits do not rewrite task snapshots.
- Integration tests.
- **Exit:** All employee APIs and rules pass tests.

### Phase 4 — Backend: task APIs and transactional capacity

- Task CRUD, auto Task ID, forced Todo on create, immutable snapshot capture.
- Assignment rules, leave conflict, due-date rule.
- Transactional capacity guard and reassignment inside a session transaction.
- Replica-set integration tests for rollback and concurrency.
- Capacity reconciliation routine.
- **Exit:** All create/update/assignment/capacity/rollback tests pass; no employee exceeds 3 active tasks.

### Phase 5 — Backend: status workflow, dashboard, and CSV

- Status transition endpoint and Completed Date.
- Edit lock for Completed/Cancelled; normal update rejects status.
- Overdue helper used by list/detail/dashboard/CSV.
- Dashboard aggregation and workload.
- CSV export with all active filters.
- Integration tests.
- **Exit:** Workflow, dashboard, and CSV tests pass.

### Phase 6 — Frontend: Tailwind foundation and dashboard

- React Router, app layout, responsive header/navigation using Tailwind utilities.
- API client, shared Tailwind-styled components, toast provider.
- Tailwind theme verification: no blue classes generated, focus/link states warm.
- Dashboard page and loading/error states.
- **Exit:** Dashboard displays server data; layout works at all breakpoints; no blue or inline styles.

### Phase 7 — Frontend: employee screens

- Employee list, add, edit, view pages.
- URL state for search/filter/sort/page.
- Form validation, leave fields, skills input.
- Delete confirmation and server error display.
- Frontend tests.
- **Exit:** Employee flows work end-to-end; all styling is Tailwind utilities.

### Phase 8 — Frontend: task screens

- Task list, add, edit, view pages.
- Search, combined filters, sorting, pagination in URL.
- Status control with valid next statuses only.
- Export CSV using current filters.
- Overdue badges and edit locks.
- Custom Tailwind-styled listbox and date field behavior.
- Frontend tests.
- **Exit:** Task flows work end-to-end and survive refresh/copied URL.

### Phase 9 — Testing and hardening

- Full backend test suite, including transaction and concurrency tests.
- Full frontend and E2E test suite.
- Full error/loading/empty-state pass.
- Responsive and accessibility audit.
- No-blue audit and contrast check.
- Tailwind-only audit: no CSS Modules, styled-components, inline styles, or blue utilities.
- README, `.env.example`, API/schema documentation.
- **Exit:** All tests pass; docs complete; no console errors; no unresolved styling violations.

### Phase 10 — Deployment and final QA

- MongoDB Atlas replica-set setup.
- Owner deploys backend and frontend and configures environment variables.
- Configure CORS and SPA rewrite.
- Run post-deployment smoke tests.
- Verify assignment checklist and submission packaging.
- **Exit:** Live URLs work; README updated; final submission ready.

**Phase handoff:** after every phase, provide the report required by Section 9.8 and wait for owner review before starting the next phase. The owner commits manually.

---

## 11. Assignment acceptance checklist

| Requirement | Planned coverage |
|---|---|
| React frontend | `client/` with React + Vite |
| Node.js + Express backend | `server/` with Express |
| MongoDB + Mongoose | Employee, Task, Counter models |
| JavaScript only | No TypeScript/Python in implementation |
| Employee fields | Employee ID, name, email, phone, department, role, joining date, status, skills, conditional leave dates |
| Task fields | Auto Task ID, title, description, employee, department, priority, status, start/due/created/completed dates |
| Fixed departments | Enum validation on both models |
| No login/auth | No auth layer |
| Assignment rules | Active/Inactive/On Leave checks with inclusive leave range |
| Due Date ≥ Start Date | Backend and frontend validation |
| Status flow | Transition matrix; only status endpoint writes status |
| Completed Date | Backend-set on completion |
| Capacity 3 | Transactional `activeTaskCount` guard + replica-set concurrency and rollback tests |
| Overdue consistency | Shared helper for list/detail/dashboard/CSV |
| Employee deletion | Blocked with active tasks; immutable snapshot preserves old task details |
| CRUD + pagination | Employee and Task APIs |
| Status API | `PUT /api/tasks/:id/status` |
| Dashboard API | Server-side counts and workload |
| CSV API | All filtered tasks, not just current page |
| Server search/filter/sort | Query builder with combined filters |
| Error codes | 400/404/409 and consistent error envelope |
| Responsive design | Tailwind breakpoint utilities; mobile/tablet/desktop layouts |
| Styling | Tailwind CSS v3.4 exclusively; no blue/cyan/sky/indigo; no custom stylesheets beyond the minimal Tailwind entry file |
| Field validation | Frontend + backend |
| Required screens | Dashboard, Employee List/Add/Edit/View, Task List/Add/Edit/View |
| URL state | Search/filter/sort/page persisted; refresh-safe |
| Valid status options only | Frontend dropdown mirrors backend matrix |
| Friendly notifications | Toast + inline errors |
| Multiple routes | List/Add/Edit/View for both entities |
| Reusable components | Shared component library |
| Consistent file structure | `client/src` and `server/src` conventions |
| Loading/success/failure states | All data views and forms |
| No negative points | No inline styles, no client-side filtering/pagination, no mock data, no secrets |
| README | Setup, env, API, schema, relationship, deletion, assumptions, six answers |
| `.env.example` | Client and server examples |
| Deployment | Atlas replica set + Render/Railway + Vercel/Netlify |
| Submission | Owner-managed Git/zip + live URLs |
| Dependency policy | Owner installs manually; agent does not install packages |
| Git policy | Owner manages Git; agent provides commit suggestions only |

---

## 12. Approved decisions and operating assumptions

All items below are approved for planning as of 2026-10-20. Any change requires a new explicit owner decision.

1. **JavaScript only** — no TypeScript, consistent with the assignment and the approved stack.
2. **Task ID format** — server-generated `TSK-001`, `TSK-002`, etc., matching the reference design.
3. **Employee deletion** — hard delete when no Todo/In Progress tasks; immutable assignment snapshots preserve old task details.
4. **Snapshot policy** — snapshot is written on task creation/reassignment and is never rewritten by employee edits. See Section 3.6.
5. **Date handling** — date-only fields normalized to UTC midnight; overdue uses the current UTC date.
6. **Task Department** — selected independently and not required to match the employee’s department, because the assignment does not state such a rule.
7. **On Leave assignment** — allowed when the task Start Date is outside the leave period; a task that spans the leave period is allowed only if its Start Date is outside it, exactly as specified.
8. **Pagination default** — 10 rows per page, maximum 100.
9. **Employee list controls** — search/filter/sort parity with the task list, following the design note that the Employee listing follows the same pattern.
10. **Employee status changes** — do not auto-modify existing tasks; only new assignments are validated against current status/leave dates.
11. **No seed/mock data in the application** — development seed data, if used at all, will be an optional local utility and never required at runtime.
12. **Capacity transactions — approved with conditions** — use MongoDB transactions for capacity enforcement. Production uses MongoDB Atlas; development/testing uses a local single-node replica set when transactions are required. Conditional employee-counter updates, transactional task writes, safe transaction retries, and concurrency tests are mandatory. Standalone MongoDB is not supported for capacity-changing operations.
13. **Tailwind entry file — approved with conditions** — `client/src/index.css` may contain exactly the three Tailwind directives (`@tailwind base;`, `@tailwind components;`, `@tailwind utilities;`) and nothing else. No custom CSS rules, component stylesheets, CSS Modules, inline styles, or `@apply`.
14. **Custom controls — approved only when necessary** — Tailwind-styled custom listboxes and date fields may be used to avoid blue native control styling. They must be keyboard accessible, mobile usable, properly labelled, and validated. Native controls remain acceptable where they do not introduce blue styling.
15. **Dependency and Git policy** — the project owner installs all dependencies and runs all Git commands. The agent provides commands and commit suggestions only and never executes installation, scaffolding, or Git commands.

---

## 13. Phase 0 status and next step

- Phase 0 is complete and approved as of 2026-10-20.
- No application source code, dependency installation, Git operation, deletion, or test execution occurred in Phase 0.
- Phase 1 will begin only after the owner's explicit instruction.
- When Phase 1 begins, the owner installs dependencies and manages Git manually; the agent works within the approved plan and reports changes, commands, and real test results after each phase.

**This plan is the Phase 0 deliverable. The agent is stopped and waiting for explicit Phase 1 authorization.**
