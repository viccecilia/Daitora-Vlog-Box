Page({
  driverLogin(){ const app=getApp(); app.globalData.role="driver"; wx.setStorageSync("token","demo-driver"); wx.reLaunch({url:"/pages/home/home"}) },
  editorLogin(){ const app=getApp(); app.globalData.role="editor"; wx.setStorageSync("token","demo-editor"); wx.reLaunch({url:"/pages/editor/editor"}) }
})
