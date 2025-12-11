<template>
  <view class="page">
    <view class="inner">
      <BackToDashboardBar back-to="/pages/bottle/manage" text="返回" />
      <view class="page-header">
        <view class="page-header-left">
          <view class="page-icon">
            <text class="page-icon-text">瓶</text>
          </view>
          <view class="page-header-text">
            <text class="page-title">瓶子详情</text>
            <text class="page-sub">
              查看瓶号、皮重、状态与备注
            </text>
          </view>
        </view>
      </view>

      <!-- 基本信息卡片 -->
      <view class="card">
        <view class="card-header">
          <text class="card-title">基本信息</text>
        </view>

        <view v-if="loading" class="loading-block">
          <text class="loading-text">加载中…</text>
        </view>

        <view v-else-if="!bottle" class="empty-block">
          <text class="empty-main">未找到瓶子信息</text>
          <text class="empty-sub">请检查传入的瓶号或稍后重试</text>
        </view>

        <view v-else class="info-body">
          <view class="info-row">
            <text class="info-label">瓶号</text>
            <text class="info-value strong">{{ bottle.number }}</text>
          </view>

          <view class="info-row">
            <text class="info-label">皮重</text>
            <text class="info-value">
              {{
                bottle.tare_weight != null
                  ? bottle.tare_weight + ' kg'
                  : '未填写'
              }}
            </text>
          </view>

          <view class="info-row">
            <text class="info-label">状态</text>
            <view
              class="status-pill"
              :class="'status-' + (bottle.status || 'unknown')"
            >
              <text class="status-dot"></text>
              <text class="status-text">{{ statusText }}</text>
            </view>
          </view>

          <view class="info-row">
            <text class="info-label">备注</text>
            <text class="info-value">
              {{ bottle.remark || '—' }}
            </text>
          </view>

          <view class="info-row">
            <text class="info-label">最近灌装</text>
            <text class="info-value">
              {{
                bottle.last_fill_date
                  ? bottle.last_fill_date +
                    ' · ' +
                    (bottle.last_fill_net != null
                      ? bottle.last_fill_net + ' kg'
                      : '—')
                  : '—'
              }}
            </text>
          </view>

          <view class="info-row">
            <text class="info-label">上次回瓶</text>
            <text class="info-value">
              {{
                bottle.last_back_date
                  ? bottle.last_back_date +
                    ' · ' +
                    (bottle.last_back_net_weight != null
                      ? bottle.last_back_net_weight + ' kg'
                      : '—')
                  : '—'
              }}
            </text>
          </view>

          <view class="info-row">
            <text class="info-label">下次出瓶净重</text>
            <text class="info-value">
              {{
                bottle.next_out_net != null
                  ? bottle.next_out_net + ' kg'
                  : '—'
              }}
            </text>
          </view>

          <view class="info-row">
            <text class="info-label">上次客户</text>
            <text class="info-value">
              {{ bottle.last_customer_name || '—' }}
            </text>
          </view>

          <view class="info-row info-row-small">
            <text class="info-label">创建时间</text>
            <text class="info-value minor">
              {{ formatTime(bottle.created_at) || '—' }}
            </text>
          </view>

          <view class="info-row info-row-small">
            <text class="info-label">最近更新</text>
            <text class="info-value minor">
              {{ formatTime(bottle.updated_at) || '—' }}
            </text>
          </view>
        </view>
      </view>

      <!-- 流转记录 -->
      <view class="card">
        <view class="card-header">
          <text class="card-title">流转记录</text>
          <text class="card-sub">
            {{
              records.length > 0
                ? '共 ' + records.length + ' 条相关记录'
                : '展示与该瓶号有关的销售/灌装记录'
            }}
          </text>
        </view>

        <view v-if="recordsLoading" class="loading-block">
          <text class="loading-text">加载中…</text>
        </view>

        <view v-else-if="!records.length" class="empty-block">
          <text class="empty-main">暂无流转记录</text>
          <text class="empty-sub">
            录入几条含有该瓶号的销售或灌装记录后，这里会自动生成时间线。
          </text>
        </view>

        <!-- 有数据时：支持折叠/展开 -->
        <view v-else class="timeline">
          <view
            v-for="(item, idx) in visibleRecords"
            :key="idx"
            class="timeline-row"
          >
            <view class="timeline-left">
              <view
                class="timeline-dot"
                :class="'role-' + item.role"
              ></view>
              <!-- 注意：这里判断的是 visibleRecords 的最后一条 -->
              <view
                v-if="idx !== visibleRecords.length - 1"
                class="timeline-line"
              ></view>
            </view>

            <view class="timeline-content">
              <view class="timeline-top">
                <view class="role-tag" :class="'role-tag-' + item.role">
                  <text class="role-text">
                    {{ item.role_text || roleLabel(item.role) }}
                  </text>
                </view>
                <text class="time-text">
                  {{ formatRecordTime(item) }}
                </text>
              </view>

              <view class="timeline-main">
                <text class="main-title">
                  {{ item.customer_name || '未知客户' }}
                </text>
                <view class="main-meta">
                  <text v-if="item.net_weight != null" class="meta-item">
                    净重 {{ item.net_weight }} kg
                  </text>
                  <text
                    v-if="item.unit_price != null"
                    class="meta-item"
                  >
                    单价
                    {{ item.unit_price }}
                    {{
                      item.price_unit === 'bottle'
                        ? '元/瓶'
                        : item.price_unit === 'kg'
                        ? '元/kg'
                        : ''
                    }}
                  </text>
                </view>
                <text v-if="item.remark" class="meta-remark">
                  备注：{{ item.remark }}
                </text>
              </view>
            </view>
          </view>

          <!-- 底部“展开更多 / 收起” -->
          <view v-if="hasMoreRecords" class="timeline-toggle">
            <text class="toggle-text" @click="toggleRecords">
              {{ showAllRecords ? '收起部分记录' : '展开更多记录' }}
            </text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { ensureLogin, getToken } from '@/common/auth.js'
