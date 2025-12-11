<template>
	<view class="login-page">
		<!-- 背景光晕，只做装饰 -->
		<view class="bg-glow glow-1"></view>
		<view class="bg-glow glow-2"></view>

		<view class="login-inner">
			<!-- 顶部品牌区 -->
			<view class="hero">
				<view class="hero-logo">
					<text class="hero-logo-text">气</text>
				</view>
				<view class="hero-text">
					<text class="hero-title">新拓能源</text>
					<text class="hero-sub">送气与对账助手</text>
				</view>
			</view>

			<!-- 登录卡片 -->
			<view class="login-card">
				<!-- 账号 -->
				<view class="form-item">
					<text class="form-label">账号</text>
					<view class="input-wrapper">
                                                <input
                                                        class="form-input"
                                                        v-model.trim="form.username"
                                                        type="text"
                                                        placeholder="请输入账号"
                                                        maxlength="50"
                                                        autocomplete="off"
                                                        @confirm="handleLogin"
                                                />
                                        </view>
                                </view>

                                <!-- 密码 -->
                                <view class="form-item">
                                        <text class="form-label">密码</text>
                                        <view class="input-wrapper">
                                                <input
                                                        class="form-input"
                                                        :type="showPassword ? 'text' : 'password'"
                                                        v-model.trim="form.password"
                                                        placeholder="请输入密码"
                                                        maxlength="50"
                                                        autocomplete="new-password"
                                                        @confirm="handleLogin"
                                                />
                                                <view class="suffix" @click="togglePassword">
                                                        <text class="suffix-text">{{ showPassword ? '隐藏' : '显示' }}</text>
                                                </view>
                                        </view>
                                </view>

                                <!-- 登录按钮：和输入框左右对齐 -->
                                <button class="login-btn" @click="handleLogin" :disabled="logging || !isFormValid">
                                        <view class="login-btn-inner">
                                                <text v-if="!logging">{{ isFormValid ? '登录' : '请完成信息' }}</text>
                                                <text v-else>登录中…</text>
                                        </view>
                                </button>
                        </view>
		</view>
	</view>
</template>

<script>
	import {
		setToken,
		setUserInfo
	} from '@/common/auth.js'
	export default {
                data() {
                        return {
                                form: {
                                        username: '',
                                        password: ''
                                },
                                logging: false,
                                showPassword: false
                        }
                },

                onShow() {
                        // 每次进入登录页清空输入，避免浏览器自动填充影响视觉
                        this.form.username = ''
                        this.form.password = ''
                        this.showPassword = false
                },

                methods: {
                        togglePassword() {
                                this.showPassword = !this.showPassword
                        },

                        validateForm() {
                                const username = (this.form.username || '').trim()
                                const password = (this.form.password || '').trim()

                                if (!username || !password) {
                                        uni.showToast({
                                                title: '请输入账号和密码',
                                                icon: 'none'
                                        })
                                        return false
                                }

                                if (username.length < 3) {
                                        uni.showToast({
                                                title: '账号长度至少 3 位',
                                                icon: 'none'
                                        })
                                        return false
                                }

                                if (password.length < 6) {
                                        uni.showToast({
                                                title: '密码长度至少 6 位',
                                                icon: 'none'
                                        })
                                        return false
                                }

                                return true
                        },

                        async handleLogin() {
                                if (this.logging) return

                                if (!this.validateForm()) return

                                this.logging = true
                                uni.showLoading({
					title: '登录中…'
				})

				try {
					const res = await uniCloud.callFunction({
						name: 'crm-auth',
						data: {
							action: 'login',
							data: {
								username: this.form.username,
								password: this.form.password
							}
						}
					})

					const result = res.result || {}

					if (result.code !== 0) {
						uni.hideLoading()
						this.logging = false
						return uni.showToast({
							title: result.msg || '账号或密码错误',
							icon: 'none'
						})
					}

					// 保存 token + 用户信息
					// uni.setStorageSync('crm_token', result.token)
					// uni.setStorageSync('crm_user_info', result.user)
                                        // 保存 token + 用户信息（走统一封装）
                                        setToken(result.token, {
                                                // 如果后端返回过期时间就用，否则 7 天
                                                expireAt: result.expire_at || result.expireAt,
                                                expireIn: result.expire_in || result.expireIn
                                        })
                                        setUserInfo(result.user)
                                        uni.setStorageSync('crm_user', result.user)

					uni.showToast({
						title: '登录成功',
						icon: 'success'
					})

					setTimeout(() => {
						uni.reLaunch({
							url: '/pages/dashboard/index'
						})
					}, 300)
				} catch (e) {
					console.error('登录异常', e)
					uni.showToast({
						title: '登录失败，请检查网络或云函数',
						icon: 'none'
					})
				} finally {
					uni.hideLoading()
                                        this.logging = false
                                }
                        }
                },
                computed: {
                        isFormValid() {
                                const username = (this.form.username || '').trim()
                                const password = (this.form.password || '').trim()
                                return username.length >= 3 && password.length >= 6
                        }
                }
        }
</script>

