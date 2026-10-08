import { describe, expect, it } from 'vitest'
import { projectIdentifiers } from './identifiers.js'

describe('projectIdentifiers', () => {
  it('derives stable Expo, native, and emulator identifiers', () => {
    expect(projectIdentifiers('my-great-app')).toEqual({
      slug: 'my-great-app',
      scheme: 'my-great-app',
      nativeName: 'mygreatapp',
      bundleIdentifier: 'com.mygreatapp.app',
      emulatorProjectId: 'demo-my-great-app',
    })
  })
})
