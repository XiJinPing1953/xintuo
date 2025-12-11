<template>
  <view class="vehicle-detail-page">
    <BackToDashboardBar back-to="/pages/vehicle/list" text="返回车辆列表" />

    <view class="card">
      <view class="card-body header-body">
        <view class="plate-tag large">
          <text class="plate-text">{{ vehicle.plate_no || '未填车牌' }}</text>
        </view>
        <view class="title-block">
          <text class="page-title">{{ vehicle.name || '未命名车辆' }}</text>
          <text class="page-sub">{{ vehicle.remark || '暂无备注' }}</text>
        </view>
        <view class="summary">
          <view class="summary-item">
            <text class="summary-label">加油/保养/维修次数</text>
            <text class="summary-value">{{ maintainList.length }}</text>
          </view>
          <view class="summary-item">
            <text class="summary-label">累计金额</text>
            <text class="summary-value price">￥{{ maintainTotal }}</text>
          </view>
        </view>
        <view class="header-actions" v-if="isAdmin">
          <button class="btn-soft" size="mini" @click="toggleEdit">
            {{ editMode ? '取消编辑' : '编辑车辆' }}
          </button>
        </view>
      </view>
    </view>

    <view class="card">
      <view class="card-header">
        <text class="card-title">基础信息</text>
      </view>
      <view class="card-body">
        <view v-if="!editMode" class="info-grid">
          <view class="info-row">
            <text class="label">车牌号</text>
            <text class="value">{{ vehicle.plate_no || '-' }}</text>
          </view>
          <view class="info-row">
            <text class="label">车辆名称</text>
            <text class="value">{{ vehicle.name || '未命名车辆' }}</text>
          </view>
          <view class="info-row">
            <text class="label">保险续期</text>
            <view class="value with-tag">
              <text>{{ vehicle.insurance_due_date || '未设置' }}</text>
              <text v-if="insuranceBadge" :class="['due-tag', insuranceBadge.type]">{{ insuranceBadge.text }}</text>
            </view>
          </view>
          <view class="info-row">
            <text class="label">年检时间</text>
            <view class="value with-tag">
              <text>{{ vehicle.inspection_due_date || '未设置' }}</text>
              <text v-if="inspectionBadge" :class="['due-tag', inspectionBadge.type]">{{ inspectionBadge.text }}</text>
            </view>
          </view>
          <view class="info-row">
            <text class="label">备注</text>
            <text class="value">{{ vehicle.remark || '暂无备注' }}</text>
          </view>
        </view>

        <view v-else class="form-body">
          <view class="form-item">
            <text class="label">* 车牌号</text>
            <view class="input-wrapper">
              <input
                class="input"
                :value="editForm.plate_no"
                placeholder="例如 浙A12345"
                maxlength="10"
                @input="onPlateInput"
              />
            </view>
            <text class="helper">支持大写字母/数字/汉字/短横线，5-10 位</text>
          </view>
          <view class="form-item">
            <text class="label">车辆名称</text>
            <view class="input-wrapper">
              <input class="input" v-model.trim="editForm.name" placeholder="例如 1 号配送车" />
            </view>
          </view>
          <view class="form-item">
            <text class="label">保险续期时间</text>
            <picker mode="date" :value="editForm.insurance_due_date" @change="(e) => onDatePick('insurance_due_date', e)">
              <view class="input-wrapper picker-wrapper">
                <text class="picker-text">{{ editForm.insurance_due_date || '请选择日期' }}</text>
              </view>
            </picker>
          </view>
          <view class="form-item">
            <text class="label">年检时间</text>
            <picker mode="date" :value="editForm.inspection_due_date" @change="(e) => onDatePick('inspection_due_date', e)">
              <view class="input-wrapper picker-wrapper">
                <text class="picker-text">{{ editForm.inspection_due_date || '请选择日期' }}</text>
              </view>
            </picker>
          </view>
          <view class="form-item">
            <text class="label">备注</text>
            <view class="input-wrapper">
              <textarea
                class="textarea"
                v-model.trim="editForm.remark"
                placeholder="可补充车辆类型、吨位、使用范围等信息"
              />
            </view>
          </view>
          <view class="form-actions">
            <button class="btn-soft" @click="cancelEdit" :disabled="saving">取消</button>
            <button class="btn-primary" @click="submitEdit" :disabled="saving">
              {{ saving ? '保存中…' : '保存车辆' }}
            </button>
          </view>
        </view>
      </view>
    </view>

    <view class="card">
      <view class="card-header">
        <text class="card-title">加油 / 保养 / 维修记录</text>
        <text class="card-sub">时间与项目需通过选择器填写，其他项可选填</text>
      </view>
      <view class="card-body">
        <view class="maintain-switch">
          <view
            class="maintain-tab"
            :class="{ active: maintainForm.mode === 'fuel' }"
            @click="switchMaintainMode('fuel')"
          >
            <text>加油</text>
          </view>
          <view
            class="maintain-tab"
            :class="{ active: maintainForm.mode === 'service' }"
            @click="switchMaintainMode('service')"
          >
            <text>保养 / 维修</text>
          </view>
        </view>

        <view class="maintain-card" :class="maintainForm.mode">
          <view class="maintain-card-title">
            <text>{{ maintainForm.mode === 'fuel' ? '加油记录' : '保养 / 维修记录' }}</text>
            <text class="card-tip">请选择日期与项目，其他可选填</text>
          </view>

          <view class="maintain-form-row">
            <view class="maintain-field">
              <text class="label">时间</text>
              <picker mode="date" :value="maintainForm.date" @change="onMaintainDateChange">
                <view class="picker-input" :class="{ placeholder: !maintainForm.date }">
                  {{ maintainForm.date || '点击选择日期' }}
                </view>
              </picker>
            </view>
            <view class="maintain-field">
              <text class="label">项目</text>
              <picker mode="selector" :range="currentProjectOptions" @change="onMaintainProjectChange">
                <view class="picker-input">
                  {{ maintainForm.project || '请选择项目' }}
                </view>
              </picker>
            </view>
          </view>

          <view v-if="maintainForm.mode === 'fuel'" class="maintain-form-row">
            <view class="maintain-field">
              <text class="label">油品 / 加油位置</text>
              <input class="input" v-model="maintainForm.part" placeholder="例如 92# 汽油 / XX 加油站" />
            </view>
            <view class="maintain-field">
              <text class="label">加油人</text>
              <picker mode="selector" :range="staffPickerRange" :value="staffPickerIndex" @change="onStaffPickerChange">
                <view class="picker-input" :class="{ placeholder: !maintainForm.staff }">
                  {{ maintainForm.staff || '选择配送员' }}
                </view>
              </picker>
            </view>
          </view>

          <view v-else class="maintain-form-row">
            <view class="maintain-field">
              <text class="label">配件 / 耗材</text>
              <input class="input" v-model="maintainForm.part" placeholder="例如 机油滤芯 / 火花塞" />
            </view>
            <view class="maintain-field">
              <text class="label">维修 / 保养人员</text>
              <picker mode="selector" :range="staffPickerRange" :value="staffPickerIndex" @change="onStaffPickerChange">
                <view class="picker-input" :class="{ placeholder: !maintainForm.staff }">
                  {{ maintainForm.staff || '选择配送员' }}
                </view>
              </picker>
            </view>
          </view>

          <view class="maintain-form-row">
            <view class="maintain-field short">
              <text class="label">单价</text>
              <input class="input" type="digit" v-model="maintainForm.unitPrice" placeholder="数字" />
            </view>
            <view class="maintain-field short">
              <text class="label">数量</text>
              <input class="input" type="digit" v-model="maintainForm.quantity" placeholder="1" />
            </view>
            <view class="maintain-field short">
              <text class="label">公里数</text>
              <input class="input" type="digit" v-model="maintainForm.mileage" placeholder="车辆里程" />
            </view>
            <view class="maintain-field short">
              <text class="label">金额</text>
              <input class="input" type="digit" v-model="maintainForm.amount" placeholder="自动按单价*数量" />
            </view>
          </view>

          <view class="maintain-form-row">
            <view class="maintain-field">
              <text class="label">备注</text>
              <textarea class="textarea" v-model="maintainForm.remark" placeholder="例如：更换刹车片，附开票时间" />
            </view>
          </view>

          <view class="maintain-actions">
            <button class="btn-soft" @click="resetMaintainForm">清空当前输入</button>
            <button class="btn-primary" @click="addMaintainEntry">加入记录</button>
          </view>
        </view>

        <view class="maintain-list" v-if="maintainList.length">
          <view class="maintain-list-head">
            <text class="cell time">时间</text>
            <text class="cell project">项目</text>
            <text class="cell part">配件/耗材</text>
            <text class="cell price">单价</text>
            <text class="cell qty">数量</text>
            <text class="cell amount">金额</text>
            <text class="cell mileage">公里数</text>
            <text class="cell staff">人员</text>
            <text class="cell remark">备注</text>
            <text class="cell op">操作</text>
          </view>
          <view v-for="row in maintainList" :key="row._id || row.local_id" class="maintain-list-row">
            <text class="cell time">{{ row.date || '-' }}</text>
            <text class="cell project">{{ row.project || '-' }}</text>
            <text class="cell part">{{ row.part || '-' }}</text>
            <text class="cell price">{{ formatMoney(row.unit_price) }}</text>
            <text class="cell qty">{{ row.quantity || 0 }}</text>
            <text class="cell amount">{{ formatMoney(row.amount) }}</text>
            <text class="cell mileage">{{ row.mileage || '-' }}</text>
            <text class="cell staff">{{ row.staff || '-' }}</text>
            <text class="cell remark">{{ row.remark || '-' }}</text>
            <text class="cell op">
              <text class="action-link danger" @click="removeMaintain(row)">删除</text>
            </text>
          </view>
        </view>

        <view v-else class="list-empty">
          <text class="empty-text">暂无加油/保养/维修记录，可在上方填写后加入</text>
        </view>

        <view class="maintain-footer">
          <button class="btn-soft" @click="loadDetail" :disabled="maintainSaving">刷新</button>
          <button class="btn-primary" @click="saveMaintain" :disabled="maintainSaving || !vehicle._id">
            {{ maintainSaving ? '保存中…' : '保存记录' }}
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import BackToDashboardBar from '@/components/BackToDashboardBar.vue'
import { ensureLogin, getUserInfo, isAdminRole } from '@/common/auth.js'
import { callCloud } from '@/common/request.js'
import {
  createEmptyMaintainForm,
  normalizeMaintainEntry,
  formatMaintainMoney,
  PROJECT_OPTIONS
} from '@/common/maintain-log.js'
import { cleanPlateInput, normalizePlate } from '@/common/plate.js'

