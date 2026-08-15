const { request } = require("../../services/api")

Page({
  data: { account: "", password: "", showPassword: false, loading: false },

  onAccountInput(event) { this.setData({ account: event.detail.value.trim() }) },
  onPasswordInput(event) { this.setData({ password: event.detail.value }) },
  togglePassword() { this.setData({ showPassword: !this.data.showPassword }) },

  async login() {
    const account = this.data.account
    const password = this.data.password
    if (!account || !password) {
      wx.showToast({ title: "请输入账号和密码", icon: "none" })
      return
    }

    this.setData({ loading: true })
    try {
      const result = await request("/auth/login", { method: "POST", data: { account, password } })
      const app = getApp()
      app.globalData.role = result.user.role
      app.globalData.user = result.user
      wx.setStorageSync("token", result.token)
      wx.setStorageSync("role", result.user.role)
      wx.setStorageSync("user", result.user)
      wx.reLaunch({ url: result.user.role === "driver" ? "/pages/home/home" : "/pages/editor/editor" })
    } catch (error) {
      const message = error && error.data && error.data.detail ? error.data.detail : "登录失败，请检查网络后重试"
      wx.showToast({ title: message, icon: "none" })
      this.setData({ loading: false })
    }
  }
})
