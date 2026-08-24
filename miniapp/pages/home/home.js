const { request } = require("../../services/api")

Page({
  data: { user: { id: "", name: "" } },
  async onShow() {
    const user = wx.getStorageSync("user") || getApp().globalData.user
    this.setData({ user })
    if (!wx.getStorageSync("token")) return
    try {
      const profile = await request("/me")
      getApp().globalData.role = profile.role
      getApp().globalData.user = profile
      wx.setStorageSync("role", profile.role)
      wx.setStorageSync("user", profile)
      this.setData({ user: profile })
    } catch (_) {
      this.logout()
    }
  },
  goUpload() { wx.navigateTo({ url: "/pages/upload/upload" }) },
  goResult() { wx.navigateTo({ url: "/pages/result/result" }) },
  logout() {
    for (const key of ["token", "role", "user", "uploadDraft", "uploadViewMode", "revisionProduct"]) wx.removeStorageSync(key)
    getApp().globalData.role = ""
    getApp().globalData.user = { id: "", name: "" }
    wx.reLaunch({ url: "/pages/login/login" })
  }
})
