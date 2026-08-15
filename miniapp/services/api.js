const app = getApp()

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${app.globalData.apiBase}${path}`,
      method: options.method || "GET",
      data: options.data,
      header: { Authorization: `Bearer ${wx.getStorageSync("token") || "demo-token"}` },
      success: res => res.statusCode < 400 ? resolve(res.data) : reject(res),
      fail: reject
    })
  })
}

function uploadFile(filePath, onProgress) {
  const task = wx.uploadFile({
    url: `${app.globalData.apiBase}/assets/upload`,
    filePath,
    name: "file",
    header: { Authorization: `Bearer ${wx.getStorageSync("token") || "demo-token"}` }
  })
  task.onProgressUpdate(onProgress)
  return task
}

module.exports = { request, uploadFile }