import { callCloud } from '@/common/request.js'
import BackToDashboardBar from '@/components/BackToDashboardBar.vue'

export default {
  components: {
    BackToDashboardBar
  },
  data() {
    return {
      bottleId: '',
      bottleNumber: '',
      bottle: null,
      loading: false,

      records: [],
      recordsLoading: false,
      // 是否展开全部流转记录
      showAllRecords: false
    }
  },

  computed: {
    statusText() {
      const s = this.bottle && this.bottle.status
      const map = {
        in_station: '在站',
        at_customer: '在客户',
        in_transit: '途中',
        repairing: '维修',
        scrapped: '报废',
        lost: '丢失',
        unknown: '未维护'
      }
      return map[s] || '未维护'
    },
    // 实际展示的记录（最多 3 条，除非展开）
    visibleRecords() {
      if (this.showAllRecords) return this.records
      return this.records.slice(0, 3)
    },

    // 是否有更多记录可折叠
    hasMoreRecords() {
      return this.records.length > 3
    }
  },

  onLoad(options) {
    // 先统一做登录校验
    if (!ensureLogin()) return

    // 支持两种进来方式：?id=xxx 或 ?number=207
    this.bottleId = options && options.id ? options.id : ''
    this.bottleNumber = options && options.number ? options.number : ''

    this.fetchBottleDetail()
  },

  methods: {
    async callWithAuth(name, payload) {
      const result = await callCloud(name, payload)
      if (result.code === 401) return null
      return result
    },

    async fetchBottleDetail() {
      // 如果有瓶号，用瓶号查
      if (!this.bottleNumber && !this.bottleId) {
        uni.showToast({
          title: '缺少瓶号参数',
          icon: 'none'
        })
        return
      }

      this.loading = true
      try {
        const result = await this.callWithAuth('crm-bottle', {
          action: 'getByNumber',
          data: {
            number: this.bottleNumber
          }
        })

        if (!result) return

        if (result.code !== 0) {
          uni.showToast({
            title: result.msg || '加载失败',
            icon: 'none'
          })
          this.bottle = null
          return
        }

        this.bottle = result.data || null
        if (this.bottle && this.bottle.number) {
          this.bottleNumber = this.bottle.number
          // 有了瓶号，再去查流转记录
          this.loadRecords()
        }
      } catch (e) {
        console.error('load bottle detail error:', e)
        uni.showToast({
          title: '加载失败，请稍后再试',
          icon: 'none'
        })
      } finally {
        this.loading = false
      }
    },

    // 切换“展开更多 / 收起”
    toggleRecords() {
      this.showAllRecords = !this.showAllRecords
    },

    // 合并 销售 + 灌装 记录，按时间排序
    async loadRecords() {
      if (!this.bottleNumber) return

      this.recordsLoading = true
      try {
        // 1）销售记录（出瓶 / 回瓶 / 存瓶）
        const saleReq = this.callWithAuth('crm-sale', {
          action: 'listByBottle',
          data: {
            number: this.bottleNumber,
            page: 1,
            pageSize: 100
          }
        })

        // 2）灌装记录（只过滤瓶号，不限制日期）
        const fillReq = this.callWithAuth('crm-filling', {
          action: 'list',
          data: {
            page: 1,
            pageSize: 100,
            bottle_no: this.bottleNumber
          }
        })

        const [saleRes, fillRes] = await Promise.all([saleReq, fillReq])

        const saleResult = saleRes || {}
        const fillResult = fillRes || {}

        if (saleResult.code !== 0 && fillResult.code !== 0) {
          uni.showToast({
            title:
              saleResult.msg ||
              fillResult.msg ||
              '加载流转记录失败',
            icon: 'none'
          })
          this.records = []
          return
        }

        const saleList = Array.isArray(saleResult.data)
          ? saleResult.data
          : []
        const fillList = Array.isArray(fillResult.data)
          ? fillResult.data
          : []

        const merged = []

        // 销售记录
        saleList.forEach(it => {
          merged.push({
            type: 'sale',
            role: it.role || 'record',
            customer_name: it.customer_name,
            net_weight: it.net_weight,
            unit_price: it.unit_price,
            price_unit: it.price_unit,
            remark: it.remark,
            created_at: it.created_at,
            updated_at: it.updated_at,
            date: it.date,
            _raw: it
          })
        })

        // 灌装记录（在站灌装）
        fillList.forEach(it => {
          merged.push({
            type: 'fill',
            role: 'fill',
            customer_name: '站内灌装',
            net_weight: it.net_fill,
            unit_price: null,
            price_unit: null,
            remark: it.remark,
            created_at: it.created_at,
            updated_at: it.updated_at,
            date: it.date,
            timestamp: it.timestamp,
            _raw: it
          })
        })

        // 按时间倒序排序
        merged.sort((a, b) => {
          const ta = this.recordTimestamp(a)
          const tb = this.recordTimestamp(b)
          return tb - ta // 新的在前
        })

        this.records = merged
      } catch (e) {
        console.error('load bottle records error:', e)
        uni.showToast({
          title: '加载流转记录失败',
          icon: 'none'
        })
        this.records = []
      } finally {
        this.recordsLoading = false
      }
    },

    // 统一时间戳，用于排序
    recordTimestamp(item) {
      if (!item) return 0
      if (item.created_at) return item.created_at
      if (item.updated_at) return item.updated_at
      if (item.timestamp) return item.timestamp
      if (item.date) {
        return new Date(item.date).getTime()
      }
      return 0
    },

    roleLabel(role) {
      if (role === 'out') return '出瓶'
      if (role === 'back') return '回瓶'
      if (role === 'deposit') return '存瓶'
      if (role === 'fill') return '灌装'
      return '记录'
    },

    formatTime(ts) {
      if (!ts) return ''
      const d = new Date(ts)
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      const h = String(d.getHours()).padStart(2, '0')
      const mi = String(d.getMinutes()).padStart(2, '0')
      return `${y}-${m}-${day} ${h}:${mi}`
    },

    // 流转记录时间展示
    formatRecordTime(item) {
      if (!item) return '未填日期'

      if (item.created_at) {
        return this.formatTime(item.created_at)
      }
      if (item.updated_at) {
        return this.formatTime(item.updated_at)
      }
      if (item.date) {
        return `${item.date} 00:00`
      }

      return '未填日期'
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

  /* 顶部标题 */
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
    font-size: 32rpx;
    font-weight: 700;
    color: #181c28;
  }

  .page-sub {
    margin-top: 4rpx;
    font-size: 24rpx;
    color: #949aac;
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

  .card-header {
    margin-bottom: 10rpx;
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

  /* 基本信息 */
  .info-body {
    padding-top: 4rpx;
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10rpx 0;
  }

  .info-row + .info-row {
    border-top: 1rpx solid #f1f2f6;
  }

  .info-row-small {
    font-size: 22rpx;
  }

  .info-label {
    font-size: 26rpx;
    color: #6b7280;
  }

  .info-value {
    font-size: 26rpx;
    color: #111827;
  }

  .info-value.strong {
    font-size: 30rpx;
    font-weight: 700;
  }

  .info-value.minor {
    font-size: 22rpx;
    color: #9ca3af;
  }

  /* 状态 pill */
  .status-pill {
    padding: 4rpx 12rpx;
    border-radius: 999rpx;
    display: flex;
    align-items: center;
    font-size: 22rpx;
  }

  .status-dot {
    width: 8rpx;
    height: 8rpx;
    border-radius: 50%;
    margin-right: 4rpx;
  }

  .status-in_station {
    background: rgba(59, 130, 246, 0.08);
    color: #1d4ed8;
  }

  .status-in_station .status-dot {
    background: #2563eb;
  }

  .status-at_customer {
    background: rgba(16, 185, 129, 0.08);
    color: #047857;
  }

  .status-at_customer .status-dot {
    background: #10b981;
  }

  .status-lost,
  .status-scrapped {
    background: rgba(248, 113, 113, 0.08);
    color: #b91c1c;
  }

  .status-lost .status-dot,
  .status-scrapped .status-dot {
    background: #ef4444;
  }

  .status-unknown {
    background: rgba(156, 163, 175, 0.08);
    color: #4b5563;
  }

  .status-unknown .status-dot {
    background: #9ca3af;
  }

  /* 空 & loading */
  .loading-block,
  .empty-block {
    padding: 24rpx 4rpx 6rpx;
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

  /* 时间线 */
  .timeline {
    margin-top: 6rpx;
  }

  .timeline-row {
    display: flex;
    padding: 14rpx 0;
  }

  .timeline-left {
    width: 32rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .timeline-dot {
    width: 12rpx;
    height: 12rpx;
    border-radius: 999rpx;
    margin-top: 6rpx;
  }

  /* 不同角色颜色 */
  .timeline-dot.role-out {
    background: #2563eb;
  }

  .timeline-dot.role-back {
    background: #059669;
  }

  .timeline-dot.role-deposit {
    background: #d97706;
  }

  .timeline-dot.role-fill {
    background: #6366f1;
  }

  .timeline-line {
    flex: 1;
    width: 2rpx;
    background: #e5e7eb;
    margin-top: 4rpx;
  }

  /* 内容 */
  .timeline-content {
    flex: 1;
    padding-left: 10rpx;
  }

  .timeline-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .timeline-toggle {
    margin-top: 8rpx;
    padding-top: 8rpx;
    border-top: 1rpx solid #e5e7eb;
    display: flex;
    justify-content: center;
  }

  .toggle-text {
    font-size: 24rpx;
    color: #4d5cff;
  }

  .role-tag {
    padding: 4rpx 12rpx;
    border-radius: 999rpx;
    font-size: 22rpx;
  }

  .role-tag-out {
    background: rgba(37, 99, 235, 0.08);
    color: #1d4ed8;
  }

  .role-tag-back {
    background: rgba(5, 150, 105, 0.08);
    color: #047857;
  }

  .role-tag-deposit {
    background: rgba(217, 119, 6, 0.08);
    color: #92400e;
  }

  .role-tag-fill {
    background: rgba(99, 102, 241, 0.08);
    color: #4338ca;
  }

  .time-text {
    font-size: 22rpx;
    color: #9ca3af;
  }

  .timeline-main {
    margin-top: 4rpx;
  }

  .main-title {
    font-size: 26rpx;
    color: #111827;
  }

  .main-meta {
    margin-top: 4rpx;
    font-size: 22rpx;
    color: #6b7280;
    display: flex;
    flex-wrap: wrap;
  }

  .meta-item + .meta-item {
    margin-left: 12rpx;
  }

  .meta-remark {
    margin-top: 4rpx;
    font-size: 22rpx;
    color: #9ca3af;
  }

  /* 底部返回按钮（目前用 BackToDashboardBar 了，可以不用） */
  .bottom-bar {
    margin-top: 16rpx;
    display: flex;
    justify-content: center;
  }

  .btn-back {
    min-width: 220rpx;
    padding: 16rpx 24rpx;
    border-radius: 999rpx;
    font-size: 26rpx;
    background: rgba(244, 247, 255, 0.95);
    color: #4d5cff;
    border: 1rpx solid rgba(212, 220, 255, 0.9);
  }

  .btn-back::after {
    border: none;
  }
</style>