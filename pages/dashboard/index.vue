<template>
	<view class="dashboard-page">
		<view class="dashboard-inner">
			<!-- 顶部横幅：保持原样 -->
			<view class="top-hero">
				<view class="hero-left">
					<view class="hero-logo">
						<text class="hero-logo-icon">logo</text>
					</view>
					<view class="hero-text">
						<view class="hero-title">新拓能源</view>
					</view>
				</view>
				<view class="hero-right">
					<view class="hero-user-tag">
						<view class="hero-avatar">
							<text class="hero-avatar-text">
								{{ (userInfo.username || 'admin').slice(0, 1).toUpperCase() }}
							</text>
						</view>
						<view class="hero-user-text">
                                                        <!-- 根据角色显示 -->
                                                        <text class="hero-user-role">
                                                                {{ isSuperAdmin ? '超级管理员' : (isAdmin ? '管理员' : '普通员工') }}
                                                        </text>
						</view>
					</view>
				</view>
			</view>

			<!-- 顶部横幅下：左侧侧边栏 + 右侧主内容 -->
			<view class="layout-main">
				<!-- 侧边栏：分组 + 商务风 -->
				<view class="sidebar">
					<!-- 日常操作 -->
					<view class="sidebar-section">
						<view class="sidebar-section-title">日常操作</view>

						<!-- 只有管理员可以看到“新增销售记录” -->
						<view v-if="isAdmin" class="sidebar-item" :class="{ active: activeMenu === 'sale' }"
							@click="goPage('/pages/sale/edit', 'sale')">
							<view class="sidebar-badge sidebar-badge-primary">
								<text class="sidebar-badge-text">记</text>
							</view>
							<text class="sidebar-text">新增销售记录</text>
						</view>

						<view class="sidebar-item" :class="{ active: activeMenu === 'sale-list' }"
							@click="goPage('/pages/sale/list', 'sale-list')">
							<view class="sidebar-badge">
								<text class="sidebar-badge-text">销</text>
							</view>
							<text class="sidebar-text">销售记录列表</text>
						</view>

						<view class="sidebar-item" :class="{ active: activeMenu === 'bill' }"
							@click="goPage('/pages/bill/monthly', 'bill')">
							<view class="sidebar-badge">
								<text class="sidebar-badge-text">账</text>
							</view>
							<text class="sidebar-text">对账单</text>
						</view>

						<!-- 灌装入口 -->
						<view class="sidebar-item" :class="{ active: activeMenu === 'filling' }"
							@click="goPage('/pages/filling/index', 'filling')">
							<view class="sidebar-badge sidebar-badge-accent">
								<text class="sidebar-badge-text">灌</text>
							</view>
							<text class="sidebar-text">灌装管理</text>
						</view>

						<!-- 天然气入库 -->
						<view class="sidebar-item" :class="{ active: activeMenu === 'gas-in' }"
							@click="goPage('/pages/gas/inbound', 'gas-in')">
							<view class="sidebar-badge">
								<text class="sidebar-badge-text">气</text>
							</view>
							<text class="sidebar-text">天然气入库</text>
						</view>
					</view>

					<!-- 基础资料 -->
					<view class="sidebar-section">
						<view class="sidebar-section-title">基础资料</view>

						<view class="sidebar-item" :class="{ active: activeMenu === 'customer' }"
							@click="goPage('/pages/customer/list', 'customer')">
							<view class="sidebar-badge">
								<text class="sidebar-badge-text">客</text>
							</view>
							<text class="sidebar-text">客户管理</text>
						</view>

						<view class="sidebar-item" :class="{ active: activeMenu === 'vehicle' }"
							@click="goPage('/pages/vehicle/list', 'vehicle')">
							<view class="sidebar-badge">
								<text class="sidebar-badge-text">车</text>
							</view>
							<text class="sidebar-text">车辆管理</text>
						</view>

                                                <view class="sidebar-item" :class="{ active: activeMenu === 'delivery' }"
                                                        @click="goPage('/pages/delivery/list', 'delivery')">
                                                        <view class="sidebar-badge">
                                                                <text class="sidebar-badge-text">配</text>
                                                        </view>
                                                        <text class="sidebar-text">配送员管理</text>
                                                </view>

                                                <view
                                                        v-if="isSuperAdmin"
                                                        class="sidebar-item"
                                                        :class="{ active: activeMenu === 'roles' }"
                                                        @click="goPage('/pages/admin/roles', 'roles')"
                                                >
                                                        <view class="sidebar-badge sidebar-badge-primary">
                                                                <text class="sidebar-badge-text">权</text>
                                                        </view>
                                                        <text class="sidebar-text">角色与权限</text>
                                                </view>


                                                <view
                                                        v-if="isSuperAdmin"
                                                        class="sidebar-item"
                                                        :class="{ active: activeMenu === 'logs' }"
                                                        @click="goPage('/pages/admin/logs', 'logs')"
                                                >
                                                        <view class="sidebar-badge sidebar-badge-primary">
                                                                <text class="sidebar-badge-text">记</text>
                                                        </view>
                                                        <text class="sidebar-text">操作日志</text>
                                                </view>

						<view class="sidebar-item" :class="{ active: activeMenu === 'bottle' }"
							@click="goPage('/pages/bottle/manage', 'bottle')">
							<view class="sidebar-badge">
								<text class="sidebar-badge-text">瓶</text>
							</view>
							<text class="sidebar-text">瓶子管理</text>
						</view>
					</view>

					<!-- 底部：退出登录 -->
					<view class="sidebar-footer">
						<view class="sidebar-divider"></view>
						<view class="sidebar-item danger" @click="handleLogout">
							<view class="sidebar-badge sidebar-badge-danger">
								<text class="sidebar-badge-text">退</text>
							</view>
							<text class="sidebar-text">退出登录</text>
						</view>
					</view>
				</view>

				<!-- 右侧主内容 -->
				<view class="main-content">
					<!-- 今日概览 -->
					<view class="card card-stats">
						<view class="card-header">
							<view class="card-title">今日概览</view>
							<view class="card-sub">出气量、销售额、未收款与天然气库存</view>
						</view>
						<view class="stats-row">
							<!-- 当前天然气库存 -->
							<view class="stat-card" @click="handleStatClick('gas_stock')">
								<view class="stat-icon-box blue">
									<text class="stat-icon">存</text>
								</view>
								<view class="stat-body">
									<text class="stat-label">当前天然气库存</text>
									<view class="stat-value-row">
										<text class="stat-value">{{ formatKgToTon(stats.gas_stock) }}</text>
										<text class="stat-unit">吨</text>
									</view>
									<text class="stat-tip">按入库净重减去销售净重自动估算</text>
								</view>
							</view>

							<!-- 今日出气量 -->
							<view class="stat-card" @click="handleStatClick('today_weight')">
								<view class="stat-icon-box blue">
									<text class="stat-icon">气</text>
								</view>
								<view class="stat-body">
									<text class="stat-label">今日出气量</text>
									<view class="stat-value-row">
										<text class="stat-value">{{ formatNumber(stats.today_weight, 0) }}</text>
										<text class="stat-unit">kg</text>
									</view>
									<text class="stat-tip">含所有客户的出瓶净重</text>
								</view>
							</view>

							<!-- 今日销售额 -->
							<view class="stat-card" @click="handleStatClick('today_amount')">
								<view class="stat-icon-box green">
									<text class="stat-icon">￥</text>
								</view>
								<view class="stat-body">
									<text class="stat-label">今日销售额</text>
									<view class="stat-value-row">
										<text class="stat-value">{{ formatNumber(stats.today_amount, 2) }}</text>
										<text class="stat-unit">元</text>
									</view>
									<text class="stat-tip">按实收金额汇总</text>
								</view>
							</view>

							<!-- 本月累计销售 -->
							<view class="stat-card" @click="handleStatClick('month_amount')">
								<view class="stat-icon-box purple">
									<text class="stat-icon">月</text>
								</view>
								<view class="stat-body">
									<text class="stat-label">本月累计销售</text>
									<view class="stat-value-row">
										<text class="stat-value">{{ formatNumber(stats.month_amount, 2) }}</text>
										<text class="stat-unit">元</text>
									</view>
									<text class="stat-tip">本月截至目前总销售额</text>
								</view>
							</view>

							<!-- 本月未收款 -->
							<view class="stat-card" @click="handleStatClick('month_unpaid')">
								<view class="stat-icon-box orange">
									<text class="stat-icon">账</text>
								</view>
								<view class="stat-body">
									<text class="stat-label">本月未收款</text>
									<view class="stat-value-row">
										<text class="stat-value">{{ formatNumber(stats.month_unpaid, 2) }}</text>
										<text class="stat-unit">元</text>
									</view>
									<text class="stat-tip">挂账客户待收金额</text>
								</view>
							</view>
						</view>
					</view>

					<!-- 常用操作 -->
					<view class="card card-actions">
						<view class="card-header">
							<view class="card-title">常用操作</view>
							<view class="card-sub">高频入口，提升日常记录效率</view>
						</view>

						<view class="actions-grid">
							<!-- 新增销售记录：仅管理员显示 -->
							<view v-if="isAdmin" class="action-item" @click="goPage('/pages/sale/edit', 'sale')">
								<view class="action-text">
									<view class="action-title-row">
										<view class="action-icon action-icon-record">
											<text class="action-icon-text">记</text>
										</view>
										<text class="action-title">新增销售记录</text>
									</view>
									<text class="action-sub">记录出瓶、回瓶、净重与应收款</text>
								</view>
							</view>

							<!-- 客户管理 -->
							<view class="action-item" @click="goPage('/pages/customer/list', 'customer')">
								<view class="action-text">
									<view class="action-title-row">
										<view class="action-icon action-icon-customer">
											<text class="action-icon-text">客</text>
										</view>
										<text class="action-title">客户管理</text>
									</view>
									<text class="action-sub">维护客户资料、地址与价格策略</text>
								</view>
							</view>

							<!-- 车辆管理 -->
							<view class="action-item" @click="goPage('/pages/vehicle/list', 'vehicle')">
								<view class="action-text">
									<view class="action-title-row">
										<view class="action-icon action-icon-vehicle">
											<text class="action-icon-text">车</text>
										</view>
										<text class="action-title">车辆管理</text>
									</view>
									<text class="action-sub">管理送气车辆、车牌与状态</text>
								</view>
							</view>

							<!-- 配送员管理 -->
							<view class="action-item" @click="goPage('/pages/delivery/list', 'delivery')">
								<view class="action-text">
									<view class="action-title-row">
										<view class="action-icon action-icon-delivery">
											<text class="action-icon-text">配</text>
										</view>
										<text class="action-title">配送员管理</text>
									</view>
									<text class="action-sub">
										维护配送员信息、联系方式与状态
									</text>
								</view>
							</view>

							<!-- 灌装管理 -->
							<view class="action-item" @click="goPage('/pages/filling/index', 'filling')">
								<view class="action-text">
									<view class="action-title-row">
										<view class="action-icon action-icon-record">
											<text class="action-icon-text">灌</text>
										</view>
										<text class="action-title">灌装管理</text>
									</view>
									<text class="action-sub">记录罐车灌装、亏损与入库数据</text>
								</view>
							</view>

							<!-- 天然气入库 -->
							<view class="action-item" @click="goPage('/pages/gas/inbound', 'gas-in')">
								<view class="action-text">
									<view class="action-title-row">
										<view class="action-icon action-icon-record">
											<text class="action-icon-text">气</text>
										</view>
										<text class="action-title">天然气入库</text>
									</view>
									<text class="action-sub">维护每车 LNG 入库净重与金额</text>
								</view>
							</view>
						</view>
					</view>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
        import {
                ensureLogin,
                getUserInfo,
                clearAuth,
                goLogin,
                isAdminRole,
                isSuperAdmin as isSuperAdminRole
        } from '@/common/auth.js'

	export default {
		data() {
			return {
				userInfo: {},
				activeMenu: 'dashboard',
				stats: {
					today_weight: 0, // 今日出气量 kg
					today_amount: 0, // 今日销售额 元（实收）
					month_amount: 0, // 本月累计销售 元
					month_unpaid: 0, // 本月未收款 元
					gas_stock: 0 // 当前天然气库存 kg（后端按 kg 给，这里转吨展示）
				}
			}
		},

		computed: {
                        // 只有 role === 'user' 当普通用户，其它（admin/空）都当管理员，兼容老账号
                        isAdmin() {
                                return isAdminRole(this.userInfo)
                        },

                        isSuperAdmin() {
                                return isSuperAdminRole(this.userInfo)
                        }
                },

		onLoad() {
			// 1. 校验登录
			if (!ensureLogin()) return

			// 2. 初始化用户信息
			this.userInfo = getUserInfo() || {}
			this.activeMenu = 'dashboard'

			// 3. 拉取首页统计数据
			this.fetchStats()
		},

		onShow() {
			// 1. 再次校验登录（防止后台停留太久 token 过期）
			if (!ensureLogin()) return

			// 2. 刷新统计数据，确保今日出气量 / 销售额与最新数据一致
			this.fetchStats()
		},

		methods: {
			async fetchStats() {
				const token =
					uni.getStorageSync('crm_token') || uni.getStorageSync('token') || ''
				if (!token) {
					// 本地连 token 都没有，走通用登录流程
					uni.showModal({
						title: '提示',
						content: '登录状态已失效，请重新登录',
						showCancel: false,
						success: () => {
							clearAuth()
							goLogin()
						}
					})
					return
				}

				try {
					const res = await uniCloud.callFunction({
						name: 'crm-dashboard',
						data: {
							action: 'summary',
							token
						}
					})
					const result = res.result || {}

					// 🔴 关键：跟 customer/list 一样的 401 处理
					if (result.code === 401) {
						uni.showModal({
							title: '提示',
							content: result.msg || '登录已过期，请重新登录',
							showCancel: false,
							success: () => {
								clearAuth()
								goLogin()
								// 或者你想完全对齐 customer/list，也可以用：
								uni.clearStorageSync()
								uni.reLaunch({
									url: '/pages/login/login'
								})
							}
						})
						return
					}

					if (result.code === 0 && result.data) {
						this.stats = Object.assign({}, this.stats, result.data)
					} else {
						console.warn('fetchStats error:', result.msg)
					}
				} catch (e) {
					console.error('fetchStats exception:', e)
				}
			},

			formatNumber(v, digits = 2) {
				const n = Number(v)
				if (Number.isNaN(n)) return 0
				return n.toFixed(digits)
			},

			// kg → 吨
			formatKgToTon(v, digits = 3) {
				const n = Number(v)
				if (Number.isNaN(n)) return 0
				return (n / 1000).toFixed(digits)
			},

			formatDate(d) {
				const date = d instanceof Date ? d : new Date(d)
				const y = date.getFullYear()
				const m = String(date.getMonth() + 1).padStart(2, '0')
				const day = String(date.getDate()).padStart(2, '0')
				return `${y}-${m}-${day}`
			},

			// 今日范围：yyyy-MM-dd ~ yyyy-MM-dd
			getTodayRange() {
				const today = new Date()
				const d = this.formatDate(today)
				return {
					start: d,
					end: d
				}
			},

			// 本月范围：月初 ~ 今天 + 月份字符串
			getMonthRange() {
				const now = new Date()
				const startDate = new Date(now.getFullYear(), now.getMonth(), 1)
				const start = this.formatDate(startDate)
				const end = this.formatDate(now)
				const month = `${now.getFullYear()}-${String(
        now.getMonth() + 1
      ).padStart(2, '0')}`
				return {
					start,
					end,
					month
				}
			},

			goPage(url, key) {
				if (key) {
					this.activeMenu = key
				}

				// 点“工作台总览”就是当前页，不跳
				if (!url || url === '/pages/dashboard/index') {
					return
				}

				// 非管理员禁止直接跳“新增销售记录”页（双保险）
				if (url.startsWith('/pages/sale/edit') && !this.isAdmin) {
					uni.showToast({
						title: '当前账号无权限新增销售记录',
						icon: 'none'
					})
					return
				}

				uni.navigateTo({
					url
				})
			},

			handleLogout() {
				uni.showModal({
					title: '退出登录',
					content: '确定要退出当前账号吗？',
					success: (res) => {
						if (res.confirm) {
							clearAuth()
							goLogin()
						}
					}
				})
			},

			// 点击统计卡片跳转（与 sale/list 的口径对齐）
			handleStatClick(type) {
				switch (type) {
					case 'gas_stock': {
						// 当前天然气库存 → 本月入库台账（带上本月起止日期）
						const {
							start,
							end
						} = this.getMonthRange()
						this.goPage(
							`/pages/gas/inbound?date_from=${start}&date_to=${end}`,
							'gas-in'
						)
						break
					}

					case 'today_weight': {
						// 今日出气量 → 今日销售记录列表（让 sale/list 用单日范围算“今日出气量”）
						const {
							start,
							end
						} = this.getTodayRange()
						this.goPage(
							`/pages/sale/list?date_from=${start}&date_to=${end}`,
							'sale-list'
						)
						break
					}

					case 'today_amount': {
						// 今日销售额 → 今日销售记录列表（与上面同一口径）
						const {
							start,
							end
						} = this.getTodayRange()
						this.goPage(
							`/pages/sale/list?date_from=${start}&date_to=${end}`,
							'sale-list'
						)
						break
					}

					case 'month_amount':
					case 'month_unpaid': {
						// 本月累计销售 / 本月未收款 → 本月对账单
						const {
							start,
							end,
							month
						} = this.getMonthRange()
						this.goPage(
							`/pages/bill/monthly?month=${month}&date_from=${start}&date_to=${end}`,
							'bill'
						)
						break
					}

					default:
						break
				}
			}
		}
	}
