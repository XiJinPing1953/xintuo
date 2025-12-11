<template>
  <view class="page">
    <view class="inner">
      <BackToDashboardBar />

      <!-- 顶部标题 -->
      <view class="page-header">
        <view class="page-header-left">
          <view class="page-icon">
            <text class="page-icon-text">销</text>
          </view>
          <view class="page-header-text">
            <text class="page-title">销售记录列表</text>
            <text class="page-sub">
              按日期和客户查询销售记录，支持查看详情与对账
            </text>
          </view>
        </view>
      </view>

      <!-- 筛选卡片 -->
      <view class="card card-filter">
        <view class="card-header">
          <text class="card-title">筛选条件</text>
        </view>
        <view class="card-body">
          <!-- 一行 4 列 -->
          <view class="form-row">
            <!-- 客户（模糊输入联想） -->
            <view class="form-item col-quarter">
              <text class="label">客户</text>

              <view class="input-wrapper">
                <input
                  class="input"
                  type="text"
                  v-model="customerKeyword"
                  placeholder="输入客户名（支持模糊搜索）"
                  @input="onCustomerInput"
                />
              </view>

              <!-- 联想结果 -->
              <view v-if="customerSuggests.length" class="suggest-panel">
                <view
                  v-for="c in customerSuggests"
                  :key="c._id"
                  class="suggest-item"
                  @tap="onSelectCustomer(c)"
                >
                  {{ c.name }}
                </view>
              </view>
            </view>

            <!-- 起始日期 -->
            <view class="form-item col-quarter">
              <text class="label">起始日期</text>
              <picker
                mode="date"
                :value="filters.dateFrom"
                @change="onDateFromChange"
              >
                <view class="input-wrapper">
                  <view class="picker">
                    <text>{{ filters.dateFrom || '请选择起始日期' }}</text>
                  </view>
                </view>
              </picker>
            </view>

            <!-- 截止日期 -->
            <view class="form-item col-quarter">
              <text class="label">截止日期</text>
              <picker
                mode="date"
                :value="filters.dateTo"
                @change="onDateToChange"
              >
                <view class="input-wrapper">
                  <view class="picker">
                    <text>{{ filters.dateTo || '请选择截止日期' }}</text>
                  </view>
                </view>
              </picker>
            </view>

            <!-- 收款状态 -->
            <view class="form-item col-quarter">
              <text class="label">收款状态</text>
              <picker
                mode="selector"
                :range="paymentStatusOptions"
                :value="paymentStatusIndex"
                @change="onPaymentStatusFilterChange"
              >
                <view class="input-wrapper">
                  <view class="picker">
                    <text>{{ paymentStatusFilterLabel }}</text>
                  </view>
                </view>
              </picker>
            </view>
          </view>

          <view class="btn-row-inline">
            <button class="btn-soft" @click="resetFilter">重置</button>
            <button class="btn-primary" @click="onSearch">查询</button>
          </view>
        </view>
      </view>

      <!-- 汇总卡片 -->
      <view class="card card-summary" v-if="records.length">
        <view class="summary-row">
          <view class="summary-item">
            <text class="summary-label">应收合计</text>
            <view class="summary-value-row">
              <text class="summary-value">{{ stats.totalShould | money }}</text>
              <text class="summary-unit">元</text>
            </view>
          </view>

          <view class="summary-item">
            <!-- ⭐ 同一天时文案变为“今日销售额” -->
            <text class="summary-label">
              {{ isSingleDay ? '今日销售额' : '实收合计' }}
            </text>
            <view class="summary-value-row">
              <text class="summary-value">{{ stats.totalReceived | money }}</text>
              <text class="summary-unit">元</text>
            </view>
          </view>

          <view class="summary-item">
            <text class="summary-label">未收合计</text>
            <view class="summary-value-row">
              <text
                class="summary-value"
                :class="stats.totalUnpaid > 0 ? 'text-danger' : 'text-normal'"
              >
                {{ stats.totalUnpaid | money }}
              </text>
              <text class="summary-unit">元</text>
            </view>
          </view>

          <!-- ⭐ 新增：今日出气量 / 出气量合计 -->
          <view class="summary-item">
            <text class="summary-label">
              {{ isSingleDay ? '今日出气量' : '出气量合计' }}
            </text>
            <view class="summary-value-row">
              <text class="summary-value">
                {{ stats.totalWeightKg | weight }}
              </text>
              <text class="summary-unit">kg</text>
            </view>
          </view>

          <view class="summary-item">
            <text class="summary-label">记录条数</text>
            <view class="summary-value-row">
              <text class="summary-value">{{ total }}</text>
              <text class="summary-unit">条</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 表格列表卡片 -->
      <view class="card card-list">
        <view class="card-header card-header-with-action">
          <view class="card-header-left">
            <text class="card-title">销售记录列表</text>
            <text class="card-sub">
              点击任意行可查看明细，包含多瓶记录、存瓶与结算信息
            </text>
          </view>

          <!-- 导出按钮 -->
          <view class="card-header-right">
            <button
              class="btn-soft btn-export"
              :disabled="exporting || !total"
              @click="onExport"
            >
              <text v-if="!exporting">导出当前筛选范围</text>
              <text v-else>导出中…</text>
            </button>
          </view>
        </view>

        <!-- loading -->
        <view v-if="loading" class="list-loading">
          <text class="loading-text">加载中…</text>
        </view>

        <!-- 空状态 -->
        <view v-else-if="!records.length" class="empty">
          <text class="empty-main">暂无符合条件的销售记录</text>
          <text class="empty-sub">请调整客户或日期范围后重试</text>
        </view>

        <!-- 列表 -->
        <view v-else class="list-wrapper">
          <view class="sale-table">
            <!-- 表头 -->
            <view class="sale-row sale-row-header">
              <view class="sale-col col-date">
                <text class="header-text">日期</text>
              </view>
              <view class="sale-col col-customer">
                <text class="header-text">客户</text>
              </view>
              <view class="sale-col col-bottle">
                <text class="header-text">出瓶</text>
              </view>
              <view class="sale-col col-bottle">
                <text class="header-text">回瓶</text>
              </view>
              <view class="sale-col col-bottle">
                <text class="header-text">存瓶</text>
              </view>
              <view class="sale-col col-amount">
                <text class="header-text">应收</text>
              </view>
              <view class="sale-col col-amount">
                <text class="header-text">实收</text>
              </view>
              <view class="sale-col col-amount">
                <text class="header-text">未收</text>
              </view>
              <view class="sale-col col-status">
                <text class="header-text">收款状态</text>
              </view>
            </view>

            <!-- 数据行 -->
            <view
              v-for="item in records"
              :key="item._id"
              class="sale-row sale-row-body"
              :class="{
                'row-unpaid': item.unpaid > 0,
                'row-partial':
                  item.unpaid > 0 &&
                  Number(item.display_received || item.amount_received || 0) > 0
              }"
              @click="goDetail(item)"
            >
              <!-- 日期 -->
              <view class="sale-col col-date">
                <text class="cell-main">{{ item.date || '-' }}</text>
              </view>

              <!-- 客户 + 模式/计价方式 -->
              <view class="sale-col col-customer">
                <text class="cell-main">
                  {{ item.customer_name || '未知客户' }}
                </text>
                <text class="cell-sub">
                  {{ formatBizMode(item.biz_mode) }} ·
                  {{ formatPriceUnit(item.price_unit) }}
                </text>
              </view>

              <!-- 出瓶 -->
              <view class="sale-col col-bottle">
                <text class="cell-label">出：</text>
                <text class="cell-main">
                  {{ displayBottleNos(item, 'out') }}
                </text>
              </view>

              <!-- 回瓶 -->
              <view class="sale-col col-bottle">
                <text class="cell-label">回：</text>
                <text class="cell-main">
                  {{ displayBottleNos(item, 'back') }}
                </text>
              </view>

              <!-- 存瓶 -->
              <view class="sale-col col-bottle">
                <text class="cell-label">存：</text>
                <text class="cell-main">
                  {{ displayBottleNos(item, 'deposit') }}
                </text>
              </view>

              <!-- 应收 -->
              <view class="sale-col col-amount">
                <view class="amount-block">
                  <text class="cell-main amount-main">
                    {{
                      (item.display_should != null
                        ? item.display_should
                        : item.amount) | money
                    }}
                  </text>
                </view>
              </view>

              <!-- 实收 -->
              <view class="sale-col col-amount">
                <view class="amount-block">
                  <text class="cell-main amount-main">
                    {{
                      (item.display_received != null
                        ? item.display_received
                        : item.amount_received) | money
                    }}
                  </text>
                </view>
              </view>

              <!-- 未收 -->
              <view class="sale-col col-amount">
                <view class="amount-block">
                  <text
                    class="cell-main amount-main"
                    :class="item.unpaid > 0 ? 'text-danger' : 'text-normal'"
                  >
                    {{ item.unpaid | money }}
                  </text>
                </view>
              </view>

              <!-- 收款状态 -->
              <view class="sale-col col-status">
                <view
                  class="status-pill"
                  :class="{
                    paid:
                      item.unpaid <= 0 &&
                      Number(
                        (item.display_should != null
                          ? item.display_should
                          : item.amount) || 0
                      ) > 0,
                    unpaid:
                      item.unpaid > 0 &&
                      Number(
                        (item.display_received != null
                          ? item.display_received
                          : item.amount_received) || 0
                      ) === 0,
                    partial:
                      item.unpaid > 0 &&
                      Number(
                        (item.display_received != null
                          ? item.display_received
                          : item.amount_received) || 0
                      ) > 0
                  }"
                >
                  {{
                    item.payment_status ||
                      (item.unpaid > 0
                        ? (Number(
                            (item.display_received != null
                              ? item.display_received
                              : item.amount_received) || 0
                          ) > 0
                            ? '部分已付'
                            : '挂账')
                        : '已付')
                  }}
                </view>
              </view>
            </view>
          </view>

          <!-- 分页 -->
          <view class="pagination">
            <button
              class="btn-soft btn-mini"
              :disabled="page <= 1"
              @click="changePage(-1)"
            >
              上一页
            </button>
            <text class="page-info">
              第 {{ page }} / {{ pageCount || 1 }} 页
            </text>
            <button
              class="btn-soft btn-mini"
              :disabled="page >= pageCount"
              @click="changePage(1)"
            >
              下一页
            </button>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>
