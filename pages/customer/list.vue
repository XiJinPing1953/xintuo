<template>
  <view class="page">
    <view class="page-inner">
      <BackToDashboardBar back-to="/pages/dashboard/index" text="返回工作台" />

      <!-- 顶部：标题 + 操作区 -->
      <view class="page-header">
        <view class="page-header-left">
          <view class="page-icon">
            <text class="page-icon-text">客</text>
          </view>
          <view class="page-header-text">
            <text class="page-title">客户管理</text>
            <text class="page-sub">维护客户档案、默认单价与联系信息</text>
          </view>
        </view>
        <view class="page-header-right">
          <!-- 只有管理员可以看到“新增客户”按钮 -->
          <button class="btn-primary" v-if="isAdmin" @click="goCreate">+ 新增客户</button>
        </view>
      </view>

      <!-- 搜索 + 筛选 -->
      <view class="card">
        <view class="filter-row">
          <view class="search-wrapper">
            <input
              class="search-input"
              v-model="keyword"
              placeholder="按客户名 / 联系人 / 电话搜索"
              confirm-type="search"
              @confirm="onSearch"
            />
            <view v-if="keyword" class="search-clear" @click="clearKeyword">×</view>
          </view>

          <view class="segmented">
            <view
              class="seg-item"
              :class="{ active: filterActive === 'all' }"
              @click="onFilterChange('all')"
            >
              全部
            </view>
            <view
              class="seg-item"
              :class="{ active: filterActive === 'active' }"
              @click="onFilterChange('active')"
            >
              启用
            </view>
            <view
              class="seg-item"
              :class="{ active: filterActive === 'inactive' }"
              @click="onFilterChange('inactive')"
            >
              停用
            </view>
          </view>
        </view>
      </view>

      <!-- 列表 -->
      <view class="card">
        <view v-if="loading && customers.length === 0" class="empty">
          <text class="empty-main">加载中…</text>
        </view>

        <view v-else-if="!loading && customers.length === 0" class="empty">
          <text class="empty-main">暂无客户</text>
          <text class="empty-sub">点击右上角“新增客户”开始建立客户档案</text>
        </view>

        <view v-else>
          <view
            v-for="item in customers"
            :key="item._id"
            class="customer-row"
            @click="onRowClick(item)"
          >
            <view class="row-main">
              <view class="row-title-line">
                <text class="row-name">{{ item.name || '未命名客户' }}</text>
                <view class="status-tag" :class="{ inactive: item.is_active === false }">
                  <text v-if="item.is_active === false">停用</text>
                  <text v-else>启用</text>
                </view>
              </view>

              <view class="row-meta">
                <text v-if="item.contact" class="row-meta-item">
                  联系人：{{ item.contact }}
                </text>
                <text v-if="item.phone" class="row-meta-item">
                  电话：{{ item.phone }}
                </text>
              </view>

              <view class="row-meta">
                <text v-if="item.address" class="row-meta-item">
                  地址：{{ item.address }}
                </text>
              </view>

              <view class="row-meta">
                <text v-if="item.default_unit_price != null" class="row-meta-item strong">
                  默认单价：{{ item.default_unit_price }} 元 /
                  {{ getPriceUnitLabel(item.default_price_unit) }}
                </text>
              </view>

              <view v-if="item.remark" class="row-remark">
                备注：{{ item.remark }}
              </view>
            </view>

            <!-- 行右侧按钮：只有管理员才显示 -->
            <view class="row-actions" v-if="isAdmin" @click.stop>
              <button class="btn-mini" @click="goEdit(item)">编辑</button>
              <button class="btn-mini danger" @click="onRemove(item)">删除</button>
            </view>
          </view>

          <view class="list-footer">
            <text v-if="finished">没有更多了</text>
            <text v-else-if="loading">加载中…</text>
            <text v-else @click="loadMore" class="load-more">加载更多</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import BackToDashboardBar from '@/components/BackToDashboardBar.vue'
import {
  ensureLogin,
  getToken,
  getTokenMeta,
  getUserInfo,
  isAdminRole,
  isTokenExpired
} from '@/common/auth.js'

