<template>
  <view class="page">
    <view class="inner">
      <!-- 顶部标题区 -->
      <view class="page-header">
        <view class="page-header-left">
          <view class="page-icon">
            <text class="page-icon-text">客</text>
          </view>
          <view class="page-header-text">
            <text class="page-title">
              {{ isEdit ? '编辑客户' : '新增客户' }}
            </text>
            <text class="page-sub">
              维护客户名称、地址、默认单价与计价方式
            </text>
          </view>
        </view>

        <view class="page-header-right">
          <button class="btn-soft" @click="goBack">返回</button>
        </view>
      </view>

      <!-- 表单卡片 -->
      <view class="card">
        <!-- 客户名称（必填） -->
        <view class="form-item">
          <text class="label">客户名称</text>
          <view class="input-wrapper">
            <input
              class="input"
              v-model="form.name"
              placeholder="请输入客户全名（对账单显示用）"
              maxlength="50"
            />
          </view>
        </view>

        <!-- 简称 -->
        <view class="form-item">
          <text class="label">简称（选填）</text>
          <view class="input-wrapper">
            <input
              class="input"
              v-model="form.short_name"
              placeholder="例如：新拓 A 栋，可选"
              maxlength="30"
            />
          </view>
        </view>

        <!-- 联系人 -->
        <view class="form-item">
          <text class="label">联系人（选填）</text>
          <view class="input-wrapper">
            <input
              class="input"
              v-model="form.contact"
              placeholder="联系人姓名，可选"
              maxlength="20"
            />
          </view>
        </view>

        <!-- 电话（改动点：用 @input + 过滤逻辑） -->
        <view class="form-item">
          <text class="label">联系电话（选填）</text>
          <view class="input-wrapper">
            <input
              class="input"
              :value="form.phone"
              placeholder="手机或座机，可选"
              maxlength="20"
              type="text"
              @input="onPhoneInput"
            />
          </view>
        </view>

        <!-- 地址 -->
        <view class="form-item">
          <text class="label">地址（选填）</text>
          <view class="textarea-wrapper">
            <textarea
              class="textarea"
              v-model="form.address"
              placeholder="详细送气地址，可选"
              auto-height
            />
          </view>
        </view>

        <!-- 默认单价 + 计价单位 -->
        <view class="form-row">
          <view class="form-item half">
            <text class="label">默认单价</text>
            <view class="input-wrapper">
              <input
                class="input"
                v-model="form.default_unit_price"
                placeholder="例如：6.8"
                type="digit"
              />
            </view>
          </view>

          <view class="form-item half">
            <text class="label">计价方式</text>
            <picker
              mode="selector"
              :range="priceUnitOptions"
              :value="priceUnitIndex"
              @change="onPriceUnitChange"
            >
              <view class="input-wrapper picker-wrapper">
                <view class="picker">
                  <text>{{ priceUnitLabel }}</text>
                </view>
              </view>
            </picker>
          </view>
        </view>

        <!-- 启用状态 -->
        <view class="form-item status-item">
          <text class="label">状态</text>
          <view class="status-right">
            <text class="status-text">
              {{ form.is_active ? '启用中（正常往来）' : '停用（暂不往来）' }}
            </text>
            <switch
              :checked="form.is_active"
              @change="onActiveChange"
            />
          </view>
        </view>

        <!-- 备注 -->
        <view class="form-item">
          <text class="label">备注</text>
          <view class="textarea-wrapper">
            <textarea
              class="textarea"
              v-model="form.remark"
              placeholder="可填写结算方式、特殊价格约定等"
              auto-height
            />
          </view>
        </view>
      </view>

      <!-- 底部按钮 -->
      <view class="bottom-actions">
        <button class="btn-soft" @click="goBack">取消</button>
        <button class="btn-primary" @click="handleSave" :disabled="saving">
          {{ saving ? '保存中…' : '保存' }}
        </button>
      </view>
    </view>
  </view>
</template>

<script>
import { getToken as getAuthToken, ensureLogin } from '@/common/auth.js'

