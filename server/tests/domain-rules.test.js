const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { TASK_STATUS, TASK_STATUSES } = require('../src/constants/domain');
const { compareDateOnly, formatDateOnly, isValidDate, toUtcDateOnly } = require('../src/utils/dateOnly');
const {
  canTransitionTaskStatus,
  getAllowedTaskStatusTransitions,
  getTaskPriorityRank,
  isActiveTaskStatus,
  isTaskOverdue,
  isTerminalTaskStatus,
} = require('../src/utils/taskRules');
const {
  ASSIGNMENT_INELIGIBILITY_REASON,
  getEmployeeAssignmentEligibility,
  isDateWithinInclusiveRange,
} = require('../src/utils/employeeRules');
const {
  createEmployeeSnapshot,
  resolveEmployeeSnapshot,
  shouldRefreshEmployeeSnapshot,
} = require('../src/utils/employeeSnapshot');
const { formatTaskId } = require('../src/utils/taskId');

describe('date-only utilities', () => {
  it('normalizes date-only strings to UTC midnight', () => {
    assert.equal(toUtcDateOnly('2024-02-29').toISOString(), '2024-02-29T00:00:00.000Z');
    assert.equal(toUtcDateOnly(new Date('2024-02-29T23:30:00.000Z')).toISOString(), '2024-02-29T00:00:00.000Z');
    assert.equal(formatDateOnly('2024-02-29'), '2024-02-29');
  });

  it('rejects impossible or non-date-only values', () => {
    assert.equal(isValidDate(toUtcDateOnly('2023-02-29')), false);
    assert.equal(isValidDate(toUtcDateOnly('2024-04-31')), false);
    assert.equal(isValidDate(toUtcDateOnly('2024-01-01T10:00:00.000Z')), false);
    assert.equal(isValidDate(toUtcDateOnly('not-a-date')), false);
    assert.equal(formatDateOnly('2024-04-31'), null);
  });

  it('compares UTC calendar days', () => {
    assert.equal(compareDateOnly('2024-06-10', '2024-06-10'), 0);
    assert.equal(compareDateOnly('2024-06-11', '2024-06-10'), 1);
    assert.equal(compareDateOnly('2024-06-09', '2024-06-10'), -1);
    assert.equal(compareDateOnly('invalid', '2024-06-10'), null);
  });
});

