Page({
  data:{files:[]},
  chooseFiles(){wx.chooseMedia({count:9,mediaType:["image","video"],sourceType:["album","camera"],success:r=>this.setData({files:r.tempFiles.map((f,i)=>({path:f.tempFilePath,name:`素材_${i+1}.${f.fileType==="video"?"mp4":"jpg"}`,progress:100}))})})},
  submit(){if(!this.data.files.length)return wx.showToast({title:"请先选择文件",icon:"none"});wx.showToast({title:"上传完成"});setTimeout(()=>wx.navigateBack(),800)}
})
