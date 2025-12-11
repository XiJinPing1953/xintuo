<template>
	<view class="roles-page">
		<view class="roles-inner">
			<BackToDashboardBar back-to="/pages/dashboard/index" text="返回工作台" />

			<view class="card">
				<view class="card-header">
					<text class="card-title">角色与权限管理</text>
					<text class="card-sub">仅超级管理员可见，用于分配管理员/员工权限</text>
				</view>
				<view class="card-body">
					<view class="create-box">
						<view class="create-title">新增用户</view>
						<view class="create-row">
							<input v-model.trim="newUser.username" class="create-input" placeholder="账号（必填）" />
							<input v-model.trim="newUser.password" class="create-input" placeholder="密码（必填）" password />
							<picker mode="selector" :range="roleOptions" range-key="label"
								:value="getRoleIndex(newUser.role)" @change="onNewRoleChange">
								<view class="role-picker small">
									<text>{{ roleLabel(newUser.role) }}</text>
								</view>
							</picker>
							<button class="btn-create" size="mini" :loading="creating" @click="createUser">创建</button>
						</view>
					</view>

					<view v-if="loading" class="empty">
						<text class="empty-text">加载中…</text>
					</view>
					<view v-else-if="users.length === 0" class="empty">
						<text class="empty-text">暂无用户数据</text>
					</view>
					<view v-else class="user-list">
						<view v-for="item in users" :key="item._id" class="user-item">
							<view class="user-main">
								<view class="avatar">{{ (item.username || 'U').slice(0, 1).toUpperCase() }}</view>
								<view class="info">
									<text class="name">{{ item.username || '未命名用户' }}</text>
									<text class="meta">创建于 {{ formatDate(item.created_at) || '-' }}</text>
								</view>
							</view>
							<view class="role-actions">
								<picker mode="selector" :range="roleOptions" range-key="label"
									:value="getRoleIndex(item.role)" @change="(e) => onRoleChange(item, e)"
									:disabled="item.username === 'superadmin'">
									<view class="role-picker" :class="{ disabled: item.username === 'superadmin' }">
										<text>{{ roleLabel(item.role) }}</text>
									</view>
								</picker>
								<text v-if="item.username !== 'superadmin'" class="delete-user"
									@click="removeUser(item)">删除</text>
								<text v-if="savingId === item._id" class="saving">保存中…</text>
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
		ensureLogin,
		getUserInfo,
		isSuperAdmin
	} from '@/common/auth.js'
	import {
		callCloud
	} from '@/common/request.js'

	export default {
		components: {
			BackToDashboardBar
		},
		data() {
			return {
				users: [],
				loading: false,
				savingId: '',
				creating: false,
				newUser: {
					username: '',
					password: '',
					role: 'user'
				},
				roleOptions: [{
						value: 'superadmin',
						label: '超级管理员'
					},
					{
						value: 'admin',
						label: '管理员'
					},
					{
						value: 'user',
						label: '普通员工'
					}
				]
			}
		},
		onLoad() {
			if (!ensureLogin()) return
			const user = getUserInfo() || {}
			if (!isSuperAdmin(user)) {
				uni.showToast({
					title: '仅超级管理员可访问',
					icon: 'none'
				})
				uni.navigateBack()
				return
			}
			this.loadUsers()
		},
		methods: {
			async loadUsers() {
				this.loading = true
				const res = await callCloud('crm-auth', {
					action: 'listUsers'
				})
				this.loading = false
				if (res.code !== 0) return
				this.users = Array.isArray(res.data) ? res.data : []
			},
			getRoleIndex(role) {
				const idx = this.roleOptions.findIndex((r) => r.value === role)
				return idx >= 0 ? idx : 0
			},
			roleLabel(role) {
				const found = this.roleOptions.find((r) => r.value === role)
				return found ? found.label : '未设置'
			},
			formatDate(ts) {
				if (!ts) return ''
				const d = new Date(ts)
				const y = d.getFullYear()
				const m = String(d.getMonth() + 1).padStart(2, '0')
				const day = String(d.getDate()).padStart(2, '0')
				return `${y}-${m}-${day}`
			},
			onNewRoleChange(e) {
				const idx = (e && e.detail && Number(e.detail.value)) || 0
				const option = this.roleOptions[idx]
				if (option) {
					this.newUser.role = option.value
				}
			},
			async createUser() {
				const {
					username,
					password,
					role
				} = this.newUser
				if (!username || !password) {
					uni.showToast({
						title: '请填写账号和密码',
						icon: 'none'
					})
					return
				}
				this.creating = true
				const res = await callCloud('crm-auth', {
					action: 'createUser',
					data: {
						username,
						password,
						role
					}
				})
				this.creating = false
				if (res.code !== 0) return
				uni.showToast({
					title: '已创建用户',
					icon: 'success'
				})
				this.newUser = {
					username: '',
					password: '',
					role: 'user'
				}
				this.loadUsers()
			},
			async onRoleChange(item, e) {
				const idx = (e && e.detail && Number(e.detail.value)) || 0
				const option = this.roleOptions[idx]
				if (!option || option.value === item.role) return
				this.savingId = item._id
				const res = await callCloud('crm-auth', {
					action: 'updateRole',
					data: {
						userId: item._id,
						role: option.value
					}
				})
				this.savingId = ''
				if (res.code !== 0) return
				uni.showToast({
					title: '已更新角色',
					icon: 'success'
				})
				this.loadUsers()
			},
			async removeUser(item) {
				if (!item || item.username === 'superadmin') return
				const confirmRes = await new Promise(resolve => {
					uni.showModal({
						title: '删除确认',
						content: `确定删除用户 ${item.username} 吗？`,
						success: res => resolve(res.confirm)
					})
				})
				if (!confirmRes) return
				const res = await callCloud('crm-auth', {
					action: 'removeUser',
					data: {
						userId: item._id
					}
				})
				if (res.code !== 0) return
				uni.showToast({
					title: '已删除',
					icon: 'success'
				})
				this.loadUsers()
			}
		}
	}
