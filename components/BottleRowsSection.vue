<template>
  <view class="card">
    <view class="card-header">
      <text class="card-title">{{ title }}</text>
      <text class="card-sub">{{ subtitle }}</text>
    </view>

    <view class="card-body">
      <view
        v-for="(row, index) in rows"
        :key="prefix + '-' + index"
        class="bottle-row"
      >
        <!-- 行头 -->
        <view class="row-header">
          <view class="row-header-left">
            <text class="label">{{ titleLabel }}</text>
          </view>
          <view class="row-header-right" v-if="rows.length > 1">
            <text class="delete-text" @click="$emit('remove-row', index)">删除</text>
          </view>
        </view>

        <!-- 瓶号输入 -->
        <view class="form-item">
          <view class="input-wrapper">
            <input
              class="input"
              :placeholder="placeholder"
              v-model="row.number"
              @input="$emit('input-number', index, $event)"
              @blur="$emit('blur-number', index)"
            />
          </view>

          <!-- 候选瓶号下拉列表 -->
          <view
            v-if="row.suggestions && row.suggestions.length"
            class="bottle-suggest"
          >
            <view
              v-for="item in row.suggestions"
              :key="item._id"
              class="suggest-item"
              @tap.stop="$emit('select-suggest', index, item)"
            >
              <text class="suggest-no">{{ item.number }}</text>
              <text class="suggest-sub">
                皮重
                {{ item.tare_weight != null ? item.tare_weight : '-' }} kg ·
                {{ statusTextMap[item.status] || '未知状态' }}
              </text>
            </view>
          </view>
        </view>

        <!-- 毛重 / 皮重 / 净重（存瓶不需要） -->
        <view v-if="type !== 'deposit'" class="form-row">
          <view class="form-item col">
            <text class="label">毛重 (kg)</text>
            <view class="input-wrapper">
              <input
                class="input"
                type="number"
                placeholder="kg"
                v-model="row.gross"
                @blur="$emit('calc-net', index)"
              />
            </view>
          </view>
          <view class="form-item col">
            <text class="label">皮重 (kg)</text>
            <view class="input-wrapper">
              <input
                class="input"
                type="number"
                placeholder="kg"
                v-model="row.tare"
                @blur="$emit('calc-net', index)"
              />
            </view>
          </view>
          <view class="form-item col">
            <text class="label">净重 (kg)</text>
            <view class="input-wrapper">
              <input
                class="input"
                type="number"
                :placeholder="netPlaceholder"
                v-model="row.net"
                @input="row.netManual = true"
              />
            </view>
          </view>
        </view>

        <view class="row-divider"></view>
      </view>

      <!-- 添加按钮 -->
      <view class="btn-row-inline">
        <button class="btn-soft" @click="$emit('add-row')">
          + 添加{{ titleLabel }}
        </button>
      </view>

      <!-- 合计 / 金额提示 -->
      <!-- 出瓶：一行 chip -->
      <view v-if="type === 'out'" class="summary-chip">
        <text class="summary-label">本次出瓶净重合计：</text>
        <text class="summary-value">{{ summaryValue }} kg</text>
      </view>

      <!-- 回瓶：两行（净重 + 金额方向） -->
      <view v-else-if="type === 'back'" class="summary-chip-column">
        <view class="summary-line">
          <text class="summary-label">本次回瓶净重合计：</text>
          <text class="summary-value">{{ summaryValue }} kg</text>
        </view>
        <view class="summary-line">
          <text class="summary-label">按单价结算：</text>
          <text
            class="summary-value"
            :class="{
              'summary-positive': backAmount < 0,
              'summary-negative': backAmount > 0
            }"
          >
            {{ backAmountAbs }} 元
          </text>
          <text class="summary-tip">
            {{ backAmountDirectionText }}
          </text>
        </view>
      </view>
      <!-- 存瓶：无合计 -->
    </view>
  </view>
</template>

<script>
export default {
  name: "BottleRowsSection",
  props: {
    type: { type: String, required: true }, // 'out' | 'back' | 'deposit'
    rows: { type: Array, required: true },
    statusTextMap: { type: Object, required: true },
    summaryValue: { type: String, default: "" }, // 合计净重
    // 仅回瓶用
    backAmount: { type: Number, default: 0 },
    backAmountAbs: { type: String, default: "0" },
    backAmountDirectionText: { type: String, default: "" }
  },
  computed: {
    prefix() {
      return this.type;
    },
    title() {
      if (this.type === "out") return "出瓶";
      if (this.type === "back") return "回收瓶";
      return "存瓶号";
    },
    subtitle() {
      if (this.type === "out") return "本次送出去的瓶子，可添加多行";
      if (this.type === "back") return "本次从客户处回收的瓶子，可添加多行";
      return "记录当前留在客户处的瓶子，可添加多行";
    },
    titleLabel() {
      if (this.type === "out") return "瓶号";
      if (this.type === "back") return "回收瓶号";
      return "存瓶号";
    },
    placeholder() {
      if (this.type === "deposit") return "例如 207";
      if (this.type === "back") return "例如 114 / 207";
      return "例如 207，支持模糊搜索";
    },
    netPlaceholder() {
      if (this.type === "back") {
        return "若不填将按 毛重-皮重 自动计算，可手动改为负数/正数";
      }
      return "若不填将按 毛重-皮重 自动计算";
    }
  }
};
</script>

<style scoped>
/* 不写样式，全部复用页面上的 class */
</style>