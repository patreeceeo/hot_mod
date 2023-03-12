import { HotModuleState } from '../modules/client/mod.ts'
declare global {
  interface ImportMeta {
    hot?: HotModuleState
  }
}
