import { describe, it, expect } from 'vitest'
import { makeProject, messages } from '../../../_testkit'
import check from './008'

const CONFIG_URLS = 'backend/config/urls.py'

describe('BE008 — URL structure', () => {
  it('passes namespaced app urls mounted under api/', () => {
    const root = makeProject({
      'backend/apps/core/apps.py': '',
      'backend/apps/core/urls.py': 'app_name = "core"\nurlpatterns = []\n',
      [CONFIG_URLS]: 'urlpatterns = [\n    path("api/", include("apps.core.urls")),\n]\n',
    })
    expect(check(root)).toEqual([])
  })

  it('flags a missing app_name', () => {
    const root = makeProject({
      'backend/apps/core/apps.py': '',
      'backend/apps/core/urls.py': 'urlpatterns = []\n',
      [CONFIG_URLS]: 'urlpatterns = [\n    path("api/", include("apps.core.urls")),\n]\n',
    })
    expect(messages(check(root)).join()).toContain('app_name')
  })

  it('flags an app urls.py not included in config/urls.py', () => {
    const root = makeProject({
      'backend/apps/core/apps.py': '',
      'backend/apps/core/urls.py': 'app_name = "core"\nurlpatterns = []\n',
      [CONFIG_URLS]: 'urlpatterns = []\n',
    })
    expect(messages(check(root)).join()).toContain('include("apps.core.urls")')
  })

  it('errors when config/urls.py is missing', () => {
    const root = makeProject({
      'backend/apps/core/apps.py': '',
      'backend/apps/core/urls.py': 'app_name = "core"\nurlpatterns = []\n',
    })
    expect(messages(check(root)).join()).toContain('config/urls.py is missing')
  })
})
