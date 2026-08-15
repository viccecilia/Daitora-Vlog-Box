const { uploadFile } = require("../../services/api")

Page({
  data: { files: [], uploading: false },

  chooseFiles() {
    wx.chooseMedia({
      count: 9,
      mediaType: ["image", "video"],
      sourceType: ["album", "camera"],
      success: result => this.setData({
        files: result.tempFiles.map((file, index) => ({
          path: file.tempFilePath,
          name: `素材_${index + 1}.${file.fileType === "video" ? "mp4" : "jpg"}`,
          size: file.size,
          progress: 0,
          status: "等待上传"
        }))
      })
    })
  },

  async submit() {
    if (!this.data.files.length) {
      wx.showToast({ title: "请先选择文件", icon: "none" })
      return
    }
    if (this.data.uploading) return
    this.setData({ uploading: true })
    try {
      for (let index = 0; index < this.data.files.length; index += 1) {
        this.setData({ [`files[${index}].status`]: "上传中" })
        await uploadFile(this.data.files[index].path, progress => this.setData({ [`files[${index}].progress`]: progress.progress }))
        this.setData({ [`files[${index}].status`]: "已完成", [`files[${index}].progress`]: 100 })
      }
      wx.showToast({ title: "上传完成" })
      setTimeout(() => wx.navigateBack(), 900)
    } catch (error) {
      const detail = error && error.data && error.data.detail
      wx.showToast({ title: detail || "上传失败，请重试", icon: "none" })
      this.setData({ uploading: false })
    }
  }
})
