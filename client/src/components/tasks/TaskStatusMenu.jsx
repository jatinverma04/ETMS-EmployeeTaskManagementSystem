import { TASK_STATUS_TRANSITIONS } from '../../utils/constants';
import ActionMenu from '../common/ActionMenu';

export default function TaskStatusMenu({ task, onTransition, updating = false }) {
  const nextStatuses = TASK_STATUS_TRANSITIONS[task.status] || [];

  if (nextStatuses.length === 0) {
    return <span className="text-xs font-medium text-ink-muted">Final status</span>;
  }

  const items = nextStatuses.map((status) => ({
    label: `Move to ${status}`,
    tone: status === 'Cancelled' ? 'danger' : undefined,
    onClick: () => onTransition(status),
  }));

  return (
    <ActionMenu
      label="Status"
      ariaLabel={`Change status for ${task.taskId}`}
      items={items}
      variant="secondary"
      disabled={updating}
    />
  );
}
