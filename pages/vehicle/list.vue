<template>
  <view class="vehicle-page">
    <view class="vehicle-inner">
      <BackToDashboardBar back-to="/pages/dashboard/index" text="返回工作台" />

      <view class="page-header">
        <view class="page-header-left">
          <view class="page-icon">
            <text class="page-icon-text">车</text>
          </view>
          <view class="page-header-text">
            <text class="page-title">车辆管理</text>
            <text class="page-sub">仅承担列表/搜索与入口，单车维护移至详情页</text>
          </view>
        </view>
        <view class="page-header-right" v-if="isAdmin">
          <button class="btn-primary" @click="openEdit(null)">+ 新增车辆</button>
        </view>
      </view>

      <view class="card">
        <view class="card-body">
          <view class="filter-row">
            <view class="filter-item">
              <view class="input-wrapper">
                <input
                  class="input"
                  v-model="keyword"
                  placeholder="按车牌号 / 车辆名称搜索"
                  confirm-type="search"
                  @confirm="loadList"
                />
              </view>
            </view>
            <view class="filter-item filter-btn">
              <button class="btn-soft" @click="loadList">搜索</button>
            </view>
          </view>
        </view>
      </view>

      <view class="card summary-card">
        <view class="card-body summary-body">
          <view class="filter-row">
            <view class="filter-item">
              <view class="label">开始时间</view>
              <picker mode="date" :value="startDate" @change="(e) => onDateChange('startDate', e)">
                <view class="input-wrapper picker-wrapper">
                  <text class="picker-text">{{ startDate || '不限' }}</text>
                </view>
              </picker>
            </view>
            <view class="filter-item">
              <view class="label">结束时间</view>
              <picker mode="date" :value="endDate" @change="(e) => onDateChange('endDate', e)">
                <view class="input-wrapper picker-wrapper">
                  <text class="picker-text">{{ endDate || '不限' }}</text>
                </view>
              </picker>
            </view>
            <view class="filter-item filter-btn">
              <button class="btn-soft" @click="resetDateFilter">清空筛选</button>
            </view>
            <view class="filter-item filter-btn">
              <button class="btn-primary" @click="exportMaintain" :disabled="exporting">
                {{ exporting ? '导出中…' : '导出保养/加油记录' }}
              </button>
            </view>
          </view>

          <view class="summary-grid">
            <view class="summary-item">
              <text class="summary-label">筛选范围金额</text>
              <text class="summary-value">￥{{ summaryAmount }}</text>
              <text class="summary-sub">共 {{ summaryCount }} 条记录</text>
            </view>
            <view class="summary-item">
              <text class="summary-label">保险续期</text>
              <view class="summary-inline">
                <text>{{ insuranceInfo.text }}</text>
                <text v-if="insuranceInfo.badge" :class="['due-tag', insuranceInfo.badge.type]">{{ insuranceInfo.badge.text }}</text>
              </view>
              <view v-if="insuranceInfo.items.length" class="due-list">
                <text v-for="item in insuranceInfo.items" :key="`${item.plate_no}-${item.date}`" class="due-chip">
                  {{ item.plate_no }} · {{ item.date }}
                </text>
              </view>
            </view>
            <view class="summary-item">
              <text class="summary-label">年检时间</text>
              <view class="summary-inline">
                <text>{{ inspectionInfo.text }}</text>
                <text v-if="inspectionInfo.badge" :class="['due-tag', inspectionInfo.badge.type]">{{ inspectionInfo.badge.text }}</text>
              </view>
              <view v-if="inspectionInfo.items.length" class="due-list">
                <text v-for="item in inspectionInfo.items" :key="`${item.plate_no}-${item.date}`" class="due-chip">
                  {{ item.plate_no }} · {{ item.date }}
                </text>
              </view>
            </view>
          </view>
        </view>
      </view>

      <view class="card">
        <view class="card-header">
          <text class="card-title">车辆列表</text>
          <text class="card-sub">共 {{ total }} 辆</text>
        </view>

        <view class="card-body">
          <view v-if="loading" class="list-empty">
            <text class="empty-text">加载中…</text>
          </view>

          <view v-else-if="vehicles.length === 0" class="list-empty">
            <text class="empty-text" v-if="isAdmin">暂无车辆数据，可以点击右上角「新增车辆」</text>
            <text class="empty-text" v-else>暂无车辆数据，当前账号仅能查看车辆信息，如需维护车辆，请联系管理员</text>
          </view>

          <view v-else class="vehicle-list">
            <view v-for="item in renderVehicles" :key="item._id" class="vehicle-item">
              <view class="vehicle-main" @click="goDetail(item)">
                <view class="plate-tag">
                  <text class="plate-text">{{ item.plate_no || '未填车牌' }}</text>
                </view>
                <view class="vehicle-info">
                  <view class="vehicle-name-row">
                    <text class="vehicle-name">{{ item.name || '未命名车辆' }}</text>
                  </view>
                  <view class="vehicle-sub-row">
                    <text class="vehicle-sub">{{ item.remark || '暂无备注' }}</text>
                  </view>
                  <view class="maintain-meta" v-if="(item.filtered_maintain_logs || item.maintain_logs || []).length">
                    <text class="maintain-count">加油/保养/维修 {{ getMaintainCount(item) }} 次</text>
                    <text class="maintain-total">累计金额 ￥{{ getMaintainAmount(item) }}</text>
                  </view>
                </view>
              </view>

              <view class="vehicle-actions" v-if="isAdmin">
                <text class="action-link" @click.stop="goDetail(item)">详情</text>
                <text class="action-link danger" @click.stop="confirmRemove(item)">删除</text>
              </view>
            </view>
          </view>
        </view>
      </view>

      <view v-if="showEdit" class="edit-mask">
        <view class="edit-dialog">
          <view class="edit-header">
            <text class="edit-title">{{ form._id ? '编辑车辆' : '新增车辆' }}</text>
          </view>

          <view class="edit-body">
            <view class="form-item">
              <text class="label">* 车牌号</text>
              <view class="input-wrapper">
                <input
                  class="input"
                  :value="form.plate_no"
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
                <input class="input" v-model.trim="form.name" placeholder="例如 蓝牌轻卡 / 厢式货车" />
              </view>
            </view>

            <view class="form-item">
              <text class="label">保险续期时间</text>
              <picker mode="date" :value="form.insurance_due_date" @change="(e) => onDatePick('insurance_due_date', e)">
                <view class="input-wrapper picker-wrapper">
                  <text class="picker-text">{{ form.insurance_due_date || '请选择日期（可选）' }}</text>
                </view>
              </picker>
            </view>

            <view class="form-item">
              <text class="label">年检时间</text>
              <picker mode="date" :value="form.inspection_due_date" @change="(e) => onDatePick('inspection_due_date', e)">
                <view class="input-wrapper picker-wrapper">
                  <text class="picker-text">{{ form.inspection_due_date || '请选择日期（可选）' }}</text>
                </view>
              </picker>
            </view>

            <view class="form-item">
              <text class="label">备注</text>
              <textarea class="textarea" v-model.trim="form.remark" placeholder="可记录车辆吨位、使用范围等信息" />
            </view>
          </view>

          <view class="edit-footer">
            <button class="btn-soft" @click="closeEdit" :disabled="saving">取消</button>
            <button class="btn-primary" @click="submitEdit" :disabled="saving">
              {{ saving ? '保存中…' : '保存' }}
            </button>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import BackToDashboardBar from '@/components/BackToDashboardBar.vue'
