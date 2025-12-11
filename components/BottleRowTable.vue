<template>
  <view class="bottle-table">
    <view class="table-header">
      <text class="title">{{ title }}</text>
      <button class="btn-mini" @click="addRow">+ 添加一行</button>
    </view>

    <view class="table-head-row">
      <text class="cell cell-no">瓶号</text>
      <text v-if="showWeight" class="cell cell-num">毛重(kg)</text>
      <text v-if="showWeight" class="cell cell-num">皮重(kg)</text>
      <text v-if="showWeight && showNet" class="cell cell-num">净重(kg)</text>
      <text class="cell cell-op">操作</text>
    </view>

    <view v-for="(row, index) in rows" :key="index" class="table-body-row">
      <!-- 瓶号 -->
      <view class="cell cell-no">
        <input
          class="input"
          placeholder="输入瓶号"
          v-model="row.bottleInput"
          @blur="emitChange"
        />
      </view>

      <!-- 毛重 -->
      <view v-if="showWeight" class="cell cell-num">
        <input
          class="input"
          type="number"
          placeholder="毛重"
          v-model="row.gross"
          @input="onWeightChange(row)"
        />
      </view>

      <!-- 皮重 -->
      <view v-if="showWeight" class="cell cell-num">
        <input
          class="input"
          type="number"
          placeholder="皮重"
          v-model="row.tare"
          @input="onWeightChange(row)"
        />
      </view>

      <!-- 净重（可选，出/回瓶用，存瓶可以隐藏） -->
      <view v-if="showWeight && showNet" class="cell cell-num">
        <input
          class="input"
          type="number"
          placeholder="净重(可手填)"
          v-model="row.net"
          @input="emitChange"
        />
      </view>

      <!-- 操作 -->
      <view class="cell cell-op">
        <button class="btn-mini btn-danger" @click="removeRow(index)">
          删除
        </button>
      </view>
    </view>

    <view v-if="!rows.length" class="empty-row">
      <text class="empty-text">暂无记录，点击右上角「添加一行」</text>
    </view>
  </view>
</template>

<script>
export default {
  name: 'BottleRowTable',
  props: {
    // v-model 使用
    value: {
      type: Array,
      default: () => []
    },
    // 标题：出瓶 / 回瓶 / 存瓶
    title: {
      type: String,
      default: ''
    },
    // 是否显示毛重/皮重/净重列（存瓶可关掉）
    showWeight: {
      type: Boolean,
      default: true
    },
    // 是否显示净重列（有的场景只要毛重+皮重）
    showNet: {
      type: Boolean,
      default: true
    }
  },
  computed: {
    rows: {
      get() {
        return this.value
      },
      set(val) {
        this.$emit('input', val) // 兼容 uni-app / Vue2 的 v-model
      }
    }
  },
  methods: {
    addRow() {
      const newRows = this.rows.slice()
      newRows.push({
        bottleInput: '',
        gross: '',
        tare: '',
        net: '',
        bottleId: ''
      })
      this.rows = newRows
    },
    removeRow(index) {
      const newRows = this.rows.slice()
      newRows.splice(index, 1)
      this.rows = newRows
    },
    onWeightChange(row) {
      // 毛重/皮重变化时，自动算一下净重（保持和后端逻辑一致：前端可以先算一版）
      const g = Number(row.gross)
      const t = Number(row.tare)
      if (!Number.isNaN(g) && !Number.isNaN(t)) {
        row.net = (g - t).toFixed(2)
      }
      this.emitChange()
    },
    emitChange() {
      // 触发 v-model 更新
      this.rows = this.rows.slice()
    }
  }
}
</script>

<style scoped>
.bottle-table {
  margin-top: 12rpx;
}
.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8rpx;
}
.title {
  font-size: 28rpx;
  font-weight: 600;
}
.table-head-row,
.table-body-row {
  display: flex;
  align-items: center;
}
.cell {
  padding: 8rpx 4rpx;
  font-size: 24rpx;
}
.cell-no {
  flex: 2;
}
.cell-num {
  flex: 1.2;
}
.cell-op {
  width: 120rpx;
  text-align: right;
}
.input {
  width: 100%;
  padding: 8rpx 10rpx;
  border-radius: 12rpx;
  border: 1rpx solid #e5e7eb;
  background-color: #fff;
  box-sizing: border-box;
}
.btn-mini {
  padding: 6rpx 16rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  background: #ffffff;
  border: 1rpx solid #d1d5db;
  color: #374151;
}
.btn-danger {
  border-color: #f97373;
  color: #f97373;
}
.empty-row {
  padding: 12rpx 0;
}
.empty-text {
  font-size: 24rpx;
  color: #9ca3af;
}
</style>