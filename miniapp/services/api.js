const app = getApp()

function request(path, options = {}) {
  const token = wx.getStorageSync("token")
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${app.globalData.apiBase}${path}`,
      method: options.method || "GET",
      data: options.data,
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success: res => res.statusCode < 400 ? resolve(res.data) : reject(res),
      fail: reject
    })
  })
}

function uploadFile(filePath, packageId, memoText, metadata, onProgress) {
  return new Promise((resolve, reject) => {
    const task = wx.uploadFile({
      url: `${app.globalData.apiBase}/assets/upload`,
      filePath,
      name: "file",
      formData: { ...(packageId ? { package_id: String(packageId) } : {}), ...(memoText ? { memo_text: memoText } : {}), ...(metadata&&metadata.duration?{duration:String(metadata.duration)}:{}), ...(metadata&&metadata.width?{width:String(metadata.width)}:{}), ...(metadata&&metadata.height?{height:String(metadata.height)}:{}) },
      header: { Authorization: `Bearer ${wx.getStorageSync("token")}` },
      success: response => {
        let data = response.data
        try { data = JSON.parse(data) } catch (_) {}
        if (response.statusCode < 400) resolve(data)
        else reject({ ...response, data })
      },
      fail: reject
    })
    if (onProgress) task.onProgressUpdate(onProgress)
  })
}

module.exports = { request, uploadFile }