<script>
import BackToDashboardBar from '@/components/BackToDashboardBar.vue'
import { ensureLogin, getToken } from '@/common/auth.js'

export default {
  components: {
    BackToDashboardBar
  },
  data() {
    return {
      loading: false,

      // 筛选
      filters: {
        customerId: '',
        customerName: '',
        dateFrom: '',
        dateTo: ''
      },

      // 客户列表
      customers: [],
      customerIndex: -1,
      customerKeyword: '',
      customerSuggests: [],

      // 收款状态筛选
      paymentStatusOptions: ['全部', '已付', '挂账', '部分已付', '冲减'],
      paymentStatusIndex: 0,

      // 列表
      records: [],
      page: 1,
      pageSize: 10,
      total: 0,

      // 导出
      exporting: false
    }
  },

  filters: {
    money(v) {
      const n = Number(v)
      if (isNaN(n)) return '0.00'
      return n.toFixed(2)
    },
    weight(v) {
      const n = Number(v)
      if (isNaN(n)) return '0'
      return n.toFixed(0)
    }
  },

  computed: {
    customerLabel() {
      if (this.customerIndex < 0) return '全部客户'
      const c = this.customers[this.customerIndex]
      return c ? c.name : '全部客户'
    },
    paymentStatusFilterLabel() {
      return this.paymentStatusOptions[this.paymentStatusIndex] || '全部'
    },
    pageCount() {
      if (!this.total || !this.pageSize) return 0
      return Math.ceil(this.total / this.pageSize)
    },
    isSingleDay() {
      const from = this.filters.dateFrom
      const to = this.filters.dateTo
      if (!from || !to) return false
      return from === to
    },
    stats() {
      let totalShould = 0
      let totalReceived = 0
      let totalUnpaid = 0
      let totalWeightKg = 0

      this.records.forEach((r) => {
        // 金额
        const a =
          r.display_should != null
            ? Number(r.display_should) || 0
            : Number(r.amount) || 0
        const ar =
          r.display_received != null
            ? Number(r.display_received) || 0
            : Number(r.amount_received) || 0
        const wOff = Number(r.write_off || 0)

        totalShould += a
        totalReceived += ar
        totalUnpaid += Math.max(a - ar - wOff, 0)

        // 出气量（kg）
        let wKg =
          r.total_net_weight != null
            ? Number(r.total_net_weight) || 0
            : r.net_weight != null
            ? Number(r.net_weight) || 0
            : r.weight_kg != null
            ? Number(r.weight_kg) || 0
            : 0

        if (!Number.isFinite(wKg)) wKg = 0
        totalWeightKg += wKg
      })

      return {
        totalShould,
        totalReceived,
        totalUnpaid,
        totalWeightKg
      }
    }
  },

  onLoad(options) {
    console.log('[sale/list] onLoad')

    if (!ensureLogin()) return

    const today = new Date()
    const end = this.formatDate(today)
    const startDate = new Date(today.getTime() - 6 * 24 * 3600 * 1000)
    const start = this.formatDate(startDate)

    this.filters.dateFrom = options.date_from || start
    this.filters.dateTo = options.date_to || end

    if (options.customer_id) {
      this.filters.customerId = options.customer_id
    }
    if (options.customer_name) {
      this.filters.customerName = decodeURIComponent(options.customer_name)
    }

    this.loadCustomers()
    this.fetchList(true)
  },

  onShow() {
    ensureLogin()
  },

  methods: {
    formatDate(d) {
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      return `${yyyy}-${mm}-${dd}`
    },

    onCustomerInput(e) {
      const kw = e.detail.value.trim()
      this.customerKeyword = kw

      if (!kw) {
        this.customerSuggests = []
        this.filters.customerId = ''
        this.filters.customerName = ''
        return
      }

      this.customerSuggests = this.customers
        .filter((c) => c && c.name && c.name.includes(kw))
        .slice(0, 20)
    },

    onSelectCustomer(item) {
      this.customerKeyword = item.name
      this.filters.customerId = item._id
      this.filters.customerName = item.name
      this.customerSuggests = []
    },

    /* ============================
     *     ① loadCustomers（含 401）
     * ============================ */
    async loadCustomers() {
      try {
        const token = getToken()
        if (!token) return

        const res = await uniCloud.callFunction({
          name: 'crm-customer',
          data: {
            action: 'list',
            token,
            data: {}
          }
        })

        const result = res.result || {}

        // ⭐ 补 401：强制跳登录
        if (result.code === 401) {
          uni.showModal({
            title: '提示',
            content: result.msg || '登录已过期，请重新登录',
            showCancel: false,
            success: () => {
              uni.clearStorageSync()
              uni.reLaunch({ url: '/pages/login/login' })
            }
          })
          return
        }

        if (result.code === 0) {
          this.customers = result.data || []

          if (this.filters.customerId) {
            const idx = this.customers.findIndex(
              (c) => c._id === this.filters.customerId
            )
            if (idx >= 0) this.customerIndex = idx
          } else if (this.filters.customerName) {
            const idx = this.customers.findIndex(
              (c) => c.name === this.filters.customerName
            )
            if (idx >= 0) {
              this.customerIndex = idx
              this.filters.customerId = this.customers[idx]._id
            }
          }
        }
      } catch (e) {
        console.error('loadCustomers error', e)
      }
    },

    onCustomerChange(e) {
      const idx = Number(e.detail.value)
      this.customerIndex = idx
      const c = this.customers[idx]
      if (c) {
        this.filters.customerId = c._id
        this.filters.customerName = c.name
      } else {
        this.filters.customerId = ''
        this.filters.customerName = ''
      }
    },

    onDateFromChange(e) {
      this.filters.dateFrom = e.detail.value
    },

    onDateToChange(e) {
      this.filters.dateTo = e.detail.value
    },

    onPaymentStatusFilterChange(e) {
      this.paymentStatusIndex = Number(e.detail.value)
    },

    resetFilter() {
      this.customerKeyword = ''
      this.customerSuggests = []
      this.customerIndex = -1
      this.filters.customerId = ''
      this.filters.customerName = ''

      const today = new Date()
      const end = this.formatDate(today)
      const startDate = new Date(today.getTime() - 6 * 24 * 3600 * 1000)
      const start = this.formatDate(startDate)

      this.filters.dateFrom = start
      this.filters.dateTo = end

      this.paymentStatusIndex = 0
      this.page = 1
      this.fetchList(true)
    },

    onSearch() {
      this.page = 1
      this.fetchList(true)
    },

    /* ===================================
     *       ② fetchList（含 401）
     * =================================== */
    async fetchList(resetPage = false) {
      if (resetPage) this.page = 1

      const token = getToken()
      if (!token) {
        ensureLogin()
        return
      }

      this.loading = true
      try {
        const res = await uniCloud.callFunction({
          name: 'crm-sale',
          data: {
            action: 'list',
            token,
            data: {
              customer_id: this.filters.customerId || undefined,
              customer_name: this.filters.customerName || undefined,
              date_from: this.filters.dateFrom || undefined,
              date_to: this.filters.dateTo || undefined,
              page: this.page,
              pageSize: this.pageSize
            }
          }
        })

        const result = res.result || {}

        // ⭐ 补 401
        if (result.code === 401) {
          uni.showModal({
            title: '提示',
            content: result.msg || '登录已过期，请重新登录',
            showCancel: false,
            success: () => {
              uni.clearStorageSync()
              uni.reLaunch({ url: '/pages/login/login' })
            }
          })
          return
        }

        if (result.code !== 0) {
          uni.showToast({
            title: result.msg || '加载失败',
            icon: 'none'
          })
          return
        }

        const list = result.data || []
        this.total = result.total || 0

        this.records = list.map((doc) => {
          const priceUnit = doc.price_unit || 'kg'

          let should = 0
          if (priceUnit === 'm3') {
            if (doc.flow_amount_should != null && doc.flow_amount_should !== '') {
              should = Number(doc.flow_amount_should) || 0
            } else {
              should = Number(doc.amount) || 0
            }
          } else {
            should = Number(doc.amount) || 0
          }

          let received = 0
          if (priceUnit === 'm3') {
            if (doc.flow_amount_received != null && doc.flow_amount_received !== '') {
              received = Number(doc.flow_amount_received) || 0
            } else {
              received = Number(doc.amount_received) || 0
            }
          } else {
            received = Number(doc.amount_received) || 0
          }

          const w = Number(doc.write_off || 0)
          const unpaid = Math.max(should - received - w, 0)

          return {
            ...doc,
            display_should: should,
            display_received: received,
            unpaid
          }
        })
      } catch (e) {
        console.error('fetchList error', e)
        uni.showToast({
          title: '请求出错',
          icon: 'none'
        })
      } finally {
        this.loading = false
      }
    },

    changePage(delta) {
      const newPage = this.page + delta
      if (newPage < 1) return
      if (this.pageCount && newPage > this.pageCount) return
      this.page = newPage
      this.fetchList()
    },

    displayBottleNos(item, type) {
      const trim = (s) => String(s || '').trim()
      let list = []

      if (type === 'out') {
        if (Array.isArray(item.out_items) && item.out_items.length) {
          list = item.out_items.map((r) => trim(r.bottle_no)).filter(Boolean)
        } else if (item.bottle_no) {
          list = [trim(item.bottle_no)]
        }
      } else if (type === 'back') {
        if (Array.isArray(item.back_items) && item.back_items.length) {
          list = item.back_items.map((r) => trim(r.bottle_no)).filter(Boolean)
        } else if (item.return_bottle_no) {
          list = [trim(item.return_bottle_no)]
        }
      } else if (type === 'deposit') {
        if (Array.isArray(item.deposit_items) && item.deposit_items.length) {
          list = item.deposit_items.map((r) => trim(r.bottle_no)).filter(Boolean)
        } else if (item.deposit_bottles_raw) {
          list = item.deposit_bottles_raw
            .split(/[\/、,，\s]+/)
            .map((s) => trim(s))
            .filter(Boolean)
        }
      }

      if (!list.length) return '—'
      if (list.length > 2) {
        return list.slice(0, 2).join(' / ') + ' / …'
      }
      return list.join(' / ')
    },

    formatPriceUnit(u) {
      const v = u || 'kg'
      if (v === 'kg') return '元/kg'
      if (v === 'bottle') return '元/瓶'
      if (v === 'm3') return '元/m³'
      return v
    },

    formatBizMode(mode) {
      const m = mode || 'bottle'
      if (m === 'truck') return '整车'
      if (m === 'bottle') return '瓶装'
      return m
    },

    goDetail(item) {
      if (!item || !item._id) return
      uni.navigateTo({
        url: `/pages/sale/detail?id=${item._id}`
      })
    },

    /* ===================================
     *        ③ onExport（含 401）
     * =================================== */
    async onExport() {
      if (!this.total) {
        uni.showToast({
          title: '没有可导出的数据',
          icon: 'none'
        })
        return
      }

      this.exporting = true
      try {
        const token = getToken()
        const res = await uniCloud.callFunction({
          name: 'crm-bill',
          data: {
            action: 'exportSaleListExcel',
            token,
            data: {
              customer_id: this.filters.customerId || '',
              customer_name: this.filters.customerName || '',
              date_from: this.filters.dateFrom,
              date_to: this.filters.dateTo,
              includeFlow: true
            }
          }
        })

        const result = res.result || {}

        // ⭐ 补 401
        if (result.code === 401) {
          uni.showModal({
            title: '提示',
            content: result.msg || '登录已过期，请重新登录',
            showCancel: false,
            success: () => {
              uni.clearStorageSync()
              uni.reLaunch({ url: '/pages/login/login' })
            }
          })
          this.exporting = false
          return
        }

        if (result.code !== 0 || !result.url) {
          uni.showToast({
            title: result.msg || '导出失败',
            icon: 'none'
          })
          return
        }

        const url = result.url

        uni.downloadFile({
          url,
          success: (res2) => {
            if (res2.statusCode === 200) {
              if (uni.openDocument) {
                uni.openDocument({
                  filePath: res2.tempFilePath,
                  success: () => {}
                })
              } else {
                uni.showToast({
                  title: '已下载，可在本机查看',
                  icon: 'none'
                })
              }
            } else {
              uni.showToast({
                title: '下载失败',
                icon: 'none'
              })
            }
          },
          fail: () => {
            uni.showToast({
              title: '下载失败',
              icon: 'none'
            })
          }
        })
      } catch (e) {
        console.error('exportSaleListExcel error', e)
        uni.showToast({
          title: '导出失败',
          icon: 'none'
        })
      } finally {
        this.exporting = false
      }
    }
  }
}
</script>
<style scoped>
	/* 整体页面背景 & 内边距 */
	.page {
		min-height: 100vh;
		background: #f2f4f9;
		padding: 24rpx 16rpx 40rpx;
		box-sizing: border-box;
	}

	/* 内层宽度限制，适配大屏 */
	.inner {
		width: 90%;
		max-width: 1600rpx;
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

	/* 卡片通用样式 */
	.card {
		background-color: #ffffff;
		border-radius: 20rpx;
		padding: 22rpx 24rpx;
		margin-bottom: 20rpx;
		box-shadow: 0 8rpx 22rpx rgba(15, 35, 52, 0.04);
		box-sizing: border-box;
	}

	.card-header {
		margin-bottom: 10rpx;
	}

	.card-header-with-action {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.card-header-left {
		flex: 1;
		min-width: 0;
	}

	.card-header-right {
		margin-left: 16rpx;
	}

	.card-title {
		font-size: 28rpx;
		font-weight: 600;
		color: #222;
	}

	.card-sub {
		margin-top: 2rpx;
		font-size: 22rpx;
		color: #9aa0ae;
	}

	/* ===== 筛选卡片 ===== */
	.card-filter .card-body {
		margin-top: 4rpx;
	}

	.form-row {
		display: flex;
		flex-wrap: wrap;
		margin: 0 -8rpx;
	}

	.form-row .form-item {
		padding: 0 8rpx;
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

	/* 四列布局 */
	.col-quarter {
		width: 100%;
	}

	@media (min-width: 768px) {
		.col-quarter {
			width: 23%;
		}
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

	.picker {
		flex: 1;
		height: 100%;
		display: flex;
		align-items: center;
		box-sizing: border-box;
		font-size: 28rpx;
		color: #222;
	}

	/* 筛选按钮行 */
	.btn-row-inline {
		margin-top: 10rpx;
		display: flex;
		justify-content: flex-end;
		column-gap: 16rpx;
	}

	/* ===== 汇总卡片 ===== */
	.card-summary {
		margin-bottom: 18rpx;
	}

	.summary-row {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		row-gap: 12rpx;
	}

	.summary-item {
		width: 48%;
		margin-bottom: 4rpx;
	}

	.summary-label {
		font-size: 24rpx;
		color: #6b7280;
	}

	.summary-value-row {
		display: flex;
		align-items: baseline;
		margin-top: 4rpx;
	}

	.summary-value {
		font-size: 32rpx;
		font-weight: 700;
		color: #111827;
	}

	.summary-unit {
		font-size: 22rpx;
		color: #9ca3af;
		margin-left: 4rpx;
	}

	/* ===== 列表卡片外层 ===== */
	.card-list {
		padding-bottom: 18rpx;
	}

	/* loading / 空状态 */
	.list-loading,
	.empty {
		padding: 24rpx 6rpx;
		text-align: center;
	}

	.loading-text {
		font-size: 24rpx;
		color: #6b7280;
	}

	.empty-main {
		font-size: 26rpx;
		color: #4b5563;
	}

	.empty-sub {
		margin-top: 4rpx;
		font-size: 22rpx;
		color: #9ca3af;
	}

	/* ===== 表格区域 ===== */
	.sale-table {
		margin-top: 8rpx;
		border-radius: 18rpx;
		background: #f9fafb;
		overflow: hidden;
	}

	/* 行：表头和数据行共用 */
	.sale-row {
		display: flex;
		flex-direction: row;
		align-items: stretch;
		width: 100%;
	}

	/* 列：统一使用 flex 比例 */
	.sale-col {
		flex: 1;
		min-width: 0;
		padding: 14rpx 12rpx;
		box-sizing: border-box;
		font-size: 24rpx;
		color: #4b5563;
		display: flex;
		flex-direction: column;
		justify-content: center;
	}

	/* 各列占比微调 */
	.col-date {
		flex: 1.1;
	}

	.col-customer {
		flex: 1.6;
	}

	.col-bottle {
		flex: 1.5;
	}

	.col-amount {
		flex: 1.2;
	}

	.col-status {
		flex: 1.3;
	}

	/* 表头行 */
	.sale-row-header {
		background: #eef2ff;
		border-bottom: 1rpx solid #e5e7eb;
	}

	.sale-row-header .sale-col {
		font-size: 24rpx;
		font-weight: 600;
		color: #374151;
	}

	.header-text {
		font-size: 24rpx;
	}

	/* 数据行 */
	.sale-row-body {
		background: #ffffff;
		border-bottom: 1rpx solid #f1f5f9;
	}

	/* 斑马纹 */
	.sale-row-body:nth-child(odd) {
		background: #f9fafb;
	}

	/* hover 效果（H5） */
	.sale-row-body:hover {
		background: #f3f4ff;
	}

	/* 行的未收高亮 */
	.row-unpaid {
		border-left-width: 6rpx;
		border-left-style: solid;
		border-left-color: #f97316;
	}

	/* 文本样式 */
	.cell-main {
		font-size: 26rpx;
		color: #111827;
	}

	.cell-sub {
		margin-top: 4rpx;
		font-size: 22rpx;
		color: #9ca3af;
	}

	.cell-label {
		font-size: 24rpx;
		color: #9ca3af;
		margin-bottom: 2rpx;
	}

	.amount-main {
		font-size: 26rpx;
		font-weight: 600;
	}

	/* 收款状态胶囊 */
	.status-pill {
		display: inline-flex;
		align-items: center;
		padding: 4rpx 10rpx;
		/* 紧一点 */
		border-radius: 999rpx;
		font-size: 22rpx;
		line-height: 1.4;
		background: #eff6ff;
		color: #1d4ed8;
	}
	.suggest-panel {
	  margin-top: 4rpx;
	  background: #ffffff;
	  border-radius: 12rpx;
	  box-shadow: 0 6rpx 18rpx rgba(0,0,0,0.06);
	  padding: 6rpx 0;
	  max-height: 260rpx;
	  overflow-y: auto;
	}
	
	.suggest-item {
	  padding: 10rpx 20rpx;
	  font-size: 26rpx;
	  color: #333;
	}
	
	.suggest-item + .suggest-item {
	  border-top: 1rpx solid #f3f4f6;
	}
	
	.suggest-item:active {
	  background: #eef2ff;
	}

	/* 不同状态颜色：沿用上一版配色 */
	.paid {
		background: #ecfdf5;
		color: #16a34a;
	}

	.unpaid {
		background: #fef2f2;
		color: #dc2626;
	}

	.partial {
		background: #fffbeb;
		color: #d97706;
	}

	/* ===== 分页 ===== */
	.pagination {
		margin-top: 12rpx;
		display: flex;
		justify-content: center;
		align-items: center;
		column-gap: 16rpx;
	}

	.page-info {
		font-size: 24rpx;
		color: #6b7280;
	}

	/* ===== 按钮通用样式 ===== */
	.btn-soft {
		min-width: 140rpx;
		padding: 12rpx 22rpx;
		border-radius: 999rpx;
		font-size: 24rpx;
		background: rgba(244, 247, 255, 0.9);
		color: #4d5cff;
		border: 1rpx solid rgba(212, 220, 255, 0.9);
	}

	.btn-soft::after {
		border: none;
	}

	.btn-mini {
		min-width: 120rpx;
		padding: 8rpx 18rpx;
		font-size: 22rpx;
	}

	.btn-primary {
		min-width: 180rpx;
		padding: 14rpx 26rpx;
		border-radius: 999rpx;
		font-size: 26rpx;
		background: linear-gradient(135deg, #2979ff, #1a98ff);
		color: #ffffff;
		box-shadow: 0 14rpx 30rpx rgba(26, 120, 255, 0.32);
		border: none;
	}

	.btn-primary::after {
		border: none;
	}

	/* 导出按钮 */
	.btn-export {
		min-width: 220rpx;
	}

	/* 颜色辅助 */
	.text-danger {
		color: #dc2626;
	}

	.text-normal {
		color: #111827;
	}

	/* 窄屏适配 */
	@media (max-width: 768px) {
		.sale-col {
			padding: 16rpx 10rpx;
			font-size: 26rpx;
		}

		.cell-main {
			font-size: 28rpx;
		}
	}
</style>