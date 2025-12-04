// src/service/notify.js
let toastImpl = null;

// Gắn implementation thật (đăng ký ở App.vue hoặc AppLayout.vue)
export function setToastImpl(fn) {
    toastImpl = fn;
}

// Gọi thông báo không có quyền truy cập
export function showNoPermissionToast() {
    if (toastImpl) {
        toastImpl({
            severity: 'warn',
            summary: 'Thông báo',
            detail: 'Bạn không có quyền truy cập chức năng này.',
            life: 3000
        });
    } else {
        // fallback nếu chưa có Toast
        window.alert('Bạn không có quyền truy cập chức năng này.');
    }
}