export default {
  data() {
    return {
      isEdit: false,
      id: '',
      saving: false,
      form: {
        name: '',
        short_name: '',
        contact: '',
        phone: '',
        address: '',
        default_unit_price: '',
        default_price_unit: 'kg', // kg / bottle
        remark: '',
        is_active: true
      },
      priceUnitOptions: ['按公斤计价', '按瓶计价', '按立方米计价'],
      priceUnitValues: ['kg', 'bottle', 'm3'],
      priceUnitIndex: 0
    }
  },

  computed: {
    priceUnitLabel() {
      return this.priceUnitOptions[this.priceUnitIndex]
    }
  },

  onLoad(options) {
    // 统一登录守卫
    if (!ensureLogin()) return

    if (options && options.id) {
      this.isEdit = true
      this.id = options.id
      this.loadDetail()
    }
  },

  methods: {
    // 统一 token 获取
    getToken() {
      const token = getAuthToken()
      if (!token) {
        uni.showToast({ title: '登录已过期，请重新登录', icon: 'none' })
        ensureLogin()
        return ''
      }
      return token
    },

    async loadDetail() {
      const token = this.getToken()
      if (!token) return

      try {
        uni.showLoading({ title: '加载中…', mask: true })
        const res = await uniCloud.callFunction({
          name: 'crm-customer',
          data: {
            action: 'get',
            token,
            data: { id: this.id }
          }
        })
        const result = res.result || {}

        if (result.code === 401) {
          uni.showToast({ title: result.msg || '登录已过期，请重新登录', icon: 'none' })
          ensureLogin()
          return
        }

        if (result.code !== 0) {
          uni.showToast({
            title: result.msg || '加载失败',
            icon: 'none'
          })
          return
        }

        const doc = result.data || {}

        this.form = {
          name: doc.name || '',
          short_name: doc.short_name || '',
          contact: doc.contact || '',
          phone: doc.phone != null ? String(doc.phone) : '',
          address: doc.address || '',
          default_unit_price:
            doc.default_unit_price != null ? String(doc.default_unit_price) : '',
          default_price_unit: doc.default_price_unit || 'kg',
          remark: doc.remark || '',
          is_active: typeof doc.is_active === 'boolean' ? doc.is_active : true
        }

        const idx = this.priceUnitValues.indexOf(this.form.default_price_unit)
        this.priceUnitIndex = idx >= 0 ? idx : 0
      } catch (e) {
        console.error('crm-customer get error:', e)
        uni.showToast({
          title: '加载失败，请稍后重试',
          icon: 'none'
        })
      } finally {
        uni.hideLoading()
      }
    },

    onPriceUnitChange(e) {
      const idx = Number(e.detail.value || 0)
      this.priceUnitIndex = idx
      this.form.default_price_unit = this.priceUnitValues[idx]
    },

    onActiveChange(e) {
      this.form.is_active = !!e.detail.value
    },

    // 电话输入过滤（只允许数字和 -）
    onPhoneInput(e) {
      const raw = e.detail.value || ''
      let cleaned = raw.replace(/[^\d-]/g, '')  // 非数字和 - 全部干掉
      cleaned = cleaned.replace(/-+/g, '-')     // 多个 - 合并
      if (cleaned.length > 20) cleaned = cleaned.slice(0, 20)
      this.form.phone = cleaned
    },

    // 电话规范化 + 严格校验
    normalizeAndValidatePhone() {
      const raw = String(this.form.phone || '').trim()
      if (!raw) return '' // 可空

      const noSpace = raw.replace(/\s+/g, '')
      const digitsOnly = noSpace.replace(/\D/g, '')

      // 手机：11 位 1 开头
      const isMobile = /^1[3-9]\d{9}$/.test(digitsOnly)

      // 座机：3-4 位区号 + 5-8 位号码，中间可带 -
      const landlinePattern = /^(\d{3,4})-?(\d{5,8})$/
      const landlineMatch = noSpace.match(landlinePattern)
      const isLandline = !!landlineMatch

      if (!isMobile && !isLandline) {
        return null
      }

      if (isMobile) {
        // 手机统一存 11 位数字
        return digitsOnly
      }

      // 座机统一「区号-号码」
      return `${landlineMatch[1]}-${landlineMatch[2]}`
    },

    async handleSave() {
      if (this.saving) return

      const name = (this.form.name || '').trim()
      if (!name) {
        return uni.showToast({
          title: '请填写客户名称',
          icon: 'none'
        })
      }

      // 电话校验（可空，有就校验）
      const normalizedPhone = this.normalizeAndValidatePhone()
      if (normalizedPhone === null) {
        return uni.showToast({
          title: '联系电话格式不正确，请检查',
          icon: 'none'
        })
      }

      const token = this.getToken()
      if (!token) return

      // 单价转 number，转不动就当没填
      let unitPrice = null
      if (this.form.default_unit_price !== '') {
        const n = Number(this.form.default_unit_price)
        if (!isNaN(n)) {
          unitPrice = n
        }
      }

      const payload = {
        name,
        short_name: (this.form.short_name || '').trim(),
        contact: (this.form.contact || '').trim(),
        phone: normalizedPhone, // 用规范化后的
        address: (this.form.address || '').trim(),
        default_unit_price: unitPrice,
        default_price_unit: this.form.default_price_unit || 'kg',
        remark: (this.form.remark || '').trim(),
        is_active: !!this.form.is_active
      }

      if (this.isEdit) {
        payload.id = this.id
      }

      this.saving = true
      try {
        const action = this.isEdit ? 'update' : 'create'

        const res = await uniCloud.callFunction({
          name: 'crm-customer',
          data: {
            action,
            token,
            data: payload
          }
        })

        const result = res.result || {}

        if (result.code === 401) {
          uni.showToast({ title: result.msg || '登录已过期，请重新登录', icon: 'none' })
          ensureLogin()
          return
        }

        if (result.code !== 0) {
          uni.showToast({
            title: result.msg || '保存失败',
            icon: 'none'
          })
          return
        }

        uni.showToast({
          title: '保存成功',
          icon: 'success'
        })

        setTimeout(() => {
          this.goBack()
        }, 500)
      } catch (e) {
        console.error('crm-customer save error:', e)
        uni.showToast({
          title: '保存失败，请稍后重试',
          icon: 'none'
        })
      } finally {
        this.saving = false
      }
    },

    goBack() {
      const pages = getCurrentPages()
      if (pages.length > 1) {
        uni.navigateBack()
      } else {
        uni.reLaunch({
          url: '/pages/customer/list'
        })
      }
    }
  }
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f2f4f9;
  padding: 24rpx 16rpx 40rpx;
  box-sizing: border-box;
}

