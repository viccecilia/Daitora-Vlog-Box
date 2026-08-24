const { request } = require("../../services/api")

Page({
  data: { account: "", name: "", saving: false },
  onLoad() {
    const user = wx.getStorageSync("user") || getApp().globalData.user
    this.setData({ account: user.id || "", name: user.name || "" })
  },
  onNameInput(event) { this.setData({ name: event.detail.value }) },
  async save() {
    const name = this.data.name.trim()
    if (!name) { wx.showToast({ title: "请输入姓名", icon: "none" }); return }
    this.setData({ saving: true })
    try {
      const user = await request("/me/profile", { method: "POST", data: { name } })
      getApp().globalData.user = user
      wx.setStorageSync("user", user)
      wx.showToast({ title: "资料已保存" })
      setTimeout(() => wx.navigateBack(), 700)
    } catch (error) {
      wx.showToast({ title: error && error.data && error.data.detail || "保存失败", icon: "none" })
      this.setData({ saving: false })
    }
  }
})