import { getUserInfo, ensureLogin, isAdminRole } from '@/common/auth.js'
import { callCloud } from '@/common/request.js'
import { cleanPlateInput, normalizePlate } from '@/common/plate.js'

export default {
  components: { BackToDashboardBar },
  data() {
    return {
      userInfo: {},
      keyword: '',
      loading: false,
      vehicles: [],
      renderVehicles: [],
      total: 0,
      startDate: '',
      endDate: '',
      exporting: false,
      summaryAmount: '0.00',
      summaryCount: 0,
      insuranceInfo: { text: '未设置', badge: null, items: [] },
      inspectionInfo: { text: '未设置', badge: null, items: [] },
      showEdit: false,
      saving: false,
      form: {
        _id: '',
        plate_no: '',
        name: '',
        insurance_due_date: '',
        inspection_due_date: '',
        remark: ''
      }
    }
  },
  computed: {
    isAdmin() {
      return isAdminRole(this.userInfo)
    }
  },
  onLoad() {
    if (!ensureLogin()) return
    this.userInfo = getUserInfo() || {}
    this.loadList()
  },
  methods: {
    async loadList() {
      this.loading = true
      const result = await callCloud('crm-vehicle', {
        action: 'list',
        data: {
          keyword: this.keyword,
          page: 1,
          pageSize: 200
        }
      })
      this.loading = false
      if (result.code !== 0) {
        this.vehicles = []
        this.renderVehicles = []
        return
      }
      const list = Array.isArray(result.data || result.list) ? result.data || result.list : []
      this.vehicles = list
      this.total = result.total || this.vehicles.length
      this.refreshDerived()
    },
    goDetail(item) {
      if (!item || !item._id) return
      uni.navigateTo({ url: `/pages/vehicle/detail?id=${item._id}` })
    },
    openEdit(item) {
      if (!this.isAdmin) {
        return uni.showToast({ title: '当前账号无权限编辑车辆', icon: 'none' })
      }
      if (item) {
        this.form = {
          _id: item._id,
          plate_no: item.plate_no || '',
          name: item.name || '',
          insurance_due_date: item.insurance_due_date || '',
          inspection_due_date: item.inspection_due_date || '',
          remark: item.remark || ''
        }
      } else {
        this.form = {
          _id: '',
          plate_no: '',
          name: '',
          insurance_due_date: '',
          inspection_due_date: '',
          remark: ''
        }
      }
      this.showEdit = true
    },
    onPlateInput(e) {
      this.form.plate_no = cleanPlateInput(e.detail && e.detail.value)
    },
    closeEdit() {
      if (this.saving) return
      this.showEdit = false
    },
    getMaintainCount(item) {
      if (item && typeof item.filtered_maintain_times === 'number') return item.filtered_maintain_times
      if (item && typeof item.maintain_times === 'number') return item.maintain_times
      const list = (item && (item.filtered_maintain_logs || item.maintain_logs)) || []
      return list.length
    },
    getMaintainAmount(item) {
      if (item && typeof item.filtered_maintain_amount === 'number') {
        return Number(item.filtered_maintain_amount).toFixed(2)
      }
      if (item && typeof item.maintain_total_amount === 'number') {
        return Number(item.maintain_total_amount).toFixed(2)
      }
      const list = (item && (item.filtered_maintain_logs || item.maintain_logs)) || []
      const total = list.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
      return total.toFixed(2)
    },
    onDateChange(field, e) {
      const val = (e && e.detail && e.detail.value) || ''
      this[field] = val
      this.refreshDerived()
    },
    resetDateFilter() {
      this.startDate = ''
      this.endDate = ''
      this.refreshDerived()
    },
    onDatePick(field, e) {
      const val = (e && e.detail && e.detail.value) || ''
      this.form[field] = val
    },
    refreshDerived() {
      const processed = []
      let amountSum = 0
      let countSum = 0
      const todayTs = this.dateToTimestamp(new Date())

      const sourceList = Array.isArray(this.vehicles) ? this.vehicles : []
      sourceList.forEach((item) => {
        const logs = Array.isArray(item.maintain_logs) ? item.maintain_logs : []
        const filteredLogs = this.filterLogsByDate(logs)
        const filteredAmount = filteredLogs.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
        amountSum += filteredAmount
        countSum += filteredLogs.length

        processed.push({
          ...item,
          filtered_maintain_logs: filteredLogs,
          filtered_maintain_amount: Number(filteredAmount.toFixed(2)),
          filtered_maintain_times: filteredLogs.length
        })
      })

      this.renderVehicles = processed
      this.summaryAmount = Number(amountSum.toFixed(2)).toFixed(2)
      this.summaryCount = countSum

      this.insuranceInfo = this.buildDueInfo(processed, 'insurance_due_date', todayTs)
      this.inspectionInfo = this.buildDueInfo(processed, 'inspection_due_date', todayTs)
    },
    filterLogsByDate(list) {
      if ((!this.startDate && !this.endDate) || !Array.isArray(list)) return list || []
      const startTs = this.startDate ? this.dateToTimestamp(this.startDate) : null
      const endTs = this.endDate ? this.dateToTimestamp(this.endDate) : null
      return list.filter((row) => {
        const ts = this.dateToTimestamp(row.date)
        if (!ts) return false
        if (startTs && ts < startTs) return false
        if (endTs && ts > endTs + 86399999) return false
        return true
      })
    },
    dateToTimestamp(val) {
      if (!val) return null
      if (val instanceof Date) {
        return new Date(`${val.getFullYear()}-${String(val.getMonth() + 1).padStart(2, '0')}-${String(val.getDate()).padStart(2, '0')}T00:00:00`).getTime()
      }
      const ts = new Date(`${val}T00:00:00`).getTime()
      return Number.isNaN(ts) ? null : ts
    },
    buildDueInfo(list, field, todayTs) {
      const parsed = (list || [])
        .map((item) => ({
          plate_no: item.plate_no || '未填车牌',
          date: item[field],
          ts: this.dateToTimestamp(item[field]) || null
        }))
        .filter((item) => item.date && item.ts)

      if (!parsed.length) return { text: '未设置', badge: null, items: [] }

      parsed.sort((a, b) => a.ts - b.ts)
      const soonList = parsed.filter((p) => p.ts >= todayTs && p.ts - todayTs <= 30 * 86400000)
      const displayList = soonList.length ? soonList : [parsed[0]]

      return {
        text: soonList.length ? `近30天共 ${soonList.length} 辆` : '最近到期',
        badge: this.buildDueBadge(displayList[0].date, todayTs),
        items: displayList.map((item) => ({ plate_no: item.plate_no, date: item.date }))
      }
    },
    buildDueBadge(dateText, todayTsInput) {
      const ts = this.dateToTimestamp(dateText)
      if (!ts) return null
      const todayTs = todayTsInput || this.dateToTimestamp(new Date())
      const diffDays = Math.floor((ts - todayTs) / 86400000)
      if (diffDays < 0) return { text: '已过期', type: 'danger' }
      if (diffDays <= 30) return { text: `剩余 ${diffDays} 天`, type: 'warning' }
      return { text: '已设置', type: 'info' }
    },
    async exportMaintain() {
      if (this.exporting) return
      const rows = [
        ['车牌号', '车辆名称', '日期', '项目', '配件/油品', '数量', '单价', '金额', '里程', '人员', '备注']
      ]

      this.renderVehicles.forEach((v) => {
        const logs = v.filtered_maintain_logs || []
        logs.forEach((log) => {
          rows.push([
            v.plate_no || '',
            v.name || '',
            log.date || '',
            log.project || '',
            log.part || '',
            log.quantity || '',
            log.unit_price || '',
            log.amount || '',
            log.mileage || '',
            log.staff || '',
            log.remark || ''
          ])
        })
      })

      if (rows.length === 1) {
        return uni.showToast({ title: '当前筛选暂无可导出的记录', icon: 'none' })
      }

      const csv = rows
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n')

      this.exporting = true
      try {
        // H5 直接下载
        if (typeof window !== 'undefined' && window.Blob) {
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = `车辆保养加油记录_${Date.now()}.csv`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          URL.revokeObjectURL(url)
          uni.showToast({ title: '已下载 CSV', icon: 'none' })
          return
        }

        // 小程序 / App 走文件系统
        if (uni.getFileSystemManager) {
          const fs = uni.getFileSystemManager()
          const userPath = typeof wx !== 'undefined' && wx.env && wx.env.USER_DATA_PATH
            ? wx.env.USER_DATA_PATH
            : (uni.env && uni.env.USER_DATA_PATH) || ''
          const filePath = `${userPath}/vehicle-maintain-${Date.now()}.csv`
          fs.writeFile({
            filePath,
            data: csv,
            encoding: 'utf8',
            success: () => {
              uni.showToast({ title: '文件已保存', icon: 'none' })
            },
            fail: () => {
              uni.setClipboardData({ data: csv })
              uni.showToast({ title: '已复制 CSV 内容', icon: 'none' })
            }
          })
          return
        }

        // 兜底复制
        uni.setClipboardData({ data: csv })
        uni.showToast({ title: '已复制 CSV 内容', icon: 'none' })
      } finally {
        this.exporting = false
      }
    },
    async submitEdit() {
      if (this.saving) return
      if (!this.isAdmin) {
        return uni.showToast({ title: '当前账号无权限保存车辆信息', icon: 'none' })
      }
      const plate = normalizePlate(this.form.plate_no)
      if (plate === '') {
        return uni.showToast({ title: '请填写车牌号', icon: 'none' })
      }
      if (plate === null) {
        return uni.showToast({ title: '车牌号格式不正确', icon: 'none' })
      }
      const payload = {
        plate_no: plate,
        name: (this.form.name || '').trim(),
        insurance_due_date: this.form.insurance_due_date || '',
        inspection_due_date: this.form.inspection_due_date || '',
        remark: (this.form.remark || '').trim()
      }
      const action = this.form._id ? 'update' : 'create'
      if (this.form._id) {
        payload.id = this.form._id
      }
      this.saving = true
      const result = await callCloud('crm-vehicle', { action, data: payload })
      this.saving = false
      if (result.code !== 0) return
      uni.showToast({ title: '保存成功', icon: 'success' })
      this.showEdit = false
      this.loadList()
    },
    confirmRemove(item) {
      if (!this.isAdmin) {
        return uni.showToast({ title: '当前账号无权限删除车辆', icon: 'none' })
      }
      uni.showModal({
        title: '删除车辆',
        content: `确定删除车辆【${item.plate_no || item.name || '未命名'}】吗？\n（仅删除车辆档案，历史销售记录中的车牌号不会被修改）`,
        success: async (res) => {
          if (!res.confirm) return
          const result = await callCloud('crm-vehicle', {
            action: 'remove',
            data: { id: item._id }
          })
          if (result.code !== 0) return
          uni.showToast({ title: '已删除', icon: 'success' })
          this.loadList()
        }
      })
    }
  }
}
</script>

