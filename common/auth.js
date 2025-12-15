// common/auth.js

const TOKEN_KEY = 'crm_token'
const USER_INFO_KEY = 'crm_user_info'
const TOKEN_META_KEY = 'crm_token_meta'
const DEFAULT_TOKEN_TTL = 1000 * 60 * 60 * 24 * 7 // 7 天默认有效期

// 防止重复跳登录
let isRedirectingToLogin = false

// 读取 token
export function getToken() {
  try {
    const t =
      uni.getStorageSync(TOKEN_KEY) ||
      uni.getStorageSync('token') ||
      ''
<<<<<<< HEAD
    console.log('[auth/getToken] =>', t ? '有 token' : '无 token')
    return t
  } catch (e) {
    console.warn('[auth/getToken] 读取异常', e)
=======
    
    return t
  } catch (e) {
    
>>>>>>> 25fda4a (init project)
    return ''
  }
}

export function setToken(token, options = {}) {
  if (!token) return

  const { expireAt, expireIn } = options
  const createdAt = Date.now()
  const expiresAt =
    expireAt ||
    (expireIn ? createdAt + expireIn : createdAt + DEFAULT_TOKEN_TTL)

  console.log('[auth/setToken] 保存 token，并记录有效期到', new Date(expiresAt))
  uni.setStorageSync(TOKEN_KEY, token)
  uni.setStorageSync(TOKEN_META_KEY, {
    createdAt,
    expiresAt
  })
}

export function clearAuth() {
  console.log('[auth/clearAuth] 清空登录信息')
  try {
    uni.removeStorageSync(TOKEN_KEY)
    uni.removeStorageSync(USER_INFO_KEY)
    uni.removeStorageSync(TOKEN_META_KEY)
  } catch (e) {}
}

export function setUserInfo(user) {
  console.log('[auth/setUserInfo] 保存用户信息')
  uni.setStorageSync(USER_INFO_KEY, user || {})
}

export function getUserInfo() {
  try {
    const u = uni.getStorageSync(USER_INFO_KEY) || {}
    return u
  } catch (e) {
    return {}
  }
}

export function isAdminRole(user) {
  const role = user && user.role
  if (!role) return true
  return role === 'admin' || role === 'superadmin'
}

export function isSuperAdmin(user) {
  const role = user && user.role
  return role === 'superadmin'
}

export function getTokenMeta() {
  try {
    return uni.getStorageSync(TOKEN_META_KEY) || {}
  } catch (e) {
    return {}
  }
}

export function isTokenExpired(meta) {
  if (!meta) return false
  const { expiresAt, createdAt } = meta
  const now = Date.now()
  if (expiresAt && now > expiresAt) return true
  // 如果没有 expiresAt，则使用默认 TTL 做兜底
  if (!expiresAt && createdAt && now - createdAt > DEFAULT_TOKEN_TTL) return true
  return false
}

export function goLogin(forceMsg) {
  // 防止同一时刻多次重定向
  if (isRedirectingToLogin) {
    console.log('[auth/goLogin] 已在跳转中，忽略')
    return
  }

  // 如果当前已经在登录页，就别再重定向了
  try {
    const pages = getCurrentPages()
    const currentRoute = pages[pages.length - 1]?.route || ''
    console.log('[auth/goLogin] 当前路由 =', currentRoute)
    if (currentRoute === 'pages/login/login') {
      console.log('[auth/goLogin] 已在登录页，直接返回')
      return
    }
  } catch (e) {}

  isRedirectingToLogin = true

  if (forceMsg) {
    uni.showToast({
      title: forceMsg,
      icon: 'none',
      duration: 1500
    })
  }

  clearAuth()

  setTimeout(() => {
    console.log('[auth/goLogin] reLaunch 到登录页')
    uni.reLaunch({
      url: '/pages/login/login'
    })
    // 给一点时间让页面稳定
    setTimeout(() => {
      isRedirectingToLogin = false
    }, 500)
  }, forceMsg ? 1200 : 0)
}

/**
 * 统一登录校验
 * 在页面 onLoad 里用：if (!ensureLogin()) return
 */
export function ensureLogin() {
  const token = getToken()
  const meta = getTokenMeta()
<<<<<<< HEAD
  console.log('[auth/ensureLogin] token 是否存在 =', !!token)

  if (!token) {
    console.log('[auth/ensureLogin] 未登录，准备跳登录')
=======
  

  if (!token) {
    
>>>>>>> 25fda4a (init project)
    goLogin('请先登录')
    return false
  }

  if (isTokenExpired(meta)) {
    console.log('[auth/ensureLogin] token 已过期，触发重新登录')
    clearAuth()
    goLogin('登录已过期，请重新登录')
    return false
  }

  return true
}