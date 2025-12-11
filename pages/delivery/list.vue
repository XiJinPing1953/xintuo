<template>
  <view class="page">
    <view class="inner">
      <!-- 顶部标题区 -->
      <BackToDashboardBar back-to="/pages/dashboard/index" text="返回工作台" />
      <view class="page-header">
        <view class="page-header-left">
          <view class="page-icon">
            <text class="page-icon-text">配</text>
          </view>
          <view class="page-header-text">
            <text class="page-title">配送员管理</text>
            <text class="page-sub">维护配送员信息，方便派单与对账</text>
          </view>
        </view>

        <view class="page-header-right">
          <!-- 只有管理员可以新增 -->
          <button
            v-if="isAdmin"
            class="btn-primary"
            @click="goCreate"
          >
            + 新增配送员
          </button>
        </view>
      </view>

      <!-- 筛选 / 搜索 -->
      <view class="card card-filter">
        <view class="filter-row">
          <view class="filter-item keyword">
            <text class="label">关键词</text>
            <view class="input-wrapper">
              <input
                class="input"
                v-model="keyword"
                placeholder="按姓名 / 手机号搜索"
                confirm-type="search"
                @confirm="onSearch"
              />
            </view>
          </view>

          <view class="filter-item status">
            <text class="label">状态</text>
            <picker
              mode="selector"
              :range="statusOptions"
              :value="statusIndex"
              @change="onStatusChange"
            >
              <view class="input-wrapper picker-wrapper">
                <view class="picker">
                  <text>{{ statusLabel }}</text>
                </view>
              </view>
            </picker>
          </view>

          <view class="filter-item btns">
            <button class="btn-soft" @click="resetFilter">重置</button>
          </view>
        </view>
      </view>

      <!-- 列表 -->
      <view class="card">
        <view class="card-header">
          <text class="card-title">配送员列表</text>
          <text class="card-sub">共 {{ filteredList.length }} 人</text>
        </view>

        <view v-if="loading" class="list-loading">
          <text class="loading-text">加载中…</text>
        </view>

        <view v-else>
          <view v-if="filteredList.length === 0" class="empty">
            <text class="empty-main">暂无数据</text>
            <!-- 文案按权限区分 -->
            <text v-if="isAdmin" class="empty-sub">
              可以点击右上角「新增配送员」进行添加
            </text>
            <text v-else class="empty-sub">
              当前账号仅能查看配送员信息，如需维护配送员，请联系管理员
            </text>
          </view>

          <view v-else class="list">
            <view
              v-for="item in filteredList"
              :key="item._id"
              class="row"
            >
              <view class="row-main">
                <view class="avatar">
                  <text class="avatar-text">
                    {{ (item.name || '配').slice(0,1).toUpperCase() }}
                  </text>
                </view>

                <view class="row-text">
                  <view class="row-title-line">
                    <text class="row-name">{{ item.name || '-' }}</text>

                    <!-- 状态 tag：根据状态自动切换颜色 + 中文文案 -->
                    <view
                      class="status-tag"
                      :class="statusTagClass(item.status)"
                    >
                      <text
                        class="status-dot"
                        :class="statusDotClass(item.status)"
                      ></text>
                      <text class="status-text">
                        {{ formatStatusText(item.status) }}
                      </text>
                    </view>
                  </view>

                  <view class="row-meta">
                    <text v-if="item.phone" class="meta-item">
                      手机：{{ item.phone }}
                    </text>
                    <text v-if="item.remark" class="meta-item meta-remark">
                      备注：{{ item.remark }}
                    </text>
                  </view>
                </view>
              </view>

              <!-- 行右侧操作：只有管理员能看到 -->
              <view
                v-if="isAdmin"
                class="row-actions"
              >
                <button class="btn-link" @click="goEdit(item)">编辑</button>
                <button class="btn-link danger" @click="confirmRemove(item)">删除</button>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import BackToDashboardBar from '@/components/BackToDashboardBar.vue'
import {
  getUserInfo,
  getToken as getAuthToken,
  ensureLogin,
  isAdminRole
} from '@/common/auth.js'

