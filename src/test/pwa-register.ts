export type RegisterSwOptions = {
  immediate?: boolean
  onNeedRefresh?: () => void
}

export function registerSW(options?: RegisterSwOptions) {
  void options
  return async (reloadPage?: boolean): Promise<void> => {
    void reloadPage
  }
}
