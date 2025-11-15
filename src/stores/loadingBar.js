import { defineStore } from 'pinia';

export const useLoadingBarStore = defineStore('loadingBar', {
  state: () => ({
    pending: 0 // số tác vụ đang chạy (route + API)
  }),
  getters: {
    isActive: (state) => state.pending > 0
  },
  actions: {
    start() {
      this.pending += 1;
    },
    stop() {
      this.pending = Math.max(0, this.pending - 1);
    },
    reset() {
      this.pending = 0;
    }
  }
});
