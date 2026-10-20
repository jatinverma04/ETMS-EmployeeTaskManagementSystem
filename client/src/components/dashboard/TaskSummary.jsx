import SummaryCard from '../common/SummaryCard';

function filterLink(status) {
  return { pathname: '/tasks', search: new URLSearchParams({ status }).toString() };
}

export default function TaskSummary({ counts }) {
  return (
    <section aria-labelledby="task-summary-heading">
      <h2 id="task-summary-heading" className="mb-3 text-base font-semibold text-ink">
        Tasks
      </h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <SummaryCard label="Total tasks" value={counts.total} to="/tasks" />
        <SummaryCard label="Todo" value={counts.todo} to={filterLink('Todo')} />
        <SummaryCard
          label="In progress"
          value={counts.inProgress}
          to={filterLink('In Progress')}
          tone="amber"
        />
        <SummaryCard
          label="Completed"
          value={counts.completed}
          to={filterLink('Completed')}
          tone="olive"
        />
        <SummaryCard
          label="Cancelled"
          value={counts.cancelled}
          to={filterLink('Cancelled')}
          tone="rust"
        />
        <SummaryCard label="Overdue" value={counts.overdue} tone="rust" />
      </div>
    </section>
  );
}
