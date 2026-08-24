const { request } = require("../../services/api")
Page({
 data:{product:null,items:[{timecode:"",message:""}]},
 onLoad(){this.setData({product:wx.getStorageSync("revisionProduct")})},
 change(e){this.setData({[`items[${e.currentTarget.dataset.i}].${e.currentTarget.dataset.k}`]:e.detail.value})},
 add(){this.setData({items:this.data.items.concat({timecode:"",message:""})})},
 remove(e){if(this.data.items.length===1)return;this.data.items.splice(e.currentTarget.dataset.i,1);this.setData({items:this.data.items})},
 async submit(){const items=this.data.items.filter(x=>x.message.trim());if(!items.length){wx.showToast({title:"请填写修改内容",icon:"none"});return}try{await request(`/finished-products/${this.data.product.id}/revision-items`,{method:"POST",data:{items}});wx.showToast({title:"已提交"});setTimeout(()=>wx.navigateBack(),700)}catch(e){wx.showToast({title:(e.data&&e.data.detail)||"提交失败",icon:"none"})}}
})