<style scoped>
.vehicle-page {
  min-height: 100vh;
  background-color: #f2f4f9;
  padding: 24rpx 16rpx 40rpx;
  box-sizing: border-box;
}

.vehicle-inner {
  width: 100%;
  max-width: 1600rpx;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 16rpx 0 24rpx;
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
  font-size: 32rpx;
  font-weight: 700;
  color: #181c28;
}

.page-sub {
  margin-top: 4rpx;
  font-size: 24rpx;
  color: #6b7280;
}

.page-header-right button {
  min-width: 200rpx;
}

.card {
  background: #ffffff;
  border-radius: 20rpx;
  box-shadow: 0 12rpx 32rpx rgba(17, 24, 39, 0.05);
  margin-bottom: 18rpx;
}

.card-header {
  padding: 20rpx 24rpx 8rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #1f2937;
}

.card-sub {
  font-size: 24rpx;
  color: #6b7280;
}

.card-body {
  padding: 16rpx 24rpx 24rpx;
  box-sizing: border-box;
}

.filter-row {
  display: flex;
  column-gap: 12rpx;
}

.filter-item {
  flex: 1;
}

.filter-btn {
  flex: 0 0 auto;
}

.summary-card {
  margin-top: 8rpx;
}

.summary-body {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.picker-wrapper {
  display: flex;
  align-items: center;
}

.picker-text {
  font-size: 28rpx;
  color: #111827;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260rpx, 1fr));
  gap: 12rpx;
}

.summary-item {
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 14rpx;
  padding: 14rpx 16rpx;
  box-sizing: border-box;
}

.summary-label {
  display: block;
  font-size: 24rpx;
  color: #6b7280;
}

.summary-value {
  display: block;
  margin-top: 6rpx;
  font-size: 30rpx;
  font-weight: 700;
  color: #2563eb;
}

.summary-sub {
  display: block;
  margin-top: 4rpx;
  font-size: 24rpx;
  color: #9ca3af;
}

.summary-inline {
  margin-top: 6rpx;
  display: flex;
  align-items: center;
  gap: 8rpx;
  font-size: 26rpx;
  color: #111827;
}

.due-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-top: 8rpx;
}

