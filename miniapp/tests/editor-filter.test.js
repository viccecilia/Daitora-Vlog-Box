const assert = require("node:assert/strict")
const { activeTasks, taskStats } = require("../pages/editor/editor-logic")

const selectedUserPackages = [
  { id: 1, driverCode: "account-a", status: "EDITING" },
  { id: 2, driverCode: "account-a", status: "ARCHIVED" }
]

const visible = activeTasks(selectedUserPackages)
assert.equal(visible.length, 1, "全部列表必须包含该用户的 EDITING 素材包")
assert.equal(visible[0].status, "EDITING")
assert.equal(visible[0].driverCode, "account-a", "筛选值必须使用唯一 account")
assert.deepEqual(taskStats(visible), { pendingEdit: 0, editing: 1, revisionRequested: 0, pendingReview: 0 })
console.log("editor filter regression passed")
