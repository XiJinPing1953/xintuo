// common/api.js

import { getToken, getTokenMeta, goLogin, isTokenExpired } from './auth.js'

/**
 * 调用 uniCloud 云函数的统一封装
 * @param {String} fnName 云函数名称，例如 'crm-customer'
 * @param {String} action 业务 action，例如 'list' / 'create' / 'update'
 * @param {Object} data   业务数据
 * @param {Object} opts   额外选项 { showLoading: true/false, loadingText: '加载中...' }
 * @returns {Object} result 直接返回 res.result
 */
export async function callApi(fnName, action, data = {}, opts = {}) {
  const token = getToken()
  const tokenMeta = getTokenMeta()
  const {
    showLoading = false,
    loadingText = '加载中...',
    showErrorToast = true,
    silentAuthRedirect = false
  } = opts

  try {
    if (!token) {
      if (!silentAuthRedirect) {
        goLogin('请先登录')
      }
      return { code: 401, msg: '未登录' }
    }

    if (isTokenExpired(tokenMeta)) {
      if (!silentAuthRedirect) {
        goLogin('登录已过期，请重新登录')
      }
      return { code: 401, msg: '登录已过期' }
    }

    if (showLoading) {
      uni.showLoading({ title: loadingText, mask: true })
    }

    const res = await uniCloud.callFunction({
      name: fnName,
      data: {
        action,
        token,
        data
      }
    })

    const result = res.result || {}

    // 统一处理未登录 / 登录过期
    const isAuthError =
      result.code === 401 ||
      result.code === 'NO_LOGIN' ||
      result.code === 'AUTH_FAILED'

    if (isAuthError) {
      // 后端约定：401 代表未登录或登录已过期
      const msg = result.msg || '登录已过期，请重新登录'
      if (!silentAuthRedirect) {
        goLogin(msg)
      }
      // 这里返回一个特殊对象，方便调用方判断
      return { code: 401, msg }
    }

    if (result.code !== 0 && showErrorToast) {
      uni.showToast({
        title: result.msg || '请求失败，请稍后再试',
        icon: 'none'
      })
    }

    return result
  } catch (e) {
    console.error('callApi error:', e)
    if (showErrorToast) {
      const msg =
        e?.errMsg?.includes('timeout')
          ? '请求超时，请检查网络后重试'
          : '请求异常，请稍后再试'
      uni.showToast({
        title: msg,
        icon: 'none'
      })
    }
    return { code: -1, msg: '请求异常' }
  } finally {
    if (showLoading) {
      uni.hideLoading()
    }
  }
}