.due-chip {
  padding: 6rpx 12rpx;
  background: #eef2ff;
  color: #4b5563;
  border-radius: 12rpx;
  font-size: 24rpx;
  border: 1rpx solid #e0e7ff;
}

.due-tag {
  padding: 6rpx 10rpx;
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

.input-wrapper {
  background: #f8fafc;
  border-radius: 14rpx;
  padding: 14rpx 18rpx;
  border: 1px solid #e5e7eb;
}

.input {
  width: 100%;
  font-size: 28rpx;
  color: #111827;
}

.vehicle-list {
  display: flex;
  flex-direction: column;
  row-gap: 14rpx;
}

.vehicle-item {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  padding: 18rpx;
  border: 1px solid #e5e7eb;
  border-radius: 16rpx;
  background: #f8fafc;
}

.vehicle-item:active {
  background: #eef2ff;
}

.vehicle-main {
  display: flex;
  column-gap: 14rpx;
  flex: 1;
}

.plate-tag {
  min-width: 120rpx;
  height: 70rpx;
  border-radius: 14rpx;
  background: linear-gradient(135deg, #4f8efc, #74b2ff);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 12rpx;
  box-sizing: border-box;
}

.plate-text {
  color: #ffffff;
  font-size: 28rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
}

.vehicle-info {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.vehicle-name {
  font-size: 30rpx;
  font-weight: 700;
  color: #0f172a;
}

.vehicle-sub {
  font-size: 24rpx;
  color: #6b7280;
}

.maintain-meta {
  margin-top: 6rpx;
  display: flex;
  column-gap: 12rpx;
}

.maintain-count {
  font-size: 24rpx;
  color: #2563eb;
}

.maintain-total {
  font-size: 24rpx;
  color: #f59e0b;
}

.vehicle-actions {
  display: flex;
  align-items: center;
  column-gap: 12rpx;
  padding-left: 12rpx;
}

.action-link {
  font-size: 24rpx;
  color: #2563eb;
}

.action-link.danger {
  color: #dc2626;
}

.list-empty {
  padding: 24rpx 8rpx;
  text-align: center;
}

.empty-text {
  font-size: 24rpx;
  color: #9ca3af;
}

.btn-soft,
.btn-primary {
  min-width: 160rpx;
  padding: 12rpx 20rpx;
  border-radius: 999rpx;
  font-size: 26rpx;
}

.btn-soft {
  background: rgba(244, 247, 255, 0.9);
  color: #4d5cff;
  border: 1rpx solid rgba(212, 220, 255, 0.9);
}

.btn-primary {
  background: linear-gradient(135deg, #4d5cff, #6366f1);
  color: #fff;
  border: none;
}

.edit-mask {
  position: fixed;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  background: rgba(15, 23, 42, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.edit-dialog {
  width: 90%;
  max-width: 640rpx;
  background: #ffffff;
  border-radius: 24rpx;
  box-shadow: 0 18rpx 46rpx rgba(15, 23, 42, 0.4);
  padding: 24rpx 26rpx 18rpx;
  box-sizing: border-box;
}

.edit-header {
  margin-bottom: 10rpx;
}

.edit-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #111827;
}

.edit-body {
  margin-top: 6rpx;
}

.form-item {
  margin-bottom: 18rpx;
}

.label {
  display: block;
  font-size: 26rpx;
  margin-bottom: 6rpx;
  color: #555;
}

.textarea {
  width: 100%;
  min-height: 120rpx;
  font-size: 28rpx;
  color: #111827;
}

.helper {
  display: block;
  margin-top: 4rpx;
  font-size: 22rpx;
  color: #9ca3af;
}

.edit-footer {
  margin-top: 10rpx;
  display: flex;
  justify-content: flex-end;
  column-gap: 12rpx;
}
</style>
