const packages = [
  { id:"DRIVER-D023", driver:"王小明", code:"D023", avatar:"王", title:"王小明的素材包", time:"08-15 10:42", count:12, videos:10, photos:2, size:"2.31 GB", status:"新上传", tone:"coral", previews:["00:14","00:21","JPG","00:18"], files:[{name:"关西机场出发_01.MOV",time:"08-15 10:42",type:"视频 · MOV",size:"286 MB"},{name:"车辆清洁_02.MOV",time:"08-15 10:39",type:"视频 · MOV",size:"418 MB"},{name:"司机接客画面_03.JPG",time:"08-15 10:31",type:"图片 · JPG",size:"8.4 MB"}] },
  { id:"DRIVER-D024", driver:"陈师傅", code:"D024", avatar:"陈", title:"陈师傅的素材包", time:"08-15 09:18", count:8, videos:7, photos:1, size:"1.84 GB", status:"待剪辑", tone:"blue", previews:["00:11","00:16","00:09","JPG"], files:[{name:"机场到达大厅_01.MOV",time:"08-15 09:18",type:"视频 · MOV",size:"312 MB"},{name:"乘客上车_02.MOV",time:"08-15 09:12",type:"视频 · MOV",size:"264 MB"},{name:"大阪市区沿途_03.JPG",time:"08-15 09:05",type:"图片 · JPG",size:"7.2 MB"}] },
  { id:"DRIVER-D025", driver:"李师傅", code:"D025", avatar:"李", title:"李师傅的素材包", time:"08-14 18:26", count:6, videos:6, photos:0, size:"968 MB", status:"剪辑中", tone:"amber", previews:["00:09","00:23","00:12","00:17"], files:[{name:"机场等待区_03.MP4",time:"08-14 18:26",type:"视频 · MP4",size:"172 MB"},{name:"夜间道路_04.MOV",time:"08-14 18:19",type:"视频 · MOV",size:"201 MB"},{name:"酒店到达_05.MOV",time:"08-14 18:04",type:"视频 · MOV",size:"184 MB"}] },
  { id:"DRIVER-D026", driver:"赵师傅", code:"D026", avatar:"赵", title:"赵师傅的素材包", time:"08-14 16:33", count:10, videos:8, photos:2, size:"2.06 GB", status:"已查看", tone:"green", previews:["JPG","00:15","00:20","JPG"], files:[{name:"车辆外观_01.JPG",time:"08-14 16:33",type:"图片 · JPG",size:"6.7 MB"},{name:"车内空间_02.MOV",time:"08-14 16:28",type:"视频 · MOV",size:"392 MB"},{name:"行李装载_03.MOV",time:"08-14 16:20",type:"视频 · MOV",size:"318 MB"}] }
]

function sortedPackages(list, mode) {
  return list.map(item => ({
    ...item,
    displayFiles: item.files.map(file => ({ ...file, icon: file.type.indexOf("图片") === 0 ? "图" : "视" })).sort((a, b) => {
      if (mode === "type") {
        const typeOrder = value => value.type.indexOf("视频") === 0 ? 0 : 1
        return typeOrder(a) - typeOrder(b) || b.time.localeCompare(a.time)
      }
      return b.time.localeCompare(a.time)
    })
  }))
}

Page({
  data: {
    packages,
    visible: sortedPackages(packages, "time"),
    drivers: [{name:"全部",code:"all"},{name:"王小明",code:"D023"},{name:"陈师傅",code:"D024"},{name:"李师傅",code:"D025"},{name:"赵师傅",code:"D026"}],
    activeDriver: "all",
    query: "",
    sortMode: "time",
    expanded: ""
  },
  search(event) { this.setData({ query: event.detail.value.trim().toLowerCase() }, () => this.applyFilters()) },
  selectDriver(event) { this.setData({ activeDriver: event.currentTarget.dataset.code }, () => this.applyFilters()) },
  selectSort(event) { this.setData({ sortMode: event.currentTarget.dataset.mode }, () => this.applyFilters()) },
  applyFilters() {
    const { query, activeDriver, sortMode } = this.data
    const filtered = packages.filter(item => (activeDriver === "all" || item.code === activeDriver) && (!query || `${item.driver}${item.code}${item.title}${item.id}`.toLowerCase().includes(query)))
    this.setData({ visible: sortedPackages(filtered, sortMode) })
  },
  togglePackage(event) {
    const id = event.currentTarget.dataset.id
    this.setData({ expanded: this.data.expanded === id ? "" : id })
  },
  downloadPackage(event) {
    const item = packages.find(pkg => pkg.id === event.currentTarget.dataset.id)
    wx.showToast({ title: `准备下载${item.driver}的全部素材`, icon: "none" })
  }
})