export default {
  components: {
    BackToDashboardBar
  },
  data() {
    return {
      keyword: '',
      filterActive: 'all', // all / active / inactive

      customers: [],
      loading: false,
      finished: false,
      page: 1,
      pageSize: 30,

      // 当前登录用户信息（用于权限）
      userInfo: {}
    }
  },

  computed: {
    // 是否为管理员：只有 admin 才能新增 / 编辑 / 删除
    isAdmin() {
      return isAdminRole(this.userInfo)
    }
  },

  onLoad() {
    // 从本地读取一次用户信息
    this.userInfo = getUserInfo() || {}
    if (!ensureLogin()) return
    this.fetchList(true)
  },
  // 从编辑页返回时会触发这里，再拉一次最新数据
  onShow() {
    // 保守起见，每次显示时也同步一下用户信息（防止后台改了角色）
    this.userInfo = getUserInfo() || {}
    if (!ensureLogin()) return
    this.fetchList(true)
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.fetchList(true).finally(() => {
      uni.stopPullDownRefresh()
    })
  },

  // 触底加载更多（H5 / 小程序）
  onReachBottom() {
    this.loadMore()
  },

  methods: {
    getValidToken() {
      const token = getToken()
      const meta = getTokenMeta()

      if (!token || isTokenExpired(meta)) {
        uni.showToast({ title: '登录已过期，请重新登录', icon: 'none' })
        ensureLogin()
        return ''
      }

      return token
    },

    async fetchList(reset = false) {
      if (this.loading) return
      if (reset) {
        this.page = 1
        this.customers = []
        this.finished = false
      }
      if (this.finished) return

      this.loading = true

      try {
        const token = this.getValidToken()
        const res = await uniCloud.callFunction({
          name: 'crm-customer',
          data: {
            action: 'list',
            token,
            data: {
              keyword: this.keyword,
              is_active:
                this.filterActive === 'all'
                  ? undefined
                  : this.filterActive === 'active'
                  ? true
                  : false,
              page: this.page,
              pageSize: this.pageSize
            }
          }
        })

        const result = res.result || {}
        if (result.code === 401) return ensureLogin()

        if (result.code !== 0) {
          uni.showToast({
            title: result.msg || '加载失败',
            icon: 'none'
          })
          return
        }

        const list = result.data || []
        if (reset) {
          this.customers = list
        } else {
          this.customers = this.customers.concat(list)
        }

        if (list.length < this.pageSize) {
          this.finished = true
        } else {
          this.page += 1
        }
      } catch (e) {
        console.error('加载客户列表异常', e)
        uni.showToast({
          title: '请求出错',
          icon: 'none'
        })
      } finally {
        this.loading = false
      }
    },

    onSearch() {
      this.fetchList(true)
    },
    clearKeyword() {
      this.keyword = ''
      this.fetchList(true)
    },
    onFilterChange(type) {
      if (this.filterActive === type) return
      this.filterActive = type
      this.fetchList(true)
    },
    getPriceUnitLabel(unit) {
      if (unit === 'bottle') return '瓶'
      if (unit === 'm3') return 'm³'
      return 'kg'
    },
    loadMore() {
      this.fetchList(false)
    },

    // 行点击：普通用户只能看详情（你如果有只读详情页，可以在这里跳转），
    // 目前你的需求是“客户管理普通用户只能看列表不编辑”，
    // 那就直接 return，不跳转。
    onRowClick(item) {
      if (!this.isAdmin) {
        // 如果你以后想给普通用户一个“只读详情页”，可以在这里写 navigateTo
        return
      }
      this.goEdit(item)
    },

    goCreate() {
      if (!this.isAdmin) {
        return uni.showToast({
          title: '当前账号无权限新增客户',
          icon: 'none'
        })
      }
      uni.navigateTo({
        url: '/pages/customer/edit'
      })
    },
    goEdit(item) {
      if (!this.isAdmin) {
        return uni.showToast({
          title: '当前账号无权限编辑客户',
          icon: 'none'
        })
      }
      uni.navigateTo({
        url: '/pages/customer/edit?id=' + item._id
      })
    },

    async onRemove(item) {
      if (!this.isAdmin) {
        return uni.showToast({
          title: '当前账号无权限删除客户',
          icon: 'none'
        })
      }

      uni.showModal({
        title: '确认删除',
        content: `确定要删除客户「${item.name || ''}」吗？\n删除后不可恢复，请谨慎操作。`,
        success: async (res) => {
          if (!res.confirm) return

          try {
            const token = this.getValidToken()
            const r = await uniCloud.callFunction({
              name: 'crm-customer',
              data: {
                action: 'remove',
                token,
                data: {
                  id: item._id
                }
              }
            })

            const result = r.result || {}
            if (result.code !== 0) {
              return uni.showToast({
                title: result.msg || '删除失败',
                icon: 'none'
              })
            }

            uni.showToast({
              title: '已删除',
              icon: 'success'
            })

            // 从当前列表移除
            this.customers = this.customers.filter(c => c._id !== item._id)
          } catch (e) {
            console.error('删除客户失败', e)
            uni.showToast({
              title: '删除失败',
              icon: 'none'
            })
          }
        }
      })
    }
  }
}
</script>