</script>

<style scoped>
	.roles-page {
		min-height: 100vh;
		background: #f2f4f9;
		padding: 24rpx 16rpx 40rpx;
		box-sizing: border-box;
		display: flex;
		justify-content: center;
	}

	.roles-inner {
		width: 100%;
		max-width: 1600rpx;
		margin: 0 auto;
	}

	.card {
		background: #fff;
		border-radius: 20rpx;
		box-shadow: 0 12rpx 32rpx rgba(17, 24, 39, 0.05);
		width: 100%;
		max-width: 1600rpx;
	}

	.card-header {
		padding: 20rpx 24rpx 8rpx;
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

	.card-body {
		padding: 16rpx 24rpx 24rpx;
	}

	.create-box {
		border: 1rpx dashed #d1d5db;
		border-radius: 14rpx;
		padding: 16rpx;
		margin-bottom: 16rpx;
		background: #f9fafb;
	}

	.create-title {
		font-size: 26rpx;
		color: #374151;
		margin-bottom: 10rpx;
	}

	.create-row {
		display: flex;
		align-items: center;
		gap: 12rpx;
		flex-wrap: wrap;
	}

	.create-input {
		flex: 1;
		background: #fff;
		border: 1rpx solid #e5e7eb;
		border-radius: 10rpx;
		padding: 12rpx 14rpx;
		font-size: 26rpx;
		min-width: 220rpx;
	}

	.btn-create {
		background: #2563eb;
		color: #fff;
		border-radius: 10rpx;
		padding: 0 16rpx;
	}

	.empty {
		padding: 40rpx 0;
		text-align: center;
		color: #6b7280;
	}

	.user-list {
		display: flex;
		flex-direction: column;
		gap: 16rpx;
	}

	.user-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14rpx 12rpx;
		border-radius: 16rpx;
		border: 1rpx solid #e5e7eb;
		background: linear-gradient(90deg, #f8fbff, #f4f7fb);
	}

	.user-main {
		display: flex;
		align-items: center;
		gap: 12rpx;
	}

	.avatar {
		width: 64rpx;
		height: 64rpx;
		border-radius: 20rpx;
		background: linear-gradient(135deg, #4f8efc, #74b2ff);
		color: #fff;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.info {
		display: flex;
		flex-direction: column;
	}

	.name {
		font-size: 30rpx;
		font-weight: 700;
		color: #1f2937;
	}

	.meta {
		margin-top: 4rpx;
		font-size: 24rpx;
		color: #6b7280;
	}

	.role-actions {
		display: flex;
		align-items: center;
		gap: 10rpx;
	}

	.role-picker {
		min-width: 220rpx;
		padding: 12rpx 16rpx;
		background: #fff;
		border-radius: 12rpx;
		border: 1rpx solid #dbeafe;
		color: #2563eb;
		font-weight: 600;
	}

	.role-picker.small {
		min-width: 180rpx;
	}

	.role-picker.disabled {
		color: #9ca3af;
		border-color: #e5e7eb;
	}

	.saving {
		font-size: 22rpx;
		color: #6b7280;
	}

	.delete-user {
		margin-left: 16rpx;
		color: #ef4444;
		font-size: 26rpx;
	}
</style>