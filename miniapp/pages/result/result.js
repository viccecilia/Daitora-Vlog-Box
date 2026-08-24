const { request } = require("../../services/api")

Page({
  data: { product: null, versions:[], previewPath:"", loading: true, downloading: false },
  onShow() { this.loadProduct() },
  async loadProduct() {
    this.setData({ loading: true })
    try {
      const result = await request("/me/latest-finished-product")
      const product=result.item||null
      let versions=[]
      if(product&&product.packageId){const detail=await request(`/material-packages/${product.packageId}`);versions=detail.products||[]}
      this.setData({ product,versions, loading: false })
      if(product)this.preparePreview(product)
    } catch (_) {
      this.setData({ loading: false })
      wx.showToast({ title: "成品读取失败", icon: "none" })
    }
  },
  revise() { wx.setStorageSync("revisionProduct", this.data.product); wx.navigateTo({ url: "/pages/revision/revision" }) },
  preparePreview(product){wx.downloadFile({url:`${getApp().globalData.apiBase}/finished-products/${product.id}/download`,header:{Authorization:`Bearer ${wx.getStorageSync("token")}`},success:r=>{if(r.statusCode===200)this.setData({previewPath:r.tempFilePath})}})},
  async confirm() { const p=this.data.product;if(!p||!p.packageId)return;try{await request(`/material-packages/${p.packageId}/confirm`,{method:"POST"});wx.showToast({title:"已确认完成"});this.loadProduct()}catch(e){wx.showToast({title:(e.data&&e.data.detail)||"确认失败",icon:"none"})} },
  download() {
    const product = this.data.product
    if (!product || this.data.downloading) return
    this.setData({ downloading: true })
    wx.downloadFile({
      url: `${getApp().globalData.apiBase}/finished-products/${product.id}/download`,
      header: { Authorization: `Bearer ${wx.getStorageSync("token")}` },
      success: response => {
        if (response.statusCode !== 200) {
          wx.showToast({ title: "下载失败，请重试", icon: "none" })
          return
        }
        wx.saveVideoToPhotosAlbum({
          filePath: response.tempFilePath,
          success: () => wx.showToast({ title: "已保存到相册" }),
          fail: () => wx.showModal({title:"无法直接保存",content:"可尝试打开系统文件菜单，或复制下载地址后在浏览器打开。",confirmText:"打开文件",cancelText:"复制链接",success:choice=>{if(choice.confirm)wx.openDocument({filePath:response.tempFilePath,showMenu:true,fail:()=>wx.showToast({title:"当前格式无法打开",icon:"none"})});else wx.setClipboardData({data:`${getApp().globalData.apiBase}/finished-products/${product.id}/download`})}})
        })
      },
      fail: () => wx.showToast({ title: "下载失败，请检查网络", icon: "none" }),
      complete: () => this.setData({ downloading: false })
    })
  }
})
