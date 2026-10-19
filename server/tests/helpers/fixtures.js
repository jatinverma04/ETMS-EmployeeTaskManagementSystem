const { Types } = require('mongoose');

function validEmployee(overrides = {}) {
  return {
    employeeId: 'EMP-001',
    fullName: 'Aarav Sharma',
    email: 'aarav.sharma@example.com',
    phone: '+91 98765 43210',
    department: 'Development',
    role: 'Software Engineer',
    joiningDate: '2024-01-15',
    status: 'Active',
    skills: ['Node.js', 'MongoDB'],
    ...overrides,
  };
}

function validTask(overrides = {}) {
  return {
    taskId: 'TSK-001',
    title: 'Build task API',
    description: 'Implement the task creation endpoint.',
    assignedEmployee: new Types.ObjectId(),
    employeeSnapshot: {
      employeeId: 'EMP-001',
      fullName: 'Aarav Sharma',
      email: 'aarav.sharma@example.com',
      department: 'Development',
    },
    department: 'Development',
    priority: 'High',
    startDate: '2024-02-01',
    dueDate: '2024-02-10',
    ...overrides,
  };
}

module.exports = { validEmployee, validTask };
