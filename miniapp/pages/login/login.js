const demoAccounts = {
  D023: { password: "123456", role: "driver", name: "王小明" },
  D024: { password: "123456", role: "driver", name: "陈师傅" },
  D025: { password: "123456", role: "driver", name: "李师傅" },
  editor: { password: "Daitora1028", role: "editor", name: "剪辑工作台" },
  admin: { password: "Daitora1028", role: "editor", name: "管理员" }
}

Page({
  data: { account: "", password: "", showPassword: false, loading: false },

  onAccountInput(event) { this.setData({ account: event.detail.value.trim() }) },
  onPasswordInput(event) { this.setData({ password: event.detail.value }) },
  togglePassword() { this.setData({ showPassword: !this.data.showPassword }) },

  login() {
    const account = this.data.account
    const password = this.data.password
    if (!account || !password) {
      wx.showToast({ title: "请输入账号和密码", icon: "none" })
      return
    }

    const matchedKey = Object.keys(demoAccounts).find(key => key.toLowerCase() === account.toLowerCase())
    const user = matchedKey ? demoAccounts[matchedKey] : null
    if (!user || user.password !== password) {
      wx.showToast({ title: "账号或密码不正确", icon: "none" })
      return
    }

    this.setData({ loading: true })
    const app = getApp()
    app.globalData.role = user.role
    app.globalData.user = { id: matchedKey, name: user.name }
    wx.setStorageSync("token", `demo-${user.role}-${matchedKey}`)
    wx.setStorageSync("role", user.role)
    wx.setStorageSync("user", app.globalData.user)
    wx.reLaunch({ url: user.role === "driver" ? "/pages/home/home" : "/pages/editor/editor" })
  }
})