export default {
  components: {
    BackToDashboardBar
  },
  data() {
    return {
      vehicleId: '',
      vehicle: {},
      userInfo: {},
      loading: false,
      saving: false,
      editMode: false,
      editForm: {
        plate_no: '',
        name: '',
        insurance_due_date: '',
        inspection_due_date: '',
        remark: ''
      },
      maintainList: [],
      maintainForm: createEmptyMaintainForm('fuel'),
      projectOptions: PROJECT_OPTIONS,
      maintainSaving: false,
      deliveryList: [],
      staffPickerIndex: -1
    }
  },
  computed: {
    isAdmin() {
      return isAdminRole(this.userInfo)
    },
    maintainTotal() {
      return this.maintainList
        .reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
        .toFixed(2)
    },
    currentProjectOptions() {
      const options = this.projectOptions || {}
      const list = this.maintainForm.mode === 'service' ? options.service : options.fuel
      return Array.isArray(list) && list.length ? list : []
    },
    insuranceBadge() {
      return this.buildDueBadge(this.vehicle.insurance_due_date)
    },
    inspectionBadge() {
      return this.buildDueBadge(this.vehicle.inspection_due_date)
    },
    staffPickerRange() {
      return (this.deliveryList || []).map((item) => {
        const name = item.name || item.real_name || '未命名'
        return item.phone ? `${name}（${item.phone}）` : name
      })
    }
  },
  onLoad(options) {
    if (!ensureLogin()) return
    this.userInfo = getUserInfo() || {}
    this.vehicleId = options && options.id ? options.id : ''
    this.loadDeliveryList()
    this.loadDetail()
  },
  methods: {
    normalizeAndValidatePlate(value) {
      return normalizePlate(value)
    },
    onPlateInput(e) {
      this.editForm.plate_no = cleanPlateInput(e.detail && e.detail.value)
    },
    async loadDetail() {
      if (!this.vehicleId) return
      this.loading = true
      try {
        const result = await callCloud('crm-vehicle', {
          action: 'detail',
          data: {
            id: this.vehicleId
          }
        })
        if (result.code !== 0) return
        const data = result.data || {}
        this.vehicle = {
          ...data,
          maintain_total_amount: Number(data.maintain_total_amount || 0).toFixed(2)
        }
        this.maintainList = this.withLocalIds(data.maintain_logs || [])
        if (!this.editMode) {
          this.editForm = {
            plate_no: data.plate_no || '',
            name: data.name || '',
            insurance_due_date: data.insurance_due_date || '',
            inspection_due_date: data.inspection_due_date || '',
            remark: data.remark || ''
          }
        }
      } catch (err) {
        console.error('crm-vehicle detail error', err)
        uni.showToast({ title: '请求出错', icon: 'none' })
      } finally {
        this.loading = false
      }
    },
    toggleEdit() {
      if (!this.isAdmin) {
        return uni.showToast({ title: '当前账号无权限编辑车辆', icon: 'none' })
      }
      this.editMode = !this.editMode
      if (this.editMode) {
        this.editForm = {
          plate_no: this.vehicle.plate_no || '',
          name: this.vehicle.name || '',
          insurance_due_date: this.vehicle.insurance_due_date || '',
          inspection_due_date: this.vehicle.inspection_due_date || '',
          remark: this.vehicle.remark || ''
        }
      }
    },
    cancelEdit() {
      this.editMode = false
      this.editForm = {
        plate_no: this.vehicle.plate_no || '',
        name: this.vehicle.name || '',
        insurance_due_date: this.vehicle.insurance_due_date || '',
        inspection_due_date: this.vehicle.inspection_due_date || '',
        remark: this.vehicle.remark || ''
      }
    },
    onDatePick(field, e) {
      this.editForm[field] = (e && e.detail && e.detail.value) || ''
    },
    async submitEdit() {
      if (!this.isAdmin) {
        return uni.showToast({ title: '当前账号无权限编辑车辆', icon: 'none' })
      }
      const plate = this.normalizeAndValidatePlate(this.editForm.plate_no)
      if (plate === '') {
        return uni.showToast({ title: '请填写车牌号', icon: 'none' })
      }
      if (plate === null) {
        return uni.showToast({ title: '车牌号格式不正确', icon: 'none' })
      }
      this.saving = true
      try {
        const result = await callCloud('crm-vehicle', {
          action: 'update',
          data: {
            id: this.vehicle._id,
            plate_no: plate,
            name: (this.editForm.name || '').trim(),
            insurance_due_date: this.editForm.insurance_due_date || '',
            inspection_due_date: this.editForm.inspection_due_date || '',
            remark: (this.editForm.remark || '').trim()
          }
        })
        if (result.code !== 0) return
        uni.showToast({ title: '保存成功', icon: 'none' })
        this.editMode = false
        await this.loadDetail()
      } catch (err) {
        console.error('crm-vehicle update error', err)
        uni.showToast({ title: '请求出错', icon: 'none' })
      } finally {
        this.saving = false
      }
    },
    async loadDeliveryList() {
      try {
        const result = await callCloud('crm-delivery', { action: 'list', data: {} })
        if (result.code !== 0) return
        this.deliveryList = result.data || []
        this.syncStaffPicker()
      } catch (err) {
        console.error('crm-delivery list error', err)
        uni.showToast({ title: '配送员列表加载失败', icon: 'none' })
      }
    },
    syncStaffPicker() {
      const name = (this.maintainForm && this.maintainForm.staff ? this.maintainForm.staff : '').trim()
      if (!name) {
        this.staffPickerIndex = -1
        return
      }
      const idx = (this.deliveryList || []).findIndex((item) => {
        const candidate = (item.name || item.real_name || '').trim()
        return candidate && candidate === name
      })
      this.staffPickerIndex = idx
    },
    switchMaintainMode(mode) {
      this.maintainForm = createEmptyMaintainForm(mode)
      this.staffPickerIndex = -1
    },
    resetMaintainForm(mode) {
      const targetMode = mode || this.maintainForm.mode || 'fuel'
      this.maintainForm = createEmptyMaintainForm(targetMode)
      this.staffPickerIndex = -1
    },
    onMaintainDateChange(e) {
      this.maintainForm.date = (e.detail && e.detail.value) || ''
    },
    onMaintainProjectChange(e) {
      const index = Number(e.detail && e.detail.value)
      if (Number.isNaN(index)) return
      const options = this.currentProjectOptions
      this.maintainForm.project = options[index] || ''
    },
    onStaffPickerChange(e) {
      const index = Number(e.detail && e.detail.value)
      if (Number.isNaN(index)) return
      const option = (this.deliveryList || [])[index]
      if (!option) return
      this.staffPickerIndex = index
      this.maintainForm.staff = (option.name || option.real_name || option.phone || '').trim()
    },
    addMaintainEntry() {
      if (!this.isAdmin) {
        return uni.showToast({ title: '当前账号无权限维护记录', icon: 'none' })
      }
      if (!this.maintainForm.date) {
        return uni.showToast({ title: '请选择时间', icon: 'none' })
      }
      if (!this.maintainForm.project) {
        return uni.showToast({ title: '请选择项目', icon: 'none' })
      }

      const entry = normalizeMaintainEntry(this.maintainForm)
      if (!entry) return
      this.maintainList = [entry, ...this.maintainList]
      this.resetMaintainForm(this.maintainForm.mode)
    },
    removeMaintain(row) {
      this.maintainList = this.maintainList.filter((r) => r !== row)
    },
    formatMoney(val) {
      return formatMaintainMoney(val)
    },
    async saveMaintain() {
      if (!this.isAdmin) {
        return uni.showToast({ title: '当前账号无权限维护记录', icon: 'none' })
      }
      if (!this.vehicle._id) {
        return uni.showToast({ title: '请先选择车辆', icon: 'none' })
      }
      this.maintainSaving = true
      try {
        const result = await callCloud('crm-vehicle', {
          action: 'update',
          data: {
            id: this.vehicle._id,
            maintain_logs: this.maintainList
          }
        })
        if (result.code !== 0) return
        uni.showToast({ title: '记录已保存', icon: 'none' })
        await this.loadDetail()
      } catch (err) {
        console.error('crm-vehicle maintain save error', err)
        uni.showToast({ title: '请求出错', icon: 'none' })
      } finally {
        this.maintainSaving = false
      }
    },
    withLocalIds(list) {
      return (list || []).map((row, idx) => ({
        ...row,
        local_id: row.local_id || row._id || `maintain-${idx}-${Date.now()}`
      }))
    },
    buildDueBadge(dateText) {
      if (!dateText) return null
      const ts = new Date(`${dateText}T00:00:00`).getTime()
      if (Number.isNaN(ts)) return null
      const today = new Date()
      const todayTs = new Date(
        `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}T00:00:00`
      ).getTime()
      const diffDays = Math.floor((ts - todayTs) / 86400000)
      if (diffDays < 0) return { text: '已过期', type: 'danger' }
      if (diffDays <= 30) return { text: `剩余 ${diffDays} 天`, type: 'warning' }
      return { text: '已设置', type: 'info' }
    }
  }
}
</script>

