<template>
  <view class="card card-basic">
    <view class="card-header">
      <text class="card-title">基础信息</text>
    </view>

    <view class="card-body">
      <!-- 业务模式切换：瓶装 / 整车（已去掉流量模式） -->
      <view class="mode-switch-bar">
        <view :class="['mode-pill', localMode === 'bottle' ? 'mode-pill-active' : '']" @tap="onModeClick('bottle')">
          <text :class="['mode-pill-text', localMode === 'bottle' ? 'mode-pill-text-active' : '']">
            瓶装模式
          </text>
        </view>

        <view :class="['mode-pill', localMode === 'truck' ? 'mode-pill-active' : '']" @tap="onModeClick('truck')">
          <text :class="['mode-pill-text', localMode === 'truck' ? 'mode-pill-text-active' : '']">
            整车模式
          </text>
        </view>
      </view>

      <!-- 第 1 行：客户 / 日期 / 车辆 -->
      <view class="form-row">
        <!-- 客户：联想输入 -->
        <view class="form-item col-third">
          <text class="label">* 客户</text>
          <view class="input-wrapper">
            <input class="input" :value="customerKeyword" placeholder="请输入客户名搜索" @input="onCustomerInput" />
          </view>
          <view v-if="customerSuggests.length" class="sbic-suggest">
            <view v-for="item in customerSuggests" :key="item._id" class="sbic-suggest-item" @tap.stop="onSelectCustomer(item)">
              <text class="sbic-suggest-main">{{ item.name }}</text>
              <text class="sbic-suggest-sub">{{ item.contact || '' }}</text>
            </view>
          </view>
        </view>

        <!-- 日期 -->
        <view class="form-item col-third">
          <text class="label">* 日期</text>
          <picker mode="date" :value="header.date" @change="onDateChange">
            <view class="input-wrapper">
              <view class="picker">
                <text>{{ header.date || '请选择日期' }}</text>
              </view>
            </view>
          </picker>
        </view>

        <!-- 车辆：联想输入 -->
        <view class="form-item col-third">
          <text class="label">车辆</text>
          <view class="input-wrapper">
            <input class="input" :value="vehicleKeyword" placeholder="车牌模糊搜索" @input="onVehicleInput" />
          </view>
          <view v-if="vehicleSuggests.length" class="sbic-suggest">
            <view v-for="item in vehicleSuggests" :key="item._id" class="sbic-suggest-item" @tap.stop="onSelectVehicle(item)">
              <text class="sbic-suggest-main">{{ item.plate_no || item.car_no || item.plateNo }}</text>
              <text class="sbic-suggest-sub">{{ item.name || '' }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 第 2 行：配送员1 / 配送员2 / 单价&单位 -->
      <view class="form-row">
        <!-- 配送员 1 -->
        <view class="form-item col-third">
          <text class="label">配送员 1</text>
          <view class="input-wrapper">
            <input class="input" :value="deliveryKeyword1" placeholder="输入姓名搜索" @input="onDelivery1Input" />
          </view>
          <view v-if="deliverySuggests1.length" class="sbic-suggest">
            <view v-for="item in deliverySuggests1" :key="item._id" class="sbic-suggest-item" @tap.stop="onSelectDelivery1(item)">
              <text class="sbic-suggest-main">{{ item.name }}</text>
              <text class="sbic-suggest-sub">{{ item.phone || '' }}</text>
            </view>
          </view>
        </view>

        <!-- 配送员 2 -->
        <view class="form-item col-third">
          <text class="label">配送员 2（可空）</text>
          <view class="input-wrapper">
            <input class="input" :value="deliveryKeyword2" placeholder="输入姓名搜索" @input="onDelivery2Input" />
          </view>
          <view v-if="deliverySuggests2.length" class="sbic-suggest">
            <view v-for="item in deliverySuggests2" :key="item._id" class="sbic-suggest-item" @tap.stop="onSelectDelivery2(item)">
              <text class="sbic-suggest-main">{{ item.name }}</text>
              <text class="sbic-suggest-sub">{{ item.phone || '' }}</text>
            </view>
          </view>
        </view>

        <!-- 单价 & 计价单位 -->
        <view class="form-item col-third">
          <text class="label">单价 &amp; 计价单位</text>
          <view class="dual-input">
            <view class="input-wrapper dual-left">
              <input class="input" type="number" placeholder="单价" :value="header.unit_price" @input="onUnitPriceInput" />
            </view>
            <picker mode="selector" class="dual-right" :range="priceUnitOptions" :value="priceUnitIndex" @change="onPriceUnitChange">
              <view class="input-wrapper">
                <view class="picker">
                  <text>{{ priceUnitOptions[priceUnitIndex] }}</text>
                </view>
              </view>
            </picker>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { getToken } from '@/common/auth.js'

export default {
  name: 'SaleBasicInfoCard',
  model: { prop: 'value', event: 'input' },
  props: {
    value: { type: Object, required: true },
    customers: { type: Array, default: () => [] },
    deliveryList: { type: Array, default: () => [] },
    vehicleList: { type: Array, default: () => [] }
  },
  data() {
    return {
      localMode: 'bottle',

      customerKeyword: '',
      customerSuggests: [],
      customerSuggestLoading: false,
      customerSuggestTimer: null,

      deliveryKeyword1: '',
      deliverySuggests1: [],

      deliveryKeyword2: '',
      deliverySuggests2: [],

      vehicleKeyword: '',
      vehicleSuggests: [],

      priceUnitOptions: ['元/kg', '元/瓶', '元/立方米'],
      priceUnitIndex: 0,

      unitPriceTouched: false,
      priceUnitTouched: false,

      // ===== 调试/并发控制 =====
      debugSuggest: false,        // 需要时你手动打开：__sale_basic_info_vm__.debugSuggest = true
      _suggestSeq: 0              // 防止旧请求覆盖新请求
    }
  },
  computed: {
    header() {
      return this.value || {}
    }
  },
  watch: {
    value: {
      immediate: true,
      handler(v) {
        const h = v || {}

        this.customerKeyword = h.customer_name || ''
        this.deliveryKeyword1 = h.delivery_man_1 || ''
        this.deliveryKeyword2 = h.delivery_man_2 || ''
        this.vehicleKeyword = h.car_no || ''

        const unit = h.price_unit || 'kg'
        const map = { kg: 0, bottle: 1, cbm: 2, m3: 2 }
        this.priceUnitIndex = map[unit] != null ? map[unit] : 0

        let mode = h.biz_mode || 'bottle'
        if (mode !== 'bottle' && mode !== 'truck') mode = 'bottle'
        this.localMode = mode

        if (!h.customer_id && !h.customer_name) {
          this.unitPriceTouched = false
          this.priceUnitTouched = false
        }
      }
    }
  },
  mounted() {
    this.exposeVmToConsole()
  },
  methods: {
    updateHeader(patch) {
      const next = { ...(this.value || {}), ...patch }
      this.$emit('input', next)
    },

    normalizeKeyword(str) {
      return String(str || '').replace(/[\s\u3000]+/g, '').trim()
    },

    mapPriceUnit(u) {
      const v = String(u || '').trim().toLowerCase()
      if (v === 'kg') return 'kg'
      if (v === 'bottle') return 'bottle'
      if (v === 'm3' || v === 'cbm') return 'm3'
      return 'kg'
    },

    isEmptyPrice(v) {
      if (v === null || typeof v === 'undefined') return true
      const n = Number(v)
      if (Number.isNaN(n)) return true
      return n <= 0
    },

    /* ===== 业务模式切换 ===== */
    onModeClick(mode) {
      if (this.localMode === mode) return
      this.localMode = mode

      const patch = { biz_mode: mode }

      if (mode === 'truck') {
        if (!this.header.price_unit || this.header.price_unit === 'm3') {
          patch.price_unit = 'kg'
          this.priceUnitIndex = 0
        }
      } else {
        if (this.header.price_unit === 'm3') {
          patch.price_unit = 'kg'
          this.priceUnitIndex = 0
        }
      }

      this.updateHeader(patch)
      this.$emit('mode-change', mode)
    },

    /* ===== 客户联想 ===== */
    onCustomerInput(e) {
      const val = this.normalizeKeyword(e.detail.value)
      this.customerKeyword = val
      this.updateHeader({ customer_name: val, customer_id: '' })

      if (!val) {
        this.customerSuggests = []
        return
      }

      if (this.customerSuggestTimer) clearTimeout(this.customerSuggestTimer)
      this.customerSuggestTimer = setTimeout(() => {
        this.fetchCustomerSuggests()
      }, 200)
    },

    onSelectCustomer(item) {
      if (!item) return
      this.customerKeyword = this.normalizeKeyword(item.name)
      this.customerSuggests = []

      const patch = {
        customer_id: item._id,
        customer_name: item.name
      }

      if (!this.unitPriceTouched && this.isEmptyPrice(this.header.unit_price) && item.default_unit_price != null) {
        patch.unit_price = item.default_unit_price
      }

      if (!this.priceUnitTouched && item.default_price_unit) {
        const unit = this.mapPriceUnit(item.default_price_unit)
        patch.price_unit = unit
        const map = { kg: 0, bottle: 1, m3: 2 }
        this.priceUnitIndex = map[unit] != null ? map[unit] : 0
      }

      this.updateHeader(patch)
    },

    async fetchCustomerSuggests() {
      const kw = this.normalizeKeyword(this.customerKeyword)
      if (!kw) {
        this.customerSuggests = []
        this.customerSuggestLoading = false
        return
      }

      const token = getToken()
      if (!token) return

      const seq = ++this._suggestSeq

      this.customerSuggestLoading = true
      try {
        const res = await uniCloud.callFunction({
          name: 'crm-customer',
          data: {
            action: 'suggest',
            token,
            data: {
              keyword: kw,
              limit: 20,
              debug: this.debugSuggest === true
            }
          }
        })

        // 如果这是旧请求，直接丢弃
        if (seq !== this._suggestSeq) return

        const result = res.result || {}
        if (this.debugSuggest) {
          console.log('[customer suggest]', 'kw=', kw, 'code=', result.code, 'count=', (result.data || []).length, 'debug=', result.debug, result.data)
        }

        if (result.code === 0) {
          this.customerSuggests = result.data || []
        } else {
          this.customerSuggests = []
        }
      } catch (err) {
        if (seq !== this._suggestSeq) return
        console.error('[SaleBasicInfoCard] fetchCustomerSuggests error', err)
      } finally {
        if (seq === this._suggestSeq) this.customerSuggestLoading = false
      }
    },

    /* ===== 车辆联想 ===== */
    onVehicleInput(e) {
      const val = e.detail.value.trim()
      this.vehicleKeyword = val

      if (!val) {
        this.vehicleSuggests = []
        return
      }

      const list = (this.vehicleList || []).filter(v => {
        if (!v) return false
        const plate = v.car_no || v.plate_no || v.plateNo || ''
        return plate.indexOf(val) !== -1
      })
      this.vehicleSuggests = list.slice(0, 20)
    },

    onSelectVehicle(item) {
      if (!item) return
      const plate = item.car_no || item.plate_no || item.plateNo || ''
      this.vehicleKeyword = plate
      this.vehicleSuggests = []
      this.updateHeader({ vehicle_id: item._id || '', car_no: plate })
      this.$emit('vehicle-select', { vehicle: item, plate_no: plate })
    },

    /* ===== 配送员联想 ===== */
    onDelivery1Input(e) {
      const val = e.detail.value.trim()
      this.deliveryKeyword1 = val
      this.updateHeader({ delivery_man_1: val })

      if (!val) {
        this.deliverySuggests1 = []
        return
      }

      const list = (this.deliveryList || []).filter(d => d && d.name && d.name.indexOf(val) !== -1)
      this.deliverySuggests1 = list.slice(0, 20)
    },

    onSelectDelivery1(item) {
      if (!item) return
      this.deliveryKeyword1 = item.name
      this.deliverySuggests1 = []
      this.updateHeader({ delivery_man_1: item.name })
    },

    onDelivery2Input(e) {
      const val = e.detail.value.trim()
      this.deliveryKeyword2 = val
      this.updateHeader({ delivery_man_2: val })

      if (!val) {
        this.deliverySuggests2 = []
        return
      }

      const list = (this.deliveryList || []).filter(d => d && d.name && d.name.indexOf(val) !== -1)
      this.deliverySuggests2 = list.slice(0, 20)
    },

    onSelectDelivery2(item) {
      if (!item) return
      this.deliveryKeyword2 = item.name
      this.deliverySuggests2 = []
      this.updateHeader({ delivery_man_2: item.name })
    },

    /* ===== 其他字段 ===== */
    onDateChange(e) {
      this.updateHeader({ date: e.detail.value })
    },

    onUnitPriceInput(e) {
      this.unitPriceTouched = true
      this.updateHeader({ unit_price: e.detail.value })
    },

    onPriceUnitChange(e) {
      this.priceUnitTouched = true
      const idx = Number(e.detail.value)
      this.priceUnitIndex = idx
      let unit = 'kg'
      if (idx === 1) unit = 'bottle'
      if (idx === 2) unit = 'm3'
      this.updateHeader({ price_unit: unit })
    },

    /* ===================== 管理员工具（fix / import） ===================== */
    exposeVmToConsole() {
      try {
        if (typeof window !== 'undefined') {
          // 直接挂在 window 上，不要 const vm，避免你控制台重复声明炸
          window.__sale_basic_info_vm__ = this
        }
      } catch (e) {}
    },

    async callCrmCustomer(action, data) {
      const token = getToken()
      if (!token) throw new Error('没有 token：请先登录')

      const res = await uniCloud.callFunction({
        name: 'crm-customer',
        data: { action, token, data }
      })

      const result = res.result || {}
      if (result.code !== 0) throw new Error(result.msg || `callFunction ${action} failed`)
      return result
    },

    async runCustomerFixAll({ dryRun = true, batchSize = 200 } = {}) {
      let startAfterId = ''
      let totalScanned = 0
      let totalUpdated = 0
      let batch = 0

      console.log('[fix] start', { dryRun, batchSize })

      while (true) {
        batch += 1
        const r = await this.callCrmCustomer('fix', { dryRun, batchSize, startAfterId })

        const scanned = Number(r.scanned || 0)
        const updated = Number(r.updated || 0)
        const nextAfterId = r.nextAfterId || ''

        console.log(`[fix] batch #${batch}`, { scanned, updated, nextAfterId, dups: r.dups || [] })

        if (!scanned) break

        totalScanned += scanned
        totalUpdated += updated
        startAfterId = nextAfterId
      }

      console.log('[fix] finished', { dryRun, totalScanned, totalUpdated })
      return { dryRun, totalScanned, totalUpdated }
    },

    async runCustomerImport({ rows = [], dryRun = true, overwrite = false } = {}) {
      if (!Array.isArray(rows) || rows.length === 0) throw new Error('rows 为空：请先把导入数据整理成数组')

      console.log('[import] start', { dryRun, overwrite, rows: rows.length })
      const r = await this.callCrmCustomer('import', { rows, dryRun, overwrite })
      console.log('[import] result', r)
      return r
    }
  }
}
</script>

<style scoped>
.card {
  background-color: #ffffff;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.03);
}

.card-header {
  padding-bottom: 10rpx;
  border-bottom: 1px solid #f0f0f0;
  margin-bottom: 14rpx;
}

.card-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
}

