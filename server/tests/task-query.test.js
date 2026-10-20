const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  parseTaskListQuery,
  buildTaskFilter,
  buildTaskSort,
  buildTaskPriorityRankExpression,
} = require('../src/utils/taskQuery');

describe('task list query parsing', () => {
  it('applies defaults for an empty query', () => {
    assert.deepEqual(parseTaskListQuery({}), {
      page: 1,
      limit: 10,
      search: null,
      department: null,
      priority: null,
      status: null,
      dueFrom: null,
      dueTo: null,
      sort: 'createdAt',
      order: 'desc',
    });
  });

  it('parses pagination, search, filters, due dates, and sorting', () => {
    assert.deepEqual(
      parseTaskListQuery({
        page: '2',
        limit: '25',
        search: '  Build API  ',
        department: 'Design',
        priority: 'Critical',
        status: 'In Progress',
        dueFrom: '2024-06-01',
        dueTo: '2024-06-30',
        sort: 'dueDate',
        order: 'asc',
      }),
      {
        page: 2,
        limit: 25,
        search: 'Build API',
        department: 'Design',
        priority: 'Critical',
        status: 'In Progress',
        dueFrom: new Date('2024-06-01T00:00:00.000Z'),
        dueTo: new Date('2024-06-30T00:00:00.000Z'),
        sort: 'dueDate',
        order: 'asc',
      },
    );
  });

  it('uses field-appropriate default sort directions', () => {
    assert.equal(parseTaskListQuery({}).order, 'desc');
    assert.equal(parseTaskListQuery({ sort: 'createdAt' }).order, 'desc');
    assert.equal(parseTaskListQuery({ sort: 'priority' }).order, 'desc');
    assert.equal(parseTaskListQuery({ sort: 'dueDate' }).order, 'asc');
    assert.equal(parseTaskListQuery({ sort: 'title' }).order, 'asc');
  });

  it('rejects invalid pagination values', () => {
    for (const query of [
      { page: '0' },
      { page: '-1' },
      { page: '1.5' },
      { page: 'abc' },
      { page: '' },
      { limit: '0' },
      { limit: '101' },
      { limit: '2.5' },
      { limit: 'abc' },
    ]) {
      assert.throws(() => parseTaskListQuery(query), { statusCode: 400 });
    }
  });

  it('rejects invalid filters, sort fields, directions, and date ranges', () => {
    for (const query of [
      { department: 'Marketing' },
      { priority: 'Urgent' },
      { status: 'Blocked' },
      { sort: 'description' },
      { order: 'up' },
      { order: 'ASC' },
      { dueFrom: '2024-02-30' },
      { dueTo: 'not-a-date' },
      { dueFrom: '2024-06-10', dueTo: '2024-06-09' },
    ]) {
      assert.throws(() => parseTaskListQuery(query), { statusCode: 400 });
    }
  });

  it('rejects duplicate, object-shaped, and unknown query parameters', () => {
    for (const query of [
      { page: ['1', '2'] },
      { search: { $regex: '.*' } },
      { department: { $ne: 'Development' } },
      { dueFrom: { $gte: '2024-06-01' } },
      { export: 'csv' },
    ]) {
      assert.throws(() => parseTaskListQuery(query), { statusCode: 400 });
    }
  });

  it('rejects an overlong search term', () => {
    assert.throws(() => parseTaskListQuery({ search: 'a'.repeat(101) }), {
      statusCode: 400,
    });
  });

  it('builds a combined filter and escapes search input', () => {
    const dueFrom = new Date('2024-06-01T00:00:00.000Z');
    const dueTo = new Date('2024-06-30T00:00:00.000Z');
    const filter = buildTaskFilter({
      search: 'Build.*API',
      department: 'Development',
      priority: 'High',
      status: 'Todo',
      dueFrom,
      dueTo,
    });

    assert.equal(filter.department, 'Development');
    assert.equal(filter.priority, 'High');
    assert.equal(filter.status, 'Todo');
    assert.deepEqual(filter.dueDate, { $gte: dueFrom, $lte: dueTo });
    assert.equal(filter.$or.length, 2);
    assert.equal(filter.$or[0].title.source, 'Build\\.\\*API');
    assert.equal(filter.$or[0].title.flags, 'i');
    assert.equal(
      filter.$or[1]['employeeSnapshot.fullName'].source,
      'Build\\.\\*API',
    );
  });

  it('builds a stable non-priority sort specification', () => {
    assert.deepEqual(buildTaskSort({ sort: 'title', order: 'asc' }), {
      title: 1,
      _id: 1,
    });
    assert.deepEqual(buildTaskSort({ sort: 'dueDate', order: 'desc' }), {
      dueDate: -1,
      _id: 1,
    });
  });

  it('builds priority ordering from importance rank rather than strings', () => {
    const expression = buildTaskPriorityRankExpression();
    const branches = expression.$switch.branches;

    assert.equal(branches.length, 4);
    assert.equal(
      branches.find((branch) => branch.case.$eq[1] === 'Low').then,
      1,
    );
    assert.equal(
      branches.find((branch) => branch.case.$eq[1] === 'Critical').then,
      4,
    );
    assert.equal(expression.$switch.default, 0);
  });
});
