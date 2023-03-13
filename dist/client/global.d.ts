import { HotModuleState } from './mod.ts'
declare global {
  interface ImportMeta {
    hot?: HotModuleState
  }
}