<style scoped>
	/* 整体背景：玻璃磨砂 + 氛围光 */
	.login-page {
		position: relative;
		min-height: 100vh;
		box-sizing: border-box;
		padding: 80rpx 24rpx 40rpx;
		background: radial-gradient(circle at 0% 0%, #e9f1ff 0, #f4f6fb 40%, #e8ecf7 100%);
		display: flex;
		justify-content: center;
		align-items: center;
		overflow: hidden;
	}

	/* 背景光晕 */
	.bg-glow {
		position: absolute;
		border-radius: 50%;
		filter: blur(90rpx);
		opacity: 0.7;
		pointer-events: none;
		z-index: 0;
	}

	.glow-1 {
		width: 280rpx;
		height: 280rpx;
		top: 80rpx;
		left: -40rpx;
		background: #c8d7ff;
	}

	.glow-2 {
		width: 340rpx;
		height: 340rpx;
		bottom: -40rpx;
		right: -10rpx;
		background: #ffe1c7;
	}

	.login-inner {
		width: 100%;
		max-width: 720rpx;
		margin: 0 auto;
		position: relative;
		z-index: 1;
		/* 原来就有的：保持内容居中 */
		display: flex;
		flex-direction: column;

		/* ⭐ 在真正居中的基础上，微微往上挪一点点 */
		transform: translateY(-16rpx);
	}

	/* 顶部品牌区（保持左上角） */
	.hero {
		display: flex;
		align-items: center;
		margin-bottom: 32rpx;
	}

	.hero-logo {
		width: 88rpx;
		height: 88rpx;
		border-radius: 26rpx;
		background: linear-gradient(135deg, #2f7cff, #4ac5ff);
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 18rpx 42rpx rgba(20, 80, 180, 0.35);
	}

	.hero-logo-text {
		color: #fff;
		font-size: 46rpx;
		font-weight: 700;
	}

	.hero-text {
		margin-left: 24rpx;
		display: flex;
		flex-direction: column;
	}

	.hero-title {
		font-size: 36rpx;
		font-weight: 700;
		color: #151823;
	}

	.hero-sub {
		margin-top: 4rpx;
		font-size: 24rpx;
		color: #8c95a8;
	}

	/* 登录卡片 */
	.login-card {
		background: rgba(255, 255, 255, 0.78);
		border-radius: 28rpx;
		padding: 32rpx 32rpx 34rpx;
		box-sizing: border-box;
		backdrop-filter: blur(26rpx);
		-webkit-backdrop-filter: blur(26rpx);
		box-shadow:
			0 20rpx 40rpx rgba(15, 23, 42, 0.16),
			0 0 0 1rpx rgba(255, 255, 255, 0.7);
		border: 1rpx solid rgba(230, 236, 248, 0.9);
	}

	/* 表单项 */
	.form-item {
		margin-bottom: 26rpx;
	}

	.form-label {
		display: block;
		margin-bottom: 10rpx;
		font-size: 26rpx;
		color: #333;
		font-weight: 600;
	}

	/* 输入框：完全收在卡片内部 */
        .input-wrapper {
                width: 100%;
                background: #ffffff;
                border-radius: 20rpx;
                height: 88rpx;
                display: flex;
                align-items: center;
                box-sizing: border-box;
                border: 1rpx solid rgba(210, 216, 232, 0.9);
                box-shadow: 0 10rpx 24rpx rgba(16, 46, 90, 0.08);
        }

        .form-input {
                flex: 1;
                padding: 0 24rpx;
                height: 100%;
                font-size: 30rpx;
                line-height: 88rpx;
                box-sizing: border-box;
                background: transparent;
                border: none;
                outline: none;
                color: #222;
        }

        .suffix {
                padding: 0 22rpx 0 12rpx;
                height: 100%;
                display: flex;
                align-items: center;
                color: #3a7bff;
                font-size: 26rpx;
        }

        .suffix-text {
                color: #3a7bff;
        }

	.form-input::placeholder {
		font-size: 28rpx;
		color: #a0a7b9;
	}

	input[type="text"],
	input[type="password"] {
		-webkit-appearance: none;
	}

	.input-wrapper:focus-within {
		border-color: #3a7bff;
		box-shadow:
			0 16rpx 34rpx rgba(20, 80, 180, 0.18),
			0 0 0 1rpx rgba(255, 255, 255, 0.8);
	}

	/* 登录按钮：和输入框同宽，并去掉 uni-app 默认细边线 */
	.login-btn {
		width: 100%;
		margin-top: 32rpx;
		padding: 0;
		background: transparent;
		border-radius: 22rpx;
		overflow: hidden;
		border: none;
	}

	.login-btn::after {
		border: none !important;
	}

	/* 真正的胶囊背景放在 inner 上 */
	.login-btn-inner {
		height: 88rpx;
		width: 100%;
		border-radius: inherit;
		background: linear-gradient(135deg, #2979ff, #1ac4ff);
		display: flex;
		align-items: center;
		justify-content: center;
		color: #ffffff;
		font-size: 30rpx;
		font-weight: 600;
		box-shadow:
			0 20rpx 40rpx rgba(26, 120, 255, 0.35),
			0 0 0 1rpx rgba(255, 255, 255, 0.9);
	}

	.login-btn[disabled] .login-btn-inner {
		opacity: 0.78;
	}

	.login-btn:active .login-btn-inner {
		transform: translateY(2rpx) scale(0.985);
		box-shadow:
			0 12rpx 26rpx rgba(26, 120, 255, 0.3),
			0 0 0 1rpx rgba(255, 255, 255, 0.9);
	}

	/* 窄屏适配 */
	@media screen and (max-width: 800px) {
		.login-page {
			padding: 60rpx 24rpx 40rpx;
		}

		.login-inner {
			transform: translateY(-8rpx);
			/* 小屏再柔一点点 */
		}
	}
</style>