describe('task workflow rules', () => {
  const expectedTransitions = {
    Todo: {
      Todo: false,
      'In Progress': true,
      Completed: false,
      Cancelled: true,
    },
    'In Progress': {
      Todo: false,
      'In Progress': false,
      Completed: true,
      Cancelled: true,
    },
    Completed: {
      Todo: false,
      'In Progress': false,
      Completed: false,
      Cancelled: false,
    },
    Cancelled: {
      Todo: false,
      'In Progress': false,
      Completed: false,
      Cancelled: false,
    },
  };

  it('covers every allowed and rejected status transition', () => {
    for (const fromStatus of TASK_STATUSES) {
      for (const toStatus of TASK_STATUSES) {
        assert.equal(
          canTransitionTaskStatus(fromStatus, toStatus),
          expectedTransitions[fromStatus][toStatus],
          `${fromStatus} -> ${toStatus}`,
        );
      }
    }
  });

  it('returns only the valid next statuses', () => {
    assert.deepEqual(getAllowedTaskStatusTransitions(TASK_STATUS.TODO), [
      TASK_STATUS.IN_PROGRESS,
      TASK_STATUS.CANCELLED,
    ]);
    assert.deepEqual(getAllowedTaskStatusTransitions(TASK_STATUS.IN_PROGRESS), [
      TASK_STATUS.COMPLETED,
      TASK_STATUS.CANCELLED,
    ]);
    assert.deepEqual(getAllowedTaskStatusTransitions(TASK_STATUS.COMPLETED), []);
    assert.deepEqual(getAllowedTaskStatusTransitions(TASK_STATUS.CANCELLED), []);
    assert.deepEqual(getAllowedTaskStatusTransitions('Unknown'), []);
  });

  it('identifies active and terminal statuses', () => {
    assert.equal(isActiveTaskStatus(TASK_STATUS.TODO), true);
    assert.equal(isActiveTaskStatus(TASK_STATUS.IN_PROGRESS), true);
    assert.equal(isActiveTaskStatus(TASK_STATUS.COMPLETED), false);
    assert.equal(isActiveTaskStatus(TASK_STATUS.CANCELLED), false);
    assert.equal(isTerminalTaskStatus(TASK_STATUS.COMPLETED), true);
    assert.equal(isTerminalTaskStatus(TASK_STATUS.CANCELLED), true);
    assert.equal(isTerminalTaskStatus(TASK_STATUS.TODO), false);
  });

  it('ranks priorities by importance', () => {
    assert.ok(getTaskPriorityRank('Critical') > getTaskPriorityRank('High'));
    assert.ok(getTaskPriorityRank('High') > getTaskPriorityRank('Medium'));
    assert.ok(getTaskPriorityRank('Medium') > getTaskPriorityRank('Low'));
    assert.equal(getTaskPriorityRank('Unknown'), 0);
  });

  it('uses UTC date-only overdue boundaries and excludes terminal statuses', () => {
    const dueDate = '2024-06-15';

    assert.equal(isTaskOverdue({ dueDate, status: TASK_STATUS.TODO, now: '2024-06-14T23:59:59Z' }), false);
    assert.equal(isTaskOverdue({ dueDate, status: TASK_STATUS.TODO, now: '2024-06-15T23:59:59Z' }), false);
    assert.equal(isTaskOverdue({ dueDate, status: TASK_STATUS.TODO, now: '2024-06-16T00:00:00Z' }), true);
    assert.equal(
      isTaskOverdue({ dueDate, status: TASK_STATUS.IN_PROGRESS, now: '2024-06-16T00:00:00Z' }),
      true,
    );
    assert.equal(
      isTaskOverdue({ dueDate, status: TASK_STATUS.COMPLETED, now: '2024-06-16T00:00:00Z' }),
      false,
    );
    assert.equal(
      isTaskOverdue({ dueDate, status: TASK_STATUS.CANCELLED, now: '2024-06-16T00:00:00Z' }),
      false,
    );
    assert.equal(isTaskOverdue({ dueDate: null, status: TASK_STATUS.TODO, now: new Date() }), false);
  });
});

describe('employee assignment eligibility', () => {
  const onLeaveEmployee = {
    status: 'On Leave',
    leaveStart: '2024-06-10',
    leaveEnd: '2024-06-14',
  };

  it('allows active employees subject to the later capacity check', () => {
    assert.deepEqual(getEmployeeAssignmentEligibility({ status: 'Active' }, '2024-06-01'), {
      eligible: true,
      reason: null,
    });
  });

  it('always rejects inactive employees', () => {
    assert.deepEqual(getEmployeeAssignmentEligibility({ status: 'Inactive' }, '2024-06-01'), {
      eligible: false,
      reason: ASSIGNMENT_INELIGIBILITY_REASON.EMPLOYEE_INACTIVE,
    });
  });

  it('treats both leave boundaries as inclusive', () => {
    assert.equal(getEmployeeAssignmentEligibility(onLeaveEmployee, '2024-06-09').eligible, true);
    assert.equal(getEmployeeAssignmentEligibility(onLeaveEmployee, '2024-06-10').eligible, false);
    assert.equal(getEmployeeAssignmentEligibility(onLeaveEmployee, '2024-06-12').eligible, false);
    assert.equal(getEmployeeAssignmentEligibility(onLeaveEmployee, '2024-06-14').eligible, false);
    assert.equal(getEmployeeAssignmentEligibility(onLeaveEmployee, '2024-06-15').eligible, true);
    assert.equal(
      getEmployeeAssignmentEligibility(onLeaveEmployee, '2024-06-14T23:59:59.000Z').eligible,
      false,
    );
  });

  it('checks inclusive date ranges using UTC calendar days', () => {
    assert.equal(isDateWithinInclusiveRange('2024-06-10', '2024-06-10', '2024-06-14'), true);
    assert.equal(isDateWithinInclusiveRange('2024-06-14', '2024-06-10', '2024-06-14'), true);
    assert.equal(isDateWithinInclusiveRange('2024-06-09', '2024-06-10', '2024-06-14'), false);
    assert.equal(isDateWithinInclusiveRange('2024-06-15', '2024-06-10', '2024-06-14'), false);
  });

  it('rejects invalid leave ranges and invalid start dates', () => {
    assert.deepEqual(
      getEmployeeAssignmentEligibility(
        { status: 'On Leave', leaveStart: null, leaveEnd: null },
        '2024-06-01',
      ),
      { eligible: false, reason: ASSIGNMENT_INELIGIBILITY_REASON.INVALID_LEAVE_RANGE },
    );
    assert.deepEqual(
      getEmployeeAssignmentEligibility(
        { status: 'On Leave', leaveStart: '2024-06-14', leaveEnd: '2024-06-10' },
        '2024-06-01',
      ),
      { eligible: false, reason: ASSIGNMENT_INELIGIBILITY_REASON.INVALID_LEAVE_RANGE },
    );
    assert.deepEqual(getEmployeeAssignmentEligibility(onLeaveEmployee, 'invalid'), {
      eligible: false,
      reason: ASSIGNMENT_INELIGIBILITY_REASON.INVALID_START_DATE,
    });
  });

  it('rejects missing and unknown employee states', () => {
    assert.deepEqual(getEmployeeAssignmentEligibility(null, '2024-06-01'), {
      eligible: false,
      reason: ASSIGNMENT_INELIGIBILITY_REASON.EMPLOYEE_NOT_FOUND,
    });
    assert.deepEqual(getEmployeeAssignmentEligibility({ status: 'Unknown' }, '2024-06-01'), {
      eligible: false,
      reason: ASSIGNMENT_INELIGIBILITY_REASON.UNKNOWN_EMPLOYEE_STATUS,
    });
  });
});

