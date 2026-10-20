const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  parseEmployeeListQuery,
  buildEmployeeFilter,
  buildEmployeeSort,
} = require('../src/utils/employeeQuery');

describe('employee list query parsing', () => {
  it('applies defaults for an empty query', () => {
    assert.deepEqual(parseEmployeeListQuery({}), {
      page: 1,
      limit: 10,
      search: null,
      department: null,
      status: null,
      sort: 'fullName',
      order: 'asc',
    });
  });

  it('parses pagination, search, filters, sorting, and order', () => {
    assert.deepEqual(
      parseEmployeeListQuery({
        page: '2',
        limit: '25',
        search: '  Aarav  ',
        department: 'Design',
        status: 'Inactive',
        sort: 'joiningDate',
        order: 'desc',
      }),
      {
        page: 2,
        limit: 25,
        search: 'Aarav',
        department: 'Design',
        status: 'Inactive',
        sort: 'joiningDate',
        order: 'desc',
      },
    );
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
      assert.throws(() => parseEmployeeListQuery(query), { statusCode: 400 });
    }
  });

  it('rejects invalid filters, sort fields, and sort directions', () => {
    for (const query of [
      { department: 'Marketing' },
      { status: 'Unknown' },
      { sort: 'password' },
      { order: 'up' },
      { order: 'ASC' },
    ]) {
      assert.throws(() => parseEmployeeListQuery(query), { statusCode: 400 });
    }
  });

  it('rejects duplicate, object-shaped, and unknown query parameters', () => {
    for (const query of [
      { page: ['1', '2'] },
      { search: { $regex: '.*' } },
      { department: { $ne: 'Development' } },
      { role: 'Developer' },
    ]) {
      assert.throws(() => parseEmployeeListQuery(query), { statusCode: 400 });
    }
  });

  it('rejects an overlong search term', () => {
    assert.throws(() => parseEmployeeListQuery({ search: 'a'.repeat(101) }), {
      statusCode: 400,
    });
  });

  it('builds a safe filter and escapes search input', () => {
    const filter = buildEmployeeFilter({
      search: 'a.*b',
      department: 'Development',
      status: 'Active',
    });

    assert.equal(filter.department, 'Development');
    assert.equal(filter.status, 'Active');
    assert.equal(filter.$or.length, 3);
    assert.equal(filter.$or[0].fullName.source, 'a\\.\\*b');
    assert.equal(filter.$or[0].fullName.flags, 'i');
  });

  it('builds a stable sort specification', () => {
    assert.deepEqual(buildEmployeeSort({ sort: 'fullName', order: 'desc' }), {
      fullName: -1,
      _id: 1,
    });
    assert.deepEqual(buildEmployeeSort({ sort: 'employeeId', order: 'asc' }), {
      employeeId: 1,
      _id: 1,
    });
  });
});