<style scoped>
.vehicle-detail-page {
  padding: 24rpx;
  background: #f6f7fb;
  min-height: 100vh;
}

.header-body {
  display: flex;
  align-items: center;
  gap: 20rpx;
  flex-wrap: wrap;
}

.plate-tag {
  padding: 10rpx 16rpx;
  border-radius: 999rpx;
  background: linear-gradient(135deg, #4f8efc, #74b2ff);
  box-shadow: 0 8rpx 18rpx rgba(79, 142, 252, 0.2);
}

.plate-text {
  font-size: 26rpx;
  font-weight: 600;
  color: #ffffff;
  letter-spacing: 2rpx;
}

.title-block {
  flex: 1;
  min-width: 320rpx;
}

.page-title {
  font-size: 36rpx;
  font-weight: 700;
  color: #1f2937;
  display: block;
}

.page-sub {
  display: block;
  margin-top: 8rpx;
  color: #6b7280;
  font-size: 26rpx;
}

.summary {
  display: flex;
  gap: 16rpx;
}

.summary-item {
  background: #f1f5f9;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  min-width: 160rpx;
}

.summary-label {
  display: block;
  color: #6b7280;
  font-size: 24rpx;
}

.summary-value {
  display: block;
  margin-top: 6rpx;
  font-size: 32rpx;
  font-weight: 700;
  color: #111827;
}

.summary-value.price {
  color: #0ea5e9;
}

.header-actions {
  margin-left: auto;
}

.card {
  background: #fff;
  border-radius: 16rpx;
  margin-top: 24rpx;
  box-shadow: 0 6rpx 24rpx rgba(0, 0, 0, 0.04);
  overflow: hidden;
}

.card-header {
  padding: 24rpx;
  border-bottom: 1px solid #f3f4f6;
}

.card-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #111827;
}