describe('employee snapshot rules', () => {
  it('captures only the approved snapshot fields and normalizes identity values', () => {
    const employee = {
      employeeId: ' emp-001 ',
      fullName: ' Aarav Sharma ',
      email: ' AARAV@EXAMPLE.COM ',
      department: 'Development',
      phone: '+91 98765 43210',
      status: 'Active',
    };

    const snapshot = createEmployeeSnapshot(employee);

    assert.deepEqual(snapshot, {
      employeeId: 'EMP-001',
      fullName: 'Aarav Sharma',
      email: 'aarav@example.com',
      department: 'Development',
    });
    assert.deepEqual(Object.keys(snapshot).sort(), [
      'department',
      'email',
      'employeeId',
      'fullName',
    ]);
  });

  it('keeps the captured snapshot independent of later employee edits', () => {
    const employee = {
      employeeId: 'EMP-001',
      fullName: 'Aarav Sharma',
      email: 'aarav@example.com',
      department: 'Development',
    };
    const snapshot = createEmployeeSnapshot(employee);

    employee.fullName = 'Changed Name';
    employee.email = 'changed@example.com';

    assert.equal(snapshot.fullName, 'Aarav Sharma');
    assert.equal(snapshot.email, 'aarav@example.com');
  });

  it('refreshes only when the assignment changes', () => {
    assert.equal(shouldRefreshEmployeeSnapshot('employee-a', 'employee-a'), false);
    assert.equal(shouldRefreshEmployeeSnapshot('employee-a', 'employee-b'), true);
    assert.equal(shouldRefreshEmployeeSnapshot(null, 'employee-b'), true);
    assert.equal(resolveEmployeeSnapshot('employee-a', { _id: 'employee-a' }), null);
    assert.deepEqual(resolveEmployeeSnapshot('employee-a', {
      _id: 'employee-b',
      employeeId: 'EMP-002',
      fullName: 'Neha Verma',
      email: 'neha@example.com',
      department: 'Design',
    }), {
      employeeId: 'EMP-002',
      fullName: 'Neha Verma',
      email: 'neha@example.com',
      department: 'Design',
    });
  });
});

describe('task ID formatting', () => {
  it('formats sequences with at least three digits', () => {
    assert.equal(formatTaskId(1), 'TSK-001');
    assert.equal(formatTaskId(42), 'TSK-042');
    assert.equal(formatTaskId(1000), 'TSK-1000');
  });

  it('rejects invalid sequences', () => {
    assert.throws(() => formatTaskId(0), TypeError);
    assert.throws(() => formatTaskId(-1), TypeError);
    assert.throws(() => formatTaskId(1.5), TypeError);
    assert.throws(() => formatTaskId('1'), TypeError);
  });
});