.card-body {
  margin-top: 4rpx;
}

.mode-switch-bar {
  display: flex;
  align-items: center;
  margin-bottom: 20rpx;
  padding: 4rpx;
  border-radius: 999rpx;
  background: #f2f4ff;
  column-gap: 18rpx;
}

.mode-pill {
  flex: 1;
  height: 72rpx;
  border-radius: 999rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
}

.mode-pill-text {
  font-size: 26rpx;
  color: #4b5563;
}

.mode-pill-active {
  background: linear-gradient(135deg, #2979ff, #1a98ff);
  box-shadow: 0 10rpx 24rpx rgba(26, 120, 255, 0.32);
}

.mode-pill-text-active {
  color: #ffffff;
}

.form-row {
  display: flex;
  margin: 0 -8rpx;
  flex-wrap: nowrap;
}

.form-row .form-item {
  padding: 0 8rpx;
}

.form-item {
  margin-bottom: 18rpx;
}

.col-third {
  width: 33.33%;
}

.label {
  display: block;
  font-size: 26rpx;
  margin-bottom: 6rpx;
  color: #555;
}

.input-wrapper {
  width: 100%;
  height: 88rpx;
  background: #ffffff;
  border-radius: 20rpx;
  box-sizing: border-box;
  border: 1rpx solid #e0e0e0;
  padding: 0 20rpx;
  display: flex;
  align-items: center;
  box-shadow: 0 10rpx 24rpx rgba(16, 46, 90, 0.04);
}

.input {
  flex: 1;
  height: 100%;
  box-sizing: border-box;
  border: none;
  background: transparent;
  font-size: 28rpx;
  color: #222;
}

.picker {
  flex: 1;
  height: 100%;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  font-size: 28rpx;
  color: #222;
}

.dual-input {
  display: flex;
  align-items: center;
}

.dual-left {
  flex: 2;
  margin-right: 10rpx;
}

.dual-right {
  flex: 3;
  margin-left: 10rpx;
}

.sbic-suggest {
  margin-top: 8rpx;
  border-radius: 16rpx;
  background: #f7f8fc;
  padding: 8rpx 6rpx;
}

.sbic-suggest-item {
  padding: 8rpx 12rpx;
  border-radius: 12rpx;
  display: flex;
  justify-content: space-between;
  font-size: 24rpx;
}

.sbic-suggest-item + .sbic-suggest-item {
  margin-top: 4rpx;
}

.sbic-suggest-main {
  color: #333;
}

.sbic-suggest-sub {
  color: #9aa0b2;
}
</style>
