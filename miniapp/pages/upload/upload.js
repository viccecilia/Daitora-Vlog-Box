const { request, uploadFile } = require("../../services/api")

Page({
  data: { files: [], pendingCount: 0, completedCount: 0, viewMode: "list", uploading: false, packageId: null, shootDate: "", theme: "日常素材", title: "", themes: ["日常素材","工作日常","机场接送","车辆介绍","客人接待","其他"] },
  onLoad() { this.setData({viewMode:wx.getStorageSync("uploadViewMode")||"list"});const d=wx.getStorageSync("uploadDraft"); if(d){d.files=(d.files||[]).map((file,index)=>{const normalized=this.normalizeFile(file,index,file.source||"已选择");return {...normalized,...file,mediaType:file.mediaType||normalized.mediaType,thumbPath:file.thumbPath||normalized.thumbPath,typeLabel:file.typeLabel||normalized.typeLabel,sizeText:file.sizeText||normalized.sizeText,selectedAt:file.selectedAt||normalized.selectedAt}});this.setData(d);this.persist()} },
  persist() { const completedCount=this.data.files.filter(file=>file.status==="已完成").length;const pendingCount=this.data.files.length-completedCount;if(completedCount!==this.data.completedCount||pendingCount!==this.data.pendingCount)this.setData({completedCount,pendingCount});wx.setStorageSync("uploadDraft", { files:this.data.files, packageId:this.data.packageId, shootDate:this.data.shootDate, theme:this.data.theme, title:this.data.title }) },
  setViewMode(e) { const viewMode=e.currentTarget.dataset.mode;if(viewMode!=="list"&&viewMode!=="grid")return;this.setData({viewMode});wx.setStorageSync("uploadViewMode",viewMode) },
  setDate(e) { this.setData({shootDate:e.detail.value}); this.persist() },
  setTheme(e) { this.setData({theme:this.data.themes[e.detail.value]}); this.persist() },
  setTitle(e) { this.setData({title:e.detail.value}); this.persist() },
  memoInput(e) { this.setData({[`files[${e.currentTarget.dataset.i}].memoText`]:e.detail.value}); this.persist() },
  previewImage(e) { const current=e.currentTarget.dataset.src;const urls=this.data.files.filter(file=>file.mediaType==="image").map(file=>file.path);if(current&&urls.length)wx.previewImage({current,urls}) },
  async removeFile(e) { const index=e.currentTarget.dataset.i; const file=this.data.files[index]; if(this.data.uploading)return; try { if(file.assetId) await request(`/assets/${file.assetId}`,{method:"DELETE"}); const files=this.data.files.slice(); files.splice(index,1); this.setData({files}); this.persist() } catch(err) { wx.showToast({title:(err.data&&err.data.detail)||"删除失败",icon:"none"}) } },

  normalizeFile(file, index, source) {
    const path = file.tempFilePath || file.path
    const originalName = file.name || ""
    const suffix = originalName.match(/\.([^.]+)$/)
    const isVideo = file.fileType === "video" || file.type === "video" || /\.(mp4|mov|m4v|avi|mkv|webm)$/i.test(originalName || path)
    const isImage = file.fileType === "image" || file.type === "image" || /\.(jpg|jpeg|png|gif|webp|heic|heif)$/i.test(originalName || path)
    const extension = suffix ? suffix[1] : (isVideo ? "mp4" : "jpg")
    const mediaType=isVideo?"video":(isImage?"image":"file")
    const size=file.size||0
    return { path, thumbPath:file.thumbTempFilePath||(isImage?path:""), mediaType, typeLabel:mediaType==="video"?"视频":(mediaType==="image"?"图片":"文件"), name:originalName||`素材_${index+1}.${extension}`, size, duration:file.duration||0,width:file.width||0,height:file.height||0,sizeText:this.formatBytes(size), selectedAt:this.formatTime(new Date()), uploadedAt:"", source, progress:0, status:"等待上传", assetId:null, memoText:"" }
  },

  formatBytes(bytes) { if(!bytes)return"未知大小";if(bytes>=1024*1024*1024)return`${(bytes/1024/1024/1024).toFixed(2)} GB`;if(bytes>=1024*1024)return`${(bytes/1024/1024).toFixed(1)} MB`;if(bytes>=1024)return`${(bytes/1024).toFixed(0)} KB`;return`${bytes} B` },
  formatTime(value) { const date=value instanceof Date?value:new Date(value);if(Number.isNaN(date.getTime()))return"";const pad=number=>String(number).padStart(2,"0");return`${pad(date.getMonth()+1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}` },

  appendFiles(tempFiles, source) {
    const start = this.data.files.length
    const files = tempFiles.map((file,index)=>this.normalizeFile(file,start+index,source)).filter(file=>file.path)
    this.setData({ files: this.data.files.concat(files) })
    this.persist()
  },

  replaceFile(e) {
    const index=e.currentTarget.dataset.i
    wx.showActionSheet({itemList:["从手机相册选择","重新拍摄","从微信聊天文件选择"],success:choice=>{
      const done=(file,source)=>this.applyReplacement(index,file,source)
      if(choice.tapIndex===0)wx.chooseMedia({count:1,mediaType:["image","video"],sizeType:["original"],sourceType:["album"],success:r=>done(r.tempFiles[0],"手机相册")})
      if(choice.tapIndex===1)wx.chooseMedia({count:1,mediaType:["image","video"],sizeType:["original"],sourceType:["camera"],success:r=>done(r.tempFiles[0],"现场拍摄")})
      if(choice.tapIndex===2)wx.chooseMessageFile({count:1,type:"all",success:r=>done(r.tempFiles[0],"微信文件")})
    }})
  },

  async applyReplacement(index, selected, source) {
    if(this.data.uploading)return
    const old=this.data.files[index]
    try {
      if(old.assetId)await request(`/assets/${old.assetId}`,{method:"DELETE"})
      this.setData({[`files[${index}]`]:this.normalizeFile(selected,index,source)})
      this.persist()
      wx.showToast({title:"已更换",icon:"success"})
    } catch(error) { wx.showToast({title:(error.data&&error.data.detail)||"更换失败",icon:"none"}) }
  },

  chooseAlbum() {
    wx.chooseMedia({
      count: 9,
      mediaType: ["image", "video"],
      sizeType: ["original"],
      sourceType: ["album"],
      success: result => this.appendFiles(result.tempFiles, "手机相册")
    })
  },

  chooseCamera() {
    wx.chooseMedia({
      count: 9,
      mediaType: ["image", "video"],
      sizeType: ["original"],
      sourceType: ["camera"],
      success: result => this.appendFiles(result.tempFiles, "现场拍摄")
    })
  },

  chooseWechatFiles() {
    wx.chooseMessageFile({
      count: 10,
      type: "all",
      success: result => this.appendFiles(result.tempFiles, "微信文件")
    })
  },

  async uploadAll() {
    if (!this.data.files.length) {
      wx.showToast({ title: "请先选择文件", icon: "none" })
      return
    }
    if (this.data.uploading) return
    if (!this.data.shootDate) { wx.showToast({title:"请选择拍摄日期",icon:"none"}); return }
    this.setData({ uploading: true })
    try {
      let failedCount = 0
      let packageId = this.data.packageId
      if (!packageId) { const title=this.data.title.trim()||`${this.data.shootDate} ${this.data.theme}`;const created=await request("/material-packages", {method:"POST",data:{shootDate:this.data.shootDate,theme:this.data.theme,title}}); packageId=created.id; this.setData({packageId,title}); this.persist() }
      for (let index = 0; index < this.data.files.length; index += 1) {
        if (this.data.files[index].status === "已完成") continue
        this.setData({ [`files[${index}].status`]: "上传中" })
        try { const current=this.data.files[index];let assetId=current.assetId;if(!assetId){const asset=await uploadFile(current.path,packageId,current.memoText,current,progress=>this.setData({[`files[${index}].progress`]:progress.progress}));assetId=asset.id;this.setData({[`files[${index}].assetId`]:assetId,[`files[${index}].uploadedAt`]:this.formatTime(asset.uploadedAt||new Date()),[`files[${index}].status`]:"处理中"});this.persist()}this.setData({[`files[${index}].status`]:"已完成",[`files[${index}].progress`]:100,[`files[${index}].assetId`]:assetId}) }
        catch (error) { failedCount+=1;const message=(error&&error.errMsg)||(error&&error.data&&error.data.detail)||"";const expired=/not found|找不到|no such file/i.test(message);this.setData({ [`files[${index}].status`]: expired?"文件已失效，请更换":"上传失败，请重试" }) }
        this.persist()
      }
      if(failedCount)wx.showModal({title:"部分文件未上传",content:`有 ${failedCount} 个文件上传失败。若文件已失效，请点击“更换”重新选择。`,showCancel:false})
      else wx.showToast({ title: "上传完成" })
    } catch (error) {
      const detail = error && error.data && error.data.detail
      wx.showToast({ title: detail || "上传失败，请重试", icon: "none" })
    } finally { this.setData({ uploading: false }) }
  },
  async submitPackage() {
    if (!this.data.packageId || this.data.files.some(x=>x.status!=="已完成")) { wx.showToast({title:"请先完成全部上传",icon:"none"}); return }
    try { await request(`/material-packages/${this.data.packageId}/submit`,{method:"POST"}); wx.removeStorageSync("uploadDraft"); wx.showToast({title:"已提交"}); setTimeout(()=>wx.navigateBack(),700) } catch(e) { wx.showToast({title:(e.data&&e.data.detail)||"提交失败",icon:"none"}) }
  }
})
