<template>
  <view class="logs-page">
    <BackToDashboardBar back-to="/pages/dashboard/index" text="返回工作台" />

    <view class="card">
      <view class="card-header">
        <text class="card-title">操作日志</text>
        <text class="card-sub">仅超级管理员可见，按时间倒序展示所有用户动作</text>
      </view>

      <view class="filters">
        <view class="filter-chip">共 {{ total }} 条</view>
      </view>

      <view class="card-body">
        <view v-if="loading && logs.length === 0" class="empty">
          <text>加载中…</text>
        </view>
        <view v-else-if="logs.length === 0" class="empty">
          <text>暂无日志</text>
        </view>
        <view v-else class="log-list">
          <view v-for="item in logs" :key="item._id" class="log-item">
            <view class="log-meta">
              <text class="user">{{ item.username || '未知用户' }}（{{ roleLabel(item.role) }}）</text>
              <text class="time">{{ formatDateTime(item.created_at) }}</text>
            </view>
            <view class="log-content">
              <text class="action">{{ item.action || '-' }}</text>
              <text class="detail">{{ formatDetail(item.detail) }}</text>
            </view>
          </view>
        </view>
      </view>

      <view class="footer" v-if="hasMore">
        <button class="load-more" :loading="loading" @click="loadMore">加载更多</button>
      </view>
    </view>
  </view>
</template>

<script>
import BackToDashboardBar from '@/components/BackToDashboardBar.vue'
import { ensureLogin, getUserInfo, isSuperAdmin } from '@/common/auth.js'
import { callCloud } from '@/common/request.js'

export default {
  components: { BackToDashboardBar },
  data() {
    return {
      logs: [],
      page: 1,
      pageSize: 30,
      total: 0,
      loading: false
    }
  },
  computed: {
    hasMore() {
      return this.logs.length < this.total
    }
  },
  onLoad() {
    if (!ensureLogin()) return
    const user = getUserInfo() || {}
    if (!isSuperAdmin(user)) {
      uni.showToast({ title: '仅超级管理员可访问', icon: 'none' })
      uni.navigateBack()
      return
    }
    this.loadLogs(true)
  },
  methods: {
    roleLabel(role) {
      if (role === 'superadmin') return '超级管理员'
      if (role === 'admin') return '管理员'
      if (role === 'user') return '普通员工'
      return role || '未设置'
    },
    formatDateTime(ts) {
      if (!ts) return '-'
      const d = new Date(ts)
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      const hh = String(d.getHours()).padStart(2, '0')
      const mm = String(d.getMinutes()).padStart(2, '0')
      const ss = String(d.getSeconds()).padStart(2, '0')
      return `${y}-${m}-${day} ${hh}:${mm}:${ss}`
    },
    formatDetail(detail) {
      if (!detail) return '—'
      if (typeof detail === 'string') return detail
      try {
        return JSON.stringify(detail)
      } catch (err) {
        return '—'
      }
    },
    async loadLogs(reset = false) {
      if (this.loading) return
      this.loading = true
      const nextPage = reset ? 1 : this.page
      const res = await callCloud('crm-logs', {
        action: 'list',
        data: { page: nextPage, pageSize: this.pageSize }
      })
      this.loading = false
      if (res.code !== 0) return
      this.total = res.total || 0
      this.page = nextPage
      const list = Array.isArray(res.data) ? res.data : []
      this.logs = reset ? list : this.logs.concat(list)
    },
    loadMore() {
      if (this.loading || !this.hasMore) return
      this.page += 1
      this.loadLogs()
    }
  }
}
</script>

<style scoped>
.logs-page {
  min-height: 100vh;
  background: #f5f7fb;
  padding: 24rpx 16rpx 40rpx;
  box-sizing: border-box;
}

.card {
  background: #fff;
  border-radius: 20rpx;
  box-shadow: 0 12rpx 32rpx rgba(17, 24, 39, 0.05);
}

.card-header {
  padding: 20rpx 24rpx 0;
}

.card-title {
  font-size: 32rpx;
  font-weight: 700;
  color: #1f2937;
}

.card-sub {
  margin-top: 6rpx;
  font-size: 24rpx;
  color: #6b7280;
}

.filters {
  display: flex;
  padding: 12rpx 24rpx 0;
  gap: 12rpx;
}

.filter-chip {
  background: linear-gradient(135deg, #4f8efc, #74b2ff);
  color: #fff;
  padding: 8rpx 16rpx;
  border-radius: 16rpx;
  font-size: 24rpx;
}

.card-body {
  padding: 16rpx 24rpx 8rpx;
}

.empty {
  padding: 40rpx 0;
  text-align: center;
  color: #6b7280;
}

.log-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.log-item {
  border: 1rpx solid #e5e7eb;
  border-radius: 16rpx;
  padding: 12rpx 14rpx;
  background: linear-gradient(90deg, #f9fbff, #f6f8fb);
}

.log-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #4b5563;
  font-size: 24rpx;
}

.user {
  font-weight: 700;
  color: #111827;
}

.time {
  font-size: 22rpx;
  color: #6b7280;
}

.log-content {
  margin-top: 6rpx;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.action {
  font-weight: 700;
  color: #1f2937;
}

.detail {
  color: #4b5563;
  word-break: break-all;
  line-height: 1.5;
}

.footer {
  padding: 12rpx 24rpx 16rpx;
  text-align: center;
}

.load-more {
  background: #2563eb;
  color: #fff;
  border-radius: 16rpx;
  font-size: 28rpx;
}
</style>
