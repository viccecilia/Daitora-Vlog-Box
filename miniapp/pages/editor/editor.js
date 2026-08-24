const { request } = require("../../services/api")
const { activeTasks, taskStats } = require("./editor-logic")
const labels={PENDING_EDIT:"待剪辑",EDITING:"剪辑中",REVISION_REQUESTED:"待修改",REVISING:"修改中",PENDING_REVIEW:"待确认",COMPLETED:"已完成"}
const cleanTitle=value=>String(value||"").replace(/\u53f8\u673a\u65e5\u5e38/g,"日常素材").replace(/\u53f8\u673a\s*/g,"").replace(/\s*｜\s*/g,"｜").trim()
const shortTime=value=>{const m=String(value||"").match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);return m?`${m[2]}-${m[3]} ${m[4]}:${m[5]}`:""}
const displayTitle=value=>{const parts=cleanTitle(value).split("｜").filter(Boolean);return parts[parts.length-1]||"素材包"}
Page({
  data:{packages:[],visible:[],selected:null,status:"",query:"",viewMode:"list",libraryMode:"folders",users:[],selectedUser:"",libraryFiles:[],fileFilters:{query:"",sort:"newest"},stats:{},statuses:[{v:"",n:"全部"},{v:"PENDING_EDIT",n:"待剪辑"},{v:"EDITING",n:"剪辑中"},{v:"REVISION_REQUESTED",n:"待修改"},{v:"PENDING_REVIEW",n:"待确认"}]},
  onShow(){this.load()},
  async load(){try{const [p,n,u]=await Promise.all([request("/material-packages?page_size=100&sort=newest"),request("/notifications"),request("/drivers")]);const profiles=new Map((u.items||[]).map(x=>[x.account,x.display_name]));const items=activeTasks(p.items).map(x=>({...x,driver:profiles.get(x.driverCode)||x.driver,displayTitle:displayTitle(x.title),dateLabel:x.dateSource==="shoot_date"?"拍摄日期":"上传日期",dateText:x.effectiveDate||x.shootDate,timeText:shortTime(x.submittedAt||x.createdAt),statusLabel:labels[x.status]||x.status,sizeText:(x.sizeBytes/1048576).toFixed(1)+" MB",avatar:x.driverCode.slice(0,1).toUpperCase()}));const activeAccounts=new Set(items.map(x=>x.driverCode));const users=(u.items||[]).filter(x=>activeAccounts.has(x.account));const selectedUser=users.some(x=>x.account===this.data.selectedUser)?this.data.selectedUser:"";const visible=selectedUser?items.filter(x=>x.driverCode===selectedUser):items;this.setData({packages:visible,visible,users,selectedUser,stats:taskStats(visible),unread:n.unreadCount||0})}catch(e){wx.showToast({title:"读取任务失败",icon:"none"})}},
  setLibraryMode(e){const libraryMode=e.currentTarget.dataset.mode;this.setData({libraryMode});if(libraryMode==="files")this.loadLibraryFiles()},
  selectUser(e){this.setData({selectedUser:e.currentTarget.dataset.account||""},()=>{if(this.data.libraryMode==="files")this.loadLibraryFiles();else this.loadPackages()})},
  fileFilter(e){this.setData({[`fileFilters.${e.currentTarget.dataset.field}`]:e.detail.value});this.loadLibraryFiles()},
  async loadLibraryFiles(){const f=this.data.fileFilters;const params=Object.keys(f).filter(k=>f[k]).map(k=>`${k}=${encodeURIComponent(f[k])}`);if(this.data.selectedUser)params.push(`driver_id=${encodeURIComponent(this.data.selectedUser)}`);params.push("page_size=100");try{const result=await request(`/assets?${params.join("&")}`);this.setData({libraryFiles:(result.items||[]).map(x=>({...x,dateLabel:x.date_source==="shoot_date"?"拍摄日期":"上传日期",typeLabel:x.media_type==="video"?"视频":x.media_type==="image"?"图片":"文件",uploadText:shortTime(x.uploaded_at)}))})}catch(_){wx.showToast({title:"素材读取失败",icon:"none"})}},
  search(e){this.setData({query:e.detail.value.trim().toLowerCase()},()=>this.loadPackages())},
  status(e){this.setData({status:e.currentTarget.dataset.status},()=>this.loadPackages())},
  async loadPackages(){const params=["page_size=100","sort=newest"];if(this.data.selectedUser)params.push(`driver_id=${encodeURIComponent(this.data.selectedUser)}`);if(this.data.status)params.push(`status=${encodeURIComponent(this.data.status)}`);if(this.data.query)params.push(`query=${encodeURIComponent(this.data.query)}`);try{const p=await request(`/material-packages?${params.join("&")}`);const items=activeTasks(p.items).map(x=>({...x,displayTitle:displayTitle(x.title),dateLabel:x.dateSource==="shoot_date"?"拍摄日期":"上传日期",dateText:x.effectiveDate||x.shootDate,timeText:shortTime(x.submittedAt||x.createdAt),statusLabel:labels[x.status]||x.status,sizeText:(x.sizeBytes/1048576).toFixed(1)+" MB",avatar:x.driverCode.slice(0,1).toUpperCase()}));this.setData({packages:items,visible:items,stats:taskStats(items)})}catch(_){wx.showToast({title:"素材包读取失败",icon:"none"})}},
  filter(){const {packages,status,query,selectedUser}=this.data;this.setData({visible:packages.filter(x=>(!selectedUser||x.driverCode===selectedUser)&&(!status||x.status===status)&&(!query||`${x.driver}${x.driverCode}${x.title}`.toLowerCase().includes(query)))})},
  setViewMode(e){const viewMode=e.currentTarget.dataset.mode;if(viewMode==="list"||viewMode==="grid")this.setData({viewMode})},
  async action(e){const {id,action}=e.currentTarget.dataset;try{const result=await request(`/material-packages/${id}/${action}`,{method:"POST"});const update=item=>item.id===Number(id)?{...item,status:result.status,statusLabel:labels[result.status]||result.status}:item;this.setData({packages:this.data.packages.map(update),visible:this.data.visible.map(update)});wx.showToast({title:result.status==="EDITING"?"已开始剪辑":"已开始修改"});await this.loadPackages()}catch(err){wx.showToast({title:(err.data&&err.data.detail)||"操作失败",icon:"none"})}},
  async detail(e){try{const item=await request(`/material-packages/${e.currentTarget.dataset.id}`);this.setData({selected:{...item,displayTitle:displayTitle(item.title)}})}catch(_){wx.showToast({title:"详情读取失败",icon:"none"})}},
  closeDetail(){this.setData({selected:null})},
  noop(){},
  downloadAssetFile(asset){
    return new Promise((resolve,reject)=>wx.downloadFile({
      url:`${getApp().globalData.apiBase}/assets/${asset.id}/download`,
      header:{Authorization:`Bearer ${wx.getStorageSync("token")}`},
      success:r=>r.statusCode===200?resolve(r.tempFilePath):reject(new Error(`HTTP ${r.statusCode}`)),
      fail:reject
    }))
  },
  saveDownloadedFile(filePath,mediaType){
    return new Promise((resolve,reject)=>{
      if(mediaType==="image") return wx.saveImageToPhotosAlbum({filePath,success:resolve,fail:reject})
      if(mediaType==="video") return wx.saveVideoToPhotosAlbum({filePath,success:resolve,fail:reject})
      wx.openDocument({filePath,showMenu:true,success:resolve,fail:reject})
    })
  },
  async downloadAsset(e){
    const asset=(this.data.selected&&this.data.selected.assets||[]).find(x=>x.id===Number(e.currentTarget.dataset.id))
    if(!asset)return
    wx.showLoading({title:"正在下载",mask:true})
    try{const path=await this.downloadAssetFile(asset);await this.saveDownloadedFile(path,asset.media_type);wx.showToast({title:asset.media_type==="file"?"文件已打开":"已保存到相册"})}
    catch(_){wx.showToast({title:"下载失败，请检查权限",icon:"none"})}
    finally{wx.hideLoading()}
  },
  async downloadLibraryAsset(e){const asset=this.data.libraryFiles.find(x=>x.id===Number(e.currentTarget.dataset.id));if(!asset)return;wx.showLoading({title:"正在下载",mask:true});try{const path=await this.downloadAssetFile(asset);await this.saveDownloadedFile(path,asset.media_type);wx.showToast({title:asset.media_type==="file"?"文件已打开":"已保存到相册"})}catch(_){wx.showToast({title:"无法直接保存，请检查权限",icon:"none"})}finally{wx.hideLoading()}},
  async downloadAll(){
    const assets=(this.data.selected&&this.data.selected.assets)||[]
    if(!assets.length){wx.showToast({title:"素材包为空",icon:"none"});return}
    let completed=0
    try{
      for(const asset of assets){wx.showLoading({title:`下载 ${completed+1}/${assets.length}`,mask:true});const path=await this.downloadAssetFile(asset);await this.saveDownloadedFile(path,asset.media_type);completed+=1}
      wx.showToast({title:`已保存 ${completed} 个素材`})
    }catch(_){wx.showToast({title:`已保存 ${completed} 个，其余下载失败`,icon:"none"})}
    finally{wx.hideLoading()}
  },
  uploadProduct(e){const item=this.data.packages.find(x=>x.id===Number(e.currentTarget.dataset.id));if(!item)return;wx.showModal({title:"回传成品",content:`回传给：${item.driverCode}（不可修改）\n素材包：${item.displayTitle}`,confirmText:"选择视频",success:choice=>{if(!choice.confirm)return;wx.chooseMedia({count:1,mediaType:["video"],sizeType:["original"],success:r=>{wx.showLoading({title:"正在上传",mask:true});wx.uploadFile({url:`${getApp().globalData.apiBase}/finished-products/upload`,filePath:r.tempFiles[0].tempFilePath,name:"file",header:{Authorization:`Bearer ${wx.getStorageSync("token")}`},formData:{package_id:String(item.id),title:item.title},success:response=>{let data={};try{data=JSON.parse(response.data)}catch(_){}if(response.statusCode<400){wx.showModal({title:"回传成功",content:`已回传给：${data.ownerAccount}\n版本：V${data.versionNumber}`,showCancel:false});this.load()}else wx.showToast({title:data.detail||"上传失败，请重试",icon:"none"})},fail:()=>wx.showToast({title:"上传失败，请检查网络",icon:"none"}),complete:()=>wx.hideLoading()})}})}})}
})