<style scoped>
  .page {
    min-height: 100vh;
    background-color: #f2f4f9;
    padding: 24rpx 16rpx 40rpx;
    box-sizing: border-box;
  }

  .page-inner {
    width: 100%;
    max-width: 1600rpx;
    margin: 0 auto;
  }

  /* 顶部标题区 */
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
    color: #949aac;
  }

  .page-header-right {
    display: flex;
    align-items: center;
  }

  /* 按钮 */
  .btn-primary {
    padding: 14rpx 24rpx;
    border-radius: 999rpx;
    background: linear-gradient(135deg, #2979ff, #1a98ff);
    color: #ffffff;
    font-size: 26rpx;
    border: none;
    box-shadow: 0 12rpx 26rpx rgba(26, 120, 255, 0.32);
  }

  .btn-primary::after {
    border: none;
  }

  /* 卡片 */
  .card {
    background-color: #ffffff;
    border-radius: 16rpx;
    padding: 20rpx 24rpx;
    margin-bottom: 20rpx;
    box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.03);
  }

  /* 搜索 + 筛选 */
  .filter-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    row-gap: 16rpx;
  }

  .search-wrapper {
    flex: 1;
    height: 80rpx;
    border-radius: 999rpx;
    background: #f5f7fc;
    display: flex;
    align-items: center;
    padding: 0 26rpx;
    box-sizing: border-box;
  }

  .search-input {
    flex: 1;
    height: 100%;
    border: none;
    background: transparent;
    font-size: 26rpx;
    color: #222;
  }

  .search-input::placeholder {
    color: #a0a6b8;
  }

  .search-clear {
    margin-left: 8rpx;
    font-size: 32rpx;
    color: #c0c4d4;
  }

  /* 分段选择 */
  .segmented {
    margin-left: 16rpx;
    display: flex;
    border-radius: 999rpx;
    background: #f4f5fb;
    padding: 4rpx;
  }

  .seg-item {
    padding: 8rpx 18rpx;
    border-radius: 999rpx;
    font-size: 24rpx;
    color: #6b7280;
  }

  .seg-item.active {
    background: #ffffff;
    color: #2563eb;
    box-shadow: 0 4rpx 10rpx rgba(37, 99, 235, 0.15);
  }

  /* 列表行 */
  .customer-row {
    padding: 18rpx 4rpx;
    border-bottom: 1rpx solid #f0f0f0;
    display: flex;
    justify-content: space-between;
    column-gap: 16rpx;
  }

  .customer-row:last-child {
    border-bottom-width: 0;
  }

  .row-main {
    flex: 1;
  }

  .row-title-line {
    display: flex;
    align-items: center;
    margin-bottom: 6rpx;
  }

  .row-name {
    font-size: 28rpx;
    font-weight: 600;
    color: #111827;
    margin-right: 8rpx;
  }

  .status-tag {
    padding: 4rpx 12rpx;
    border-radius: 999rpx;
    background: #ecfdf3;
    font-size: 22rpx;
    color: #16a34a;
  }

  .status-tag.inactive {
    background: #fef2f2;
    color: #dc2626;
  }

  .row-meta {
    margin-top: 2rpx;
    display: flex;
    flex-wrap: wrap;
  }

  .row-meta-item {
    font-size: 22rpx;
    color: #6b7280;
    margin-right: 16rpx;
  }

  .row-meta-item.strong {
    color: #374151;
    font-weight: 500;
  }

  .row-remark {
    margin-top: 4rpx;
    font-size: 22rpx;
    color: #9ca3af;
  }

  /* 行右侧按钮 */
  .row-actions {
    display: flex;
    flex-direction: column;
    row-gap: 10rpx;
    align-items: flex-end;
    justify-content: center;
  }

  .btn-mini {
    min-width: 120rpx;
    padding: 6rpx 14rpx;
    border-radius: 999rpx;
    font-size: 22rpx;
    color: #2563eb;
    border: 1rpx solid rgba(129, 140, 248, 0.5);
    background: #f9fafb;
  }

  .btn-mini::after {
    border: none;
  }

  .btn-mini.danger {
    color: #dc2626;
    border-color: rgba(248, 113, 113, 0.6);
  }

  /* 空态 & 底部 */
  .empty {
    padding: 32rpx 10rpx;
    text-align: center;
  }

  .empty-main {
    font-size: 26rpx;
    color: #4b5563;
  }

  .empty-sub {
    margin-top: 6rpx;
    font-size: 22rpx;
    color: #9ca3af;
  }

  .list-footer {
    padding-top: 12rpx;
    text-align: center;
    font-size: 22rpx;
    color: #9ca3af;
  }

  .load-more {
    color: #2563eb;
  }
</style>