export default {
  components: {
    BackToDashboardBar
  },

  data() {
    return {
      loading: false,
      // 后端返回的原始列表
      rawList: [],

      // 前端筛选用
      keyword: '',
      statusOptions: ['全部状态', '在职', '请假', '离职'],
      statusIndex: 0,

      // 权限
      isAdmin: false,
      userInfo: {}
    }
  },

  computed: {
    statusLabel() {
      return this.statusOptions[this.statusIndex]
    },

    filteredList() {
      const kw = (this.keyword || '').trim()
      const statusFilter =
        this.statusIndex === 0 ? '' : this.statusOptions[this.statusIndex]

      return this.rawList.filter(item => {
        // 使用「展示用中文状态」来做过滤，兼容 active / leave 等英文值
        const displayStatus = this.formatStatusText(item.status)

        if (statusFilter && displayStatus !== statusFilter) {
          return false
        }

        if (!kw) return true

        const name = item.name || ''
        const phone = item.phone || ''

        return name.indexOf(kw) !== -1 || phone.indexOf(kw) !== -1
      })
    }
  },

  onLoad() {
    // 统一登录校验
    if (!ensureLogin()) return
    this.initRole()
    this.loadList()
  },

  onShow() {
    // 回到页面时再做一次简单校验 + 刷新
    if (!ensureLogin()) return
    this.initRole()
    this.loadList()
  },

  methods: {
    // ===== 角色初始化 =====
    initRole() {
      const u = getUserInfo() || {}
      this.userInfo = u
      this.isAdmin = isAdminRole(u)
    },

    // ===== 状态映射 & 样式 =====
    /**
     * 把后端存的 status 映射成展示用中文：
     *  - '在职' / 'active'    => '在职'
     *  - '请假' / 'on_leave' => '请假'
     *  - '离职' / 'leave'    => '离职'
     */
    formatStatusText(status) {
      const s = (status || '').trim()
      if (s === '在职' || s === 'active') return '在职'
      if (s === '请假' || s === 'on_leave') return '请假'
      if (s === '离职' || s === 'leave') return '离职'
      // 兜底：没填就当在职
      if (!s) return '在职'
      return s
    },

    // 根据状态返回 tag 的附加 class
    statusTagClass(status) {
      const text = this.formatStatusText(status)
      if (text === '在职') return 'status-tag--active'
      if (text === '请假') return 'status-tag--leave'
      if (text === '离职') return 'status-tag--inactive'
      return 'status-tag--active'
    },

    // 根据状态返回 dot 的附加 class
    statusDotClass(status) {
      const text = this.formatStatusText(status)
      if (text === '在职') return 'status-dot--active'
      if (text === '请假') return 'status-dot--leave'
      if (text === '离职') return 'status-dot--inactive'
      return 'status-dot--active'
    },

    // ===== 鉴权 & 数据加载 =====
    getToken() {
      // 统一走 common/auth.js 的 getToken
      const token = getAuthToken()
      if (!token) {
        uni.showToast({
          title: '登录已过期，请重新登录',
          icon: 'none'
        })
        ensureLogin()
        return ''
      }
      return token
    },

    async loadList() {
      const token = this.getToken()
      if (!token) return

      this.loading = true
      try {
        const res = await uniCloud.callFunction({
          name: 'crm-delivery',
          data: {
            action: 'list',
            token,
            data: {}
          }
        })

        const result = res.result || {}

        if (result.code === 401) {
          uni.showToast({
            title: result.msg || '登录已过期，请重新登录',
            icon: 'none'
          })
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

        this.rawList = result.data || []
      } catch (e) {
        console.error('crm-delivery list error:', e)
        uni.showToast({
          title: '加载失败，请稍后再试',
          icon: 'none'
        })
      } finally {
        this.loading = false
      }
    },

    onStatusChange(e) {
      this.statusIndex = Number(e.detail.value || 0)
    },

    onSearch() {
      // 触发 computed 重新计算就行，这里不用重新拉接口
    },

    resetFilter() {
      this.keyword = ''
      this.statusIndex = 0
    },

    // ===== 路由 & 删除（加权限判断）=====
    goCreate() {
      if (!this.isAdmin) {
        return uni.showToast({
          title: '当前账号无权限新增配送员',
          icon: 'none'
        })
      }
      uni.navigateTo({ url: '/pages/delivery/edit' })
    },

    goEdit(item) {
      if (!this.isAdmin) {
        return uni.showToast({
          title: '当前账号无权限编辑配送员',
          icon: 'none'
        })
      }
      uni.navigateTo({
        url: `/pages/delivery/edit?id=${item._id}`
      })
    },

    confirmRemove(item) {
      if (!this.isAdmin) {
        return uni.showToast({
          title: '当前账号无权限删除配送员',
          icon: 'none'
        })
      }

      uni.showModal({
        title: '删除确认',
        content: `确定要删除配送员「${item.name || ''}」吗？`,
        confirmColor: '#e11d48',
        success: (res) => {
          if (res.confirm) {
            this.removeItem(item)
          }
        }
      })
    },

    async removeItem(item) {
      if (!this.isAdmin) {
        return uni.showToast({
          title: '当前账号无权限删除配送员',
          icon: 'none'
        })
      }

      const token = this.getToken()
      if (!token) return

      try {
        uni.showLoading({ title: '删除中…', mask: true })

        const res = await uniCloud.callFunction({
          name: 'crm-delivery',
          data: {
            action: 'remove',
            token,
            data: { id: item._id }
          }
        })

        const result = res.result || {}

        if (result.code === 401) {
          uni.showToast({
            title: result.msg || '登录已过期，请重新登录',
            icon: 'none'
          })
          ensureLogin()
          return
        }

        if (result.code !== 0) {
          uni.showToast({
            title: result.msg || '删除失败',
            icon: 'none'
          })
        } else {
          uni.showToast({ title: '已删除', icon: 'success' })
          this.loadList()
        }
      } catch (e) {
        console.error('crm-delivery remove error', e)
        uni.showToast({
          title: '删除失败，请稍后重试',
          icon: 'none'
        })
      } finally {
        uni.hideLoading()
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
  font-size: 32rpx;
  font-weight: 700;
  color: #181c28;
}

.page-sub {
  margin-top: 4rpx;
  font-size: 24rpx;
  color: #949aac;
}

/* 卡片通用 */
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

/* 筛选区 */
.card-filter {
  padding-bottom: 18rpx;
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  margin: 0 -8rpx;
}

.filter-item {
  padding: 0 8rpx;
  margin-bottom: 12rpx;
}

.filter-item.keyword {
  flex: 1;
  min-width: 50%;
}

.filter-item.status {
  width: 220rpx;
}

.filter-item.btns {
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  column-gap: 10rpx;
  flex: 0 0 auto;
}

.label {
  display: block;
  font-size: 24rpx;
  color: #555;
  margin-bottom: 6rpx;
}

.input-wrapper {
  width: 100%;
  height: 80rpx;
  background: #ffffff;
  border-radius: 18rpx;
  box-sizing: border-box;
  border: 1rpx solid #e0e0e0;
  padding: 0 20rpx;
  display: flex;
  align-items: center;
  box-shadow: 0 8rpx 20rpx rgba(16, 46, 90, 0.04);
}

.input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 26rpx;
  color: #222;
}

.picker-wrapper {
  padding: 0 14rpx;
}

.picker {
  flex: 1;
  display: flex;
  align-items: center;
  font-size: 26rpx;
  color: #222;
}

/* 列表 */
.list {
  margin-top: 10rpx;
}

.row {
  padding: 16rpx 10rpx;
  border-radius: 16rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.row + .row {
  margin-top: 6rpx;
}

.row:nth-child(odd) {
  background: #f7f8fc;
}

.row:nth-child(even) {
  background: #f9fafc;
}

.row-main {
  display: flex;
  align-items: center;
  flex: 1;
}

.avatar {
  width: 64rpx;
  height: 64rpx;
  border-radius: 22rpx;
  background: linear-gradient(135deg, #e2f0ff, #d3e6ff);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 14rpx;
}

.avatar-text {
  font-size: 30rpx;
  font-weight: 700;
  color: #1f2937;
}

.row-text {
  flex: 1;
}

.row-title-line {
  display: flex;
  align-items: center;
}

.row-name {
  font-size: 28rpx;
  font-weight: 600;
  color: #111827;
  margin-right: 10rpx;
}

/* 状态 tag 基础样式 */
.status-tag {
  padding: 4rpx 10rpx;
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

/* 在职：绿色 */
.status-tag--active {
  background: rgba(16, 185, 129, 0.08);
  color: #047857;
}
.status-dot--active {
  background: #10b981;
}

/* 请假：黄色 / 橙色 */
.status-tag--leave {
  background: rgba(251, 191, 36, 0.08);
  color: #92400e;
}
.status-dot--leave {
  background: #f59e0b;
}

/* 离职：灰色 */
.status-tag--inactive {
  background: rgba(156, 163, 175, 0.16);
  color: #4b5563;
}
.status-dot--inactive {
  background: #9ca3af;
}

.row-meta {
  margin-top: 4rpx;
  font-size: 24rpx;
  color: #6b7280;
  display: flex;
  flex-wrap: wrap;
}

.meta-item + .meta-item {
  margin-left: 16rpx;
}

.meta-remark {
  color: #9ca3af;
}

/* 操作按钮 */
.row-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  margin-left: 10rpx;
}

.btn-link {
  padding: 0;
  margin: 0;
  background: transparent;
  border: none;
  font-size: 24rpx;
  color: #2563eb;
}

.btn-link::after {
  border: none;
}

.btn-link + .btn-link {
  margin-top: 6rpx;
}

.btn-link.danger {
  color: #dc2626;
}

/* 空状态 & loading */
.empty {
  padding: 24rpx 6rpx;
  text-align: center;
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

.list-loading {
  padding: 24rpx 6rpx;
  text-align: center;
}

.loading-text {
  font-size: 24rpx;
  color: #6b7280;
}

/* 按钮 */
.btn-primary {
  min-width: 180rpx;
  padding: 16rpx 24rpx;
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
</style>