</script>

<style scoped>
	.dashboard-page {
		min-height: 100vh;
		box-sizing: border-box;
		padding: 24rpx 0 40rpx;
		background: linear-gradient(180deg,
				#f9fbff 0%,
				#f3f6fc 130rpx,
				#f2f4f9 100%);
	}

	/* 中心容器：大屏居中，小屏占满 */
	.dashboard-inner {
		width: 100%;
		max-width: 1200px;
		margin: 0 auto;
		padding: 0 24rpx;
		box-sizing: border-box;
	}

	/* 顶部横幅 */
	.top-hero {
		margin-bottom: 24rpx;
		padding: 30rpx 32rpx;
		border-radius: 28rpx;
		background: linear-gradient(135deg, #f6faff 0%, #eff6ff 50%, #ffffff 100%);
		display: flex;
		justify-content: space-between;
		align-items: center;
		box-shadow: 0 14rpx 38rpx rgba(34, 71, 140, 0.06);
	}

	.hero-left {
		display: flex;
		align-items: center;
	}

	.hero-logo {
		width: 80rpx;
		height: 80rpx;
		border-radius: 18rpx;
		background: linear-gradient(135deg, #2f7cff, #4ac5ff);
		display: flex;
		align-items: center;
		justify-content: center;
		margin-right: 20rpx;
		box-shadow:
			0 18rpx 42rpx rgba(20, 80, 180, 0.35),
			0 0 0 0 rgba(69, 135, 255, 0.55);
		animation: hero-logo-glow 3.6s ease-in-out infinite;
	}

	.hero-logo-icon {
		font-size: 40rpx;
		color: #fff;
		font-weight: 700;
	}

	.hero-text {
		display: flex;
		flex-direction: column;
	}

	.hero-title {
		font-size: 32rpx;
		font-weight: 700;
		color: #1f2430;
	}

	.hero-right {
		display: flex;
		align-items: center;
	}

	.hero-user-tag {
		padding: 10rpx 16rpx;
		border-radius: 999rpx;
		background: rgba(255, 255, 255, 0.96);
		box-shadow: 0 6rpx 16rpx rgba(0, 0, 0, 0.06);
		display: flex;
		align-items: center;
	}

	.hero-avatar {
		width: 48rpx;
		height: 48rpx;
		border-radius: 50%;
		background: linear-gradient(135deg, #2979ff, #4ab2ff);
		display: flex;
		align-items: center;
		justify-content: center;
		margin-right: 12rpx;
	}

	.hero-avatar-text {
		color: #fff;
		font-size: 26rpx;
		font-weight: 700;
	}

	.hero-user-text {
		display: flex;
		flex-direction: column;
		justify-content: center;
	}

	.hero-user-role {
		font-size: 22rpx;
		color: #4d5cff;
		line-height: 1.1;
	}

	/* 顶部下面的两栏布局 */
	.layout-main {
		margin-top: 8rpx;
		display: flex;
		align-items: stretch;
	}

	/* 侧边栏 */
	.sidebar {
		width: 300rpx;
		flex-shrink: 0;
		padding: 20rpx 18rpx;
		border-radius: 24rpx;
		background: rgba(255, 255, 255, 0.96);
		box-shadow: 0 12rpx 32rpx rgba(15, 35, 52, 0.06);
		border: 1rpx solid rgba(240, 242, 247, 0.9);
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
	}

	.sidebar-section {
		margin-bottom: 16rpx;
	}

	.sidebar-section-title {
		font-size: 22rpx;
		color: #9ca3af;
		margin-bottom: 8rpx;
	}

	.sidebar-item {
		height: 60rpx;
		border-radius: 18rpx;
		padding: 0 10rpx;
		display: flex;
		align-items: center;
		box-sizing: border-box;
		margin-bottom: 6rpx;
		font-size: 24rpx;
		color: #4b5563;
		transition: all 0.18s ease;
	}

	.sidebar-item:last-child {
		margin-bottom: 0;
	}

	.sidebar-badge {
		width: 40rpx;
		height: 40rpx;
		border-radius: 999rpx;
		background: #f3f4ff;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-right: 8rpx;
		border: 1rpx solid #e0e7ff;
	}

	.sidebar-badge-primary {
		background: linear-gradient(135deg, #e2f0ff, #d3e6ff);
		border-color: #c7d2fe;
	}

	.sidebar-badge-accent {
		background: linear-gradient(135deg, #fef3c7, #fee9a8);
		border-color: #fde68a;
	}

	.sidebar-badge-danger {
		background: #fef2f2;
		border-color: #fecaca;
	}

	.sidebar-badge-text {
		font-size: 22rpx;
		font-weight: 600;
		color: #4b5563;
	}

	.sidebar-text {
		flex: 1;
		font-size: 24rpx;
		color: #374151;
	}

	.sidebar-item.active {
		background: linear-gradient(135deg, #edf3ff, #e3edff);
		color: #1f2937;
		font-weight: 600;
	}

	.sidebar-item.active .sidebar-text {
		color: #111827;
	}

	.sidebar-item.active .sidebar-badge {
		box-shadow: 0 0 0 1rpx rgba(79, 70, 229, 0.18);
	}

	.sidebar-item:not(.active):hover {
		background: #f5f7fb;
	}

	.sidebar-item.danger {
		color: #dc2626;
	}

	.sidebar-item.danger .sidebar-text {
		color: #b91c1c;
	}

	.sidebar-item.danger:hover {
		background: #fef2f2;
	}

	.sidebar-divider {
		height: 1rpx;
		background: #edf0f7;
		margin: 6rpx 0 10rpx;
	}

	.sidebar-footer {
		margin-top: auto;
	}

	/* 主内容区域 */
	.main-content {
		flex: 1;
		margin-left: 24rpx;
		display: flex;
		flex-direction: column;
	}

	/* 卡片通用 */
	.card {
		background: #ffffff;
		border-radius: 26rpx;
		box-shadow: 0 12rpx 32rpx rgba(15, 35, 52, 0.04);
		padding: 32rpx 36rpx;
		box-sizing: border-box;
		margin-bottom: 24rpx;
		border: 1rpx solid rgba(240, 242, 247, 0.9);
	}

	/* 右侧最后一张卡片不再额外撑高布局，保证左右白块底边齐平 */
	.main-content .card:last-of-type {
		margin-bottom: 0;
	}

	.card-header {
		display: flex;
		flex-direction: column;
		margin-bottom: 14rpx;
	}

	.card-title {
		font-size: 28rpx;
		font-weight: 600;
		color: #222;
	}

	.card-sub {
		margin-top: 4rpx;
		font-size: 22rpx;
		color: #9aa0ae;
	}

	/* 今日概览 */
	.stats-row {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-start;
		column-gap: 24rpx;
		row-gap: 24rpx;
	}

	.stat-card {
		width: calc((100% - 48rpx) / 3);
		background: #f8faff;
		border-radius: 26rpx;
		padding: 30rpx 30rpx;
		box-sizing: border-box;
		border: 1rpx solid rgba(235, 238, 245, 0.9);
		transition: all 0.25s ease;
		display: flex;
		flex-direction: column;
		cursor: default;
		cursor: pointer;
	}

	.stat-card:hover {
		box-shadow: 0 14rpx 40rpx rgba(0, 0, 0, 0.06);
		transform: translateY(-3rpx);
		background: #f9fbff;
		border-color: rgba(210, 220, 245, 0.9);
	}

	.stat-icon-box {
		width: 66rpx;
		height: 66rpx;
		border-radius: 22rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 18rpx;
	}

	.stat-icon-box.blue {
		background: linear-gradient(135deg, #e6f0ff, #d9e7ff);
	}

	.stat-icon-box.green {
		background: linear-gradient(135deg, #e8faf0, #d6f4e4);
	}

	.stat-icon-box.purple {
		background: linear-gradient(135deg, #f1e9ff, #e8ddff);
	}

	.stat-icon-box.orange {
		background: linear-gradient(135deg, #fff2e2, #ffe7ce);
	}

	.stat-icon {
		font-size: 26rpx;
		font-weight: 700;
		color: #1f2430;
	}

	.stat-body {
		flex: 1;
	}

	.stat-label {
		font-size: 26rpx;
		color: #333;
		margin-bottom: 8rpx;
	}

	.stat-value-row {
		display: flex;
		align-items: baseline;
		margin-bottom: 8rpx;
	}

	.stat-value {
		font-size: 40rpx;
		font-weight: 700;
		color: #222;
	}

	.stat-unit {
		font-size: 22rpx;
		color: #999;
		margin-left: 4rpx;
	}

	.stat-tip {
		font-size: 22rpx;
		color: #a0a4b3;
		line-height: 1.6;
	}

	/* 常用操作 */
	.actions-grid {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		column-gap: 20rpx;
		row-gap: 20rpx;
	}

	.action-item {
		width: calc(50% - 10rpx);
		background: #f8faff;
		border-radius: 24rpx;
		padding: 26rpx 26rpx;
		box-sizing: border-box;
		border: 1rpx solid rgba(235, 238, 245, 0.9);
		display: flex;
		align-items: flex-start;
		transition: all 0.24s ease;
		min-height: 160rpx;
		cursor: pointer;
	}

	.action-item:hover {
		box-shadow: 0 12rpx 30rpx rgba(0, 0, 0, 0.05);
		transform: translateY(-2rpx);
	}

	.action-title-row {
		display: flex;
		align-items: center;
		margin-bottom: 6rpx;
	}

	.action-icon {
		padding: 4rpx 12rpx;
		border-radius: 999rpx;
		border-width: 1rpx;
		border-style: solid;
		background: rgba(255, 255, 255, 0.9);
		display: flex;
		align-items: center;
		justify-content: center;
		margin-right: 10rpx;
	}

	.action-icon-record {
		background: linear-gradient(135deg, #e2f0ff, #d3e6ff);
	}

	.action-icon-customer {
		background: linear-gradient(135deg, #e6f3ff, #d9e9ff);
	}

	.action-icon-vehicle {
		background: linear-gradient(135deg, #f0ecff, #e3ddff);
	}

	.action-icon-delivery {
		background: linear-gradient(135deg, #fff2e3, #ffe3c5);
	}

	.action-item:hover .action-icon {
		box-shadow: 0 10rpx 22rpx rgba(110, 140, 255, 0.18);
		transform: translateY(-1rpx);
	}

	.action-icon-text {
		font-size: 22rpx;
		font-weight: 600;
		color: #4a5670;
		letter-spacing: 2rpx;
	}

	.action-text {
		display: flex;
		flex-direction: column;
	}

	.action-title {
		font-size: 26rpx;
		font-weight: 600;
		color: #222;
		margin-bottom: 6rpx;
	}

	.action-sub {
		font-size: 22rpx;
		color: #8c92a1;
		line-height: 1.6;
	}

	.text-danger {
		color: #dc2626;
	}

	@keyframes hero-logo-glow {

		0%,
		100% {
			box-shadow:
				0 18rpx 42rpx rgba(20, 80, 180, 0.35),
				0 0 0 0 rgba(69, 135, 255, 0.55);
			transform: translateY(0);
		}

		50% {
			box-shadow:
				0 22rpx 50rpx rgba(20, 80, 180, 0.4),
				0 0 32rpx 10rpx rgba(69, 135, 255, 0.45);
			transform: translateY(-1rpx);
		}
	}

	/* 移动端适配 */
	@media screen and (max-width: 768px) {
		.dashboard-inner {
			padding: 0 16rpx;
		}

		.top-hero {
			padding: 20rpx 22rpx;
			border-radius: 22rpx;
			margin-bottom: 18rpx;
		}

		.hero-title {
			font-size: 30rpx;
		}

		.layout-main {
			flex-direction: column;
		}

		/* 侧边栏折叠成顶部导航条 */
		.sidebar {
			width: 100%;
			margin-bottom: 16rpx;
			padding: 12rpx 10rpx;
			border-radius: 20rpx;
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			justify-content: flex-start;
		}

		.sidebar-section {
			width: 100%;
			margin-bottom: 6rpx;
		}

		.sidebar-section-title {
			width: 100%;
			font-size: 20rpx;
			margin-bottom: 6rpx;
		}

		.sidebar-item {
			height: 56rpx;
			padding: 0 14rpx;
			border-radius: 999rpx;
			margin: 4rpx 6rpx 4rpx 0;
			font-size: 22rpx;
			background: #f8f9ff;
		}

		.sidebar-badge {
			width: 34rpx;
			height: 34rpx;
			margin-right: 6rpx;
		}

		.sidebar-badge-text {
			font-size: 20rpx;
		}

		.sidebar-divider {
			display: none;
		}

		.sidebar-footer {
			width: 100%;
			margin-top: 4rpx;
		}

		.main-content {
			margin-left: 0;
			margin-top: 4rpx;
		}

		/* 卡片整体瘦一点 */
		.card {
			padding: 24rpx 22rpx;
			border-radius: 22rpx;
			margin-bottom: 20rpx;
		}

		.card-title {
			font-size: 26rpx;
		}

		.card-sub {
			font-size: 20rpx;
		}

		/* 今日概览卡片：一列展示 */
		.stats-row {
			column-gap: 0;
		}

		.stat-card {
			width: 100%;
			padding: 20rpx 22rpx;
			margin-bottom: 16rpx;
			border-radius: 22rpx;
		}

		.stat-icon-box {
			width: 54rpx;
			height: 54rpx;
			margin-bottom: 10rpx;
		}

		.stat-icon {
			font-size: 24rpx;
		}

		.stat-label {
			font-size: 24rpx;
		}

		.stat-value {
			font-size: 34rpx;
		}

		.stat-tip {
			font-size: 20rpx;
		}

		/* 常用操作卡片：一列 */
		.actions-grid {
			column-gap: 0;
		}

		.action-item {
			width: 100%;
			padding: 22rpx 22rpx;
			border-radius: 20rpx;
			min-height: 0;
		}

		.action-title {
			font-size: 24rpx;
		}

		.action-sub {
			font-size: 20rpx;
		}

		.main-content .card:last-of-type {
			margin-bottom: 0;
		}
	}
</style>