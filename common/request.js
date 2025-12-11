import { getToken, ensureLogin } from '@/common/auth.js'

export async function callCloud(name, payload = {}) {
  const token = getToken()
  if (!token) {
    uni.showToast({ title: '登录已过期，请重新登录', icon: 'none' })
    ensureLogin()
    return { code: 401, msg: '未登录或登录已过期' }
  }

  try {
    const res = await uniCloud.callFunction({
      name,
      data: {
        token,
        ...payload
      }
    })
    const result = res.result || {}

    if (result.code === 401) {
      uni.showToast({ title: result.msg || '登录已过期，请重新登录', icon: 'none' })
      ensureLogin()
    } else if (result.code && result.code !== 0 && !result.silent) {
      uni.showToast({ title: result.msg || '请求失败', icon: 'none' })
    }

    return result
  } catch (error) {
    console.error('callCloud error', error)
    uni.showToast({ title: '请求出错', icon: 'none' })
    return { code: -1, msg: '请求异常' }
  }
}