.card-sub {
  display: block;
  margin-top: 6rpx;
  color: #6b7280;
  font-size: 24rpx;
}

.card-body {
  padding: 24rpx;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320rpx, 1fr));
  gap: 16rpx 24rpx;
}

.info-row {
  background: #f8fafc;
  border-radius: 12rpx;
  padding: 16rpx 18rpx;
}

.info-row .label {
  display: block;
  color: #6b7280;
  font-size: 24rpx;
}

.info-row .value {
  display: block;
  margin-top: 6rpx;
  color: #111827;
  font-size: 28rpx;
  word-break: break-all;
}

.info-row .value.with-tag {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.due-tag {
  padding: 6rpx 12rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  line-height: 1;
  background: #eef2ff;
  color: #4338ca;
}

.due-tag.warning {
  background: #fff7ed;
  color: #c2410c;
}

.due-tag.danger {
  background: #fef2f2;
  color: #b91c1c;
}

.form-item {
  margin-bottom: 24rpx;
}

.input-wrapper {
  background: #f8fafc;
  border-radius: 12rpx;
  padding: 12rpx 16rpx;
  border: 1px solid #e5e7eb;
}

.input,
.textarea {
  width: 100%;
  font-size: 28rpx;
  color: #111827;
}

.textarea {
  min-height: 120rpx;
}

.helper {
  display: block;
  margin-top: 8rpx;
  color: #6b7280;
  font-size: 22rpx;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 16rpx;
  margin-top: 8rpx;
}

.maintain-switch {
  display: flex;
  gap: 12rpx;
  margin-bottom: 16rpx;
}

.maintain-tab {
  padding: 14rpx 20rpx;
  border-radius: 12rpx;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 26rpx;
}

.maintain-tab.active {
  background: #0ea5e9;
  color: #fff;
}

.maintain-card {
  border: 1px solid #e5e7eb;
  border-radius: 16rpx;
  padding: 20rpx;
  background: #f8fafc;
  margin-bottom: 16rpx;
}

.maintain-card-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 28rpx;
  font-weight: 700;
  color: #0f172a;
}

