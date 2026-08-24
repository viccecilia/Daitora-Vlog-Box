const activeStatuses = ["PENDING_EDIT", "EDITING", "REVISION_REQUESTED", "REVISING", "PENDING_REVIEW"]

function activeTasks(items) {
  return (items || []).filter(item => activeStatuses.includes(item.status))
}

function taskStats(items) {
  const tasks = activeTasks(items)
  return {
    pendingEdit: tasks.filter(item => item.status === "PENDING_EDIT").length,
    editing: tasks.filter(item => item.status === "EDITING").length,
    revisionRequested: tasks.filter(item => item.status === "REVISION_REQUESTED" || item.status === "REVISING").length,
    pendingReview: tasks.filter(item => item.status === "PENDING_REVIEW").length
  }
}

module.exports = { activeStatuses, activeTasks, taskStats }
