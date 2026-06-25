import { useState, useCallback, useEffect } from 'react'
import { TabBar, NavBar, Button } from './ds.js'
import { api } from './api.js'
import { Home, ApplyRoot, MsgRoot, MyPage } from './screens/home.jsx'
import { Diagnosing, Results } from './screens/diagnose.jsx'
import {
  ApplicationMethod,
  BusinessPlan,
  ExpertList,
  RequestComplete,
  RequestConfirm,
  SubsidyDetail,
} from './screens/detail.jsx'
import { AdminSourceReview } from './screens/adminSourceReview.jsx'

const SCREENS = {
  home: Home,
  applyRoot: ApplyRoot,
  msgRoot: MsgRoot,
  mypage: MyPage,
  diagnosing: Diagnosing,
  results: Results,
  detail: SubsidyDetail,
  plan: BusinessPlan,
  method: ApplicationMethod,
  experts: ExpertList,
  requestConfirm: RequestConfirm,
  requestComplete: RequestComplete,
}

const TAB_ROOTS = { diag: 'home', apply: 'applyRoot', msg: 'msgRoot', mypage: 'mypage' }
const SHOW_TABBAR = new Set(['home', 'results', 'applyRoot', 'msgRoot', 'mypage'])
const PHASE1_TABS = [
  { id: 'diag', label: '診断' },
  { id: 'apply', label: '申請準備' },
  { id: 'msg', label: 'メッセージ' },
  { id: 'mypage', label: 'マイ' },
]

export default function App() {
  const isAdminReviewRoute = typeof window !== 'undefined' && window.location.pathname === '/admin/source-review'
  const [tab, setTab] = useState('diag')
  const [stack, setStack] = useState([])
  const [app, setApp] = useState({
    booting: false,
    user: null,
    token: null,
    url: 'https://www.sample-corp.example',
    diagnosis: null,
    matchesResult: null,
    selectedMatch: null,
    detail: null,
    plan: null,
    expertRecommendations: [],
    selectedExpert: null,
    exports: [],
    notificationSettings: null,
    waitlisted: false,
    error: null,
  })

  const set = useCallback((patch) => setApp((state) => ({ ...state, ...patch })), [])
  const go = useCallback((screen) => setStack((state) => [...state, screen]), [])
  const replace = useCallback((screen) => setStack((state) => [...state.slice(0, -1), screen]), [])
  const back = useCallback(() => setStack((state) => state.slice(0, -1)), [])
  const home = useCallback(() => { setStack([]); setTab('diag') }, [])
  const switchTab = useCallback((nextTab) => { setStack([]); setTab(nextTab) }, [])

  const refreshMe = useCallback(async () => {
    const me = await api('/v1/me')
    set({
      user: me.user,
      notificationSettings: me.notificationSettings,
      waitlisted: me.leads?.length > 0,
      exports: me.plans?.flatMap((plan) => plan.exports || []) || [],
    })
    return me
  }, [set])

  const login = useCallback(async () => {
    set({ booting: true, error: null })
    try {
      const result = await api('/v1/auth/dev-login', { method: 'POST', body: {} })
      set({ user: result.user, token: result.token, booting: false })
      await refreshMe()
    } catch (error) {
      set({ booting: false, error: error.message })
    }
  }, [refreshMe, set])

  const nav = {
    go,
    replace,
    back,
    home,
    tab: switchTab,
    set,
    refreshMe,
  }

  const current = stack.length > 0 ? stack[stack.length - 1] : TAB_ROOTS[tab]
  const ScreenComp = SCREENS[current]
  const showTab = app.user && ((stack.length === 0 && SHOW_TABBAR.has(current)) || current === 'results')

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [current])

  if (isAdminReviewRoute) {
    return (
      <AppFrame>
        <AdminSourceReview />
      </AppFrame>
    )
  }

  if (!app.user) {
    return (
      <AppFrame>
        <LoginScreen loading={app.booting} error={app.error} onLogin={login} />
      </AppFrame>
    )
  }

  return (
    <AppFrame>
      <ScreenComp key={current + stack.length} nav={nav} app={app} />
      {showTab && <TabBar active={tab} onChange={switchTab} tabs={PHASE1_TABS} />}
    </AppFrame>
  )
}

function AppFrame({ children }) {
  return (
    <div className="app-shell app-shell-responsive">
      {children}
    </div>
  )
}

function LoginScreen({ loading, error, onLogin }) {
  return (
    <>
      <NavBar brand />
      <div className="screen fade">
        <div className="pad login-pad client-login">
          <div className="home-kicker">補助金ポケット</div>
          <div className="login-title">会社サイトから、使える補助金をすぐ確認。</div>
          <p className="lead">
            公開ページを読み取り、候補制度と次に相談すべき内容を整理します。
          </p>
          {error && <div className="error-box">{error}</div>}
          <div className="login-actions">
            <Button
              variant="primary"
              size="lg"
              onClick={onLogin}
              disabled={loading}
              data-dev-entry-label="開発用ログイン"
            >
              {loading ? '準備しています' : '無料で診断を始める'}
            </Button>
            <Button variant="ghost" onClick={onLogin} disabled={loading}>
              メールで始める
            </Button>
            <Button variant="ghost" onClick={onLogin} disabled={loading}>
              Googleで続ける
            </Button>
            <Button variant="ghost" onClick={onLogin} disabled={loading}>
              LINEで続ける
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