.card-tip {
  font-size: 24rpx;
  color: #6b7280;
}

.maintain-form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320rpx, 1fr));
  gap: 12rpx 16rpx;
  margin-top: 16rpx;
}

.maintain-field {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12rpx;
  padding: 12rpx 14rpx;
}

.maintain-field.short {
  min-width: 180rpx;
}

.maintain-field .label {
  display: block;
  color: #6b7280;
  font-size: 24rpx;
  margin-bottom: 8rpx;
}

.picker-input {
  background: #f8fafc;
  padding: 12rpx 14rpx;
  border-radius: 10rpx;
  color: #0f172a;
  font-size: 26rpx;
}

.picker-input.placeholder {
  color: #9ca3af;
}

.maintain-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12rpx;
  margin-top: 12rpx;
}

.maintain-list-head,
.maintain-list-row {
  display: grid;
  grid-template-columns: 150rpx 140rpx 180rpx 120rpx 100rpx 140rpx 140rpx 120rpx 140rpx 120rpx;
  column-gap: 8rpx;
  row-gap: 6rpx;
  align-items: center;
}

.maintain-list-head {
  font-weight: 700;
  color: #4b5563;
  margin: 12rpx 0;
}

.maintain-list-row {
  padding: 10rpx 0;
  border-bottom: 1px solid #f1f5f9;
  color: #111827;
}

.cell {
  font-size: 24rpx;
  word-break: break-all;
}

.cell.op {
  text-align: right;
}

.list-empty {
  padding: 24rpx 0;
  text-align: center;
  color: #9ca3af;
  font-size: 26rpx;
}

.maintain-footer {
  display: flex;
  justify-content: flex-end;
  gap: 16rpx;
  margin-top: 16rpx;
}

.plate-tag.large {
  padding: 10rpx 22rpx;
}

.btn-primary {
  background: linear-gradient(90deg, #0ea5e9, #2563eb);
  color: #fff;
  border: none;
  border-radius: 12rpx;
  padding: 14rpx 24rpx;
  font-size: 26rpx;
}

.btn-soft {
  background: #f3f4f6;
  color: #374151;
  border-radius: 12rpx;
  padding: 12rpx 22rpx;
  font-size: 26rpx;
  border: none;
}

.action-link {
  color: #2563eb;
}

.action-link.danger {
  color: #ef4444;
}
</style>