.inner {
  max-width: 1200rpx;
  margin: 0 auto;
}

/* 顶部标题区 */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.page-header-left {
  display: flex;
  align-items: center;
}

.page-icon {
  width: 64rpx;
  height: 64rpx;
  border-radius: 22rpx;
  background: linear-gradient(135deg, #e2f0ff, #d3e6ff);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 18rpx;
}

.page-icon-text {
  font-size: 30rpx;
  font-weight: 600;
  color: #2b3a5a;
}

.page-header-text {
  display: flex;
  flex-direction: column;
}

.page-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #181c28;
}

.page-sub {
  margin-top: 4rpx;
  font-size: 24rpx;
  color: #949aac;
}

.page-header-right {
  display: flex;
  align-items: center;
}

/* 卡片 */
.card {
  background-color: #ffffff;
  border-radius: 20rpx;
  padding: 22rpx 24rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 8rpx 22rpx rgba(15, 35, 52, 0.04);
  box-sizing: border-box;
}

/* 表单项 */
.form-item {
  margin-bottom: 18rpx;
}

.label {
  display: block;
  font-size: 24rpx;
  color: #555;
  margin-bottom: 6rpx;
}

/* 输入框 */
.input-wrapper {
  width: 100%;
  height: 80rpx;
  padding: 0 20rpx;
  border-radius: 18rpx;
  border: 1rpx solid #e0e0e0;
  background: #ffffff;
  box-shadow: 0 8rpx 20rpx rgba(16, 46, 90, 0.04);
  box-sizing: border-box;
  display: flex;
  align-items: center;
}

.input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 28rpx;
  color: #222;
}

/* 两列行 */
.form-row {
  display: flex;
  justify-content: space-between;
  column-gap: 16rpx;
}

.form-item.half {
  flex: 1;
}

/* picker */
.picker-wrapper {
  padding: 0 16rpx;
}

.picker {
  flex: 1;
  display: flex;
  align-items: center;
  font-size: 26rpx;
  color: #222;
}

/* 备注 / 地址 */
.textarea-wrapper {
  width: 100%;
  border-radius: 18rpx;
  border: 1rpx solid #e0e0e0;
  background: #ffffff;
  padding: 12rpx 16rpx;
  box-sizing: border-box;
  box-shadow: 0 8rpx 20rpx rgba(16, 46, 90, 0.04);
}

.textarea {
  width: 100%;
  min-height: 120rpx;
  font-size: 26rpx;
  color: #222;
}

/* 状态行 */
.status-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.status-right {
  display: flex;
  align-items: center;
  column-gap: 10rpx;
}

.status-text {
  font-size: 24rpx;
  color: #6b7280;
}

/* 底部按钮 */
.bottom-actions {
  margin-top: 24rpx;
  display: flex;
  justify-content: flex-end;
  column-gap: 16rpx;
}

.btn-soft,
.btn-primary {
  min-width: 160rpx;
  padding: 14rpx 24rpx;
  border-radius: 999rpx;
  font-size: 26rpx;
}

.btn-soft {
  background: rgba(244, 247, 255, 0.9);
  color: #4d5cff;
  border: 1rpx solid rgba(212, 220, 255, 0.9);
}

.btn-soft::after {
  border: none;
}

.btn-primary {
  background: linear-gradient(135deg, #2979ff, #1a98ff);
  color: #ffffff;
  box-shadow: 0 14rpx 30rpx rgba(26, 120, 255, 0.32);
  border: none;
}

.btn-primary::after {
  border: none;
}
</style>
