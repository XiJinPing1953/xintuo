<template>
  <view class="back-bar" :class="{ 'back-bar--border': showBorder }">
    <!-- 顶部安全区 -->
    <view class="back-bar-safe"></view>

    <!-- 实际的返回区域 -->
    <view class="back-bar-inner" @click="goBack">
      <text class="back-icon">‹</text>
      <text v-if="text" class="back-text">{{ text }}</text>
    </view>
  </view>
</template>

<script>
export default {
  name: 'BackToDashboardBar',
  props: {
    // 没有上一页时，兜底要去的页面
    backTo: {
      type: String,
      default: '' // 不传就默认回工作台
    },
    // 右侧文字，比如 “返回工作台 / 返回上一页 / 瓶子管理”等
    text: {
      type: String,
      default: '返回'
    },
    // 是否显示底部分割线
    showBorder: {
      type: Boolean,
      default: true
    }
  },
  methods: {
    goBack() {
      const pages = getCurrentPages()
      // 有历史记录：正常返回上一页
      if (pages.length > 1) {
        uni.navigateBack()
        return
      }

      // 没历史记录：走兜底
      const target = this.backTo || '/pages/dashboard/index'
      uni.reLaunch({ url: target })
    }
  }
}
</script>

<style scoped>
.back-bar {
  position: sticky;
  top: 0;
  z-index: 999;
  background-color: #f2f4f9; /* 跟你页面底色一致，不突兀 */
}

/* 安全区占位：高度为状态栏高 */
.back-bar-safe {
  height: var(--status-bar-height);
}

/* 实际可点击区域 */
.back-bar-inner {
  height: 88rpx;
  padding: 0 24rpx;
  box-sizing: border-box;
  display: flex;
  align-items: center;
}

/* 底部分割线（可选） */
.back-bar--border .back-bar-inner {
  border-bottom: 1rpx solid #e5e7eb;
}

.back-icon {
  font-size: 40rpx;
  line-height: 1;
  margin-right: 8rpx;
  color: #374151;
}

.back-text {
  font-size: 28rpx;
  color: #374151;
}
</style>