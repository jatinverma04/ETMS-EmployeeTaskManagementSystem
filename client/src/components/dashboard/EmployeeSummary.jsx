import SummaryCard from '../common/SummaryCard';

function filterLink(status) {
  return { pathname: '/employees', search: new URLSearchParams({ status }).toString() };
}

export default function EmployeeSummary({ counts }) {
  return (
    <section aria-labelledby="employee-summary-heading">
      <h2 id="employee-summary-heading" className="mb-3 text-base font-semibold text-ink">
        Employees
      </h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard label="Total employees" value={counts.total} to="/employees" />
        <SummaryCard
          label="Active"
          value={counts.active}
          to={filterLink('Active')}
          tone="olive"
        />
        <SummaryCard
          label="Inactive"
          value={counts.inactive}
          to={filterLink('Inactive')}
        />
        <SummaryCard
          label="On leave"
          value={counts.onLeave}
          to={filterLink('On Leave')}
          tone="amber"
        />
      </div>
    </section>
  );
}
