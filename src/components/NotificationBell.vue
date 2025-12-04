<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.js';
import { fetchUnreadNotifications, fetchAdminNotifications, markNotificationAsRead, markAllNotificationsAsRead, fetchUnreadNotificationCount } from '@/service/notification.js';

const auth = useAuthStore();
const router = useRouter();

/**
 * ⚠️ KIỂM TRA CẤU TRÚC auth.user CỦA BẠN
 * Ở đây mình lấy:
 *  - id hoặc accountId làm accountId
 *  - role hoặc roleName làm role
 */
const currentUser = computed(() => auth.user || null);
const accountId = computed(() => currentUser.value?.id || currentUser.value?.accountId);
const role = computed(() => currentUser.value?.role || currentUser.value?.roleName);
const isAdmin = computed(() => role.value === 'ADMIN' || role.value === 'ROLE_ADMIN');

const notifications = ref([]);
const unreadCount = ref(0);
const open = ref(false);
const loading = ref(false);

function formatDateTime(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('vi-VN');
}

/** 🔔 Load danh sách thông báo khi mở dropdown */
async function loadNotifications() {
    if (!accountId.value) return;

    loading.value = true;
    try {
        if (isAdmin.value) {
            const list = await fetchAdminNotifications(accountId.value);
            notifications.value = list || [];
            unreadCount.value = (list || []).filter((n) => !n.isRead).length;
        } else {
            const list = await fetchUnreadNotifications(accountId.value);
            notifications.value = list || [];
            unreadCount.value = list.length;
        }
    } catch (e) {
        console.error('[NotificationBell] loadNotifications error:', e);
    } finally {
        loading.value = false;
    }
}

/** 🔢 Chỉ load số chưa đọc (hiện trên badge) */
async function loadUnreadCountOnly() {
    if (!accountId.value) return;

    try {
        if (isAdmin.value) {
            // Admin: dùng /notifications/admin rồi count thủ công để tính cả broadcast (recipient = null)
            const list = await fetchAdminNotifications(accountId.value);
            unreadCount.value = (list || []).filter((n) => !n.isRead).length;
        } else {
            // User thường: dùng unread-count theo recipientId
            unreadCount.value = await fetchUnreadNotificationCount(accountId.value);
        }
    } catch (e) {
        console.error('[NotificationBell] loadUnreadCountOnly error:', e);
    }
}

async function toggleOpen() {
    open.value = !open.value;
    if (open.value) {
        await loadNotifications();
    }
}

/** ✅ Đánh dấu tất cả là đã đọc */
async function onMarkAllRead() {
    if (!accountId.value || !notifications.value.length) return;
    try {
        await markAllNotificationsAsRead(accountId.value);
        notifications.value = notifications.value.map((n) => ({ ...n, isRead: true }));
        unreadCount.value = 0;
    } catch (e) {
        console.error('[NotificationBell] onMarkAllRead error:', e);
    }
}

/** ✅ Click từng thông báo */
async function onClickNotification(n) {
    if (!n.isRead && accountId.value) {
        try {
            await markNotificationAsRead({
                notificationId: n.id,
                recipientId: accountId.value
            });
            n.isRead = true;
            if (unreadCount.value > 0) unreadCount.value -= 1;
        } catch (e) {
            console.error('[NotificationBell] onClickNotification error:', e);
        }
    }

    // Điều hướng tuỳ loại thông báo
    if (n.relatedEntityType === 'FEEDBACK' && n.relatedEntityId) {
        router.push({ name: 'FeedbackDetail', params: { id: n.relatedEntityId } });
        open.value = false;
    }
}

/** Xem tất cả thông báo ở màn /notifications */
function goToAllNotifications() {
    router.push({ path: '/notifications' });
    open.value = false;
}

/** Khi vừa load trang → load số chưa đọc */
onMounted(() => {
    console.log('[NotificationBell] auth.user =', auth.user);
    console.log('[NotificationBell] accountId =', accountId.value, 'role =', role.value);
    loadUnreadCountOnly();
});
</script>

<template>
    <div class="notification-wrapper">
        <!-- Nút chuông -->
        <button type="button" class="layout-topbar-action bell-btn" @click="toggleOpen">
            <i class="pi pi-bell"></i>
            <span v-if="unreadCount > 0" class="badge">
                {{ unreadCount > 9 ? '9+' : unreadCount }}
            </span>
        </button>

        <!-- Dropdown -->
        <div v-if="open" class="dropdown">
            <div class="dropdown-header">
                <span>Thông báo</span>
                <button type="button" class="mark-all-btn" :disabled="!notifications.length" @click="onMarkAllRead">Đánh dấu tất cả đã đọc</button>
            </div>

            <div v-if="loading" class="dropdown-loading">
                <i class="pi pi-spin pi-spinner" style="margin-right: 0.35rem"></i>
                Đang tải thông báo...
            </div>

            <div v-else class="dropdown-content">
                <div v-if="!notifications.length" class="dropdown-empty">Không có thông báo nào.</div>

                <button v-for="n in notifications" :key="n.id" type="button" class="dropdown-item" :class="{ 'dropdown-item-unread': !n.isRead }" @click="onClickNotification(n)">
                    <div class="dot" :class="{ 'dot-unread': !n.isRead }"></div>
                    <div class="item-main">
                        <div class="item-title">
                            {{ n.title }}
                        </div>
                        <div class="item-message">
                            {{ n.message }}
                        </div>
                        <div class="item-meta">{{ n.type }} • {{ formatDateTime(n.createdAt) }}</div>
                    </div>
                </button>
            </div>

            <div class="dropdown-footer">
                <button type="button" class="view-all-btn" @click="goToAllNotifications">Xem tất cả thông báo</button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.notification-wrapper {
    position: relative;
}

.bell-btn {
    position: relative;
}

.badge {
    position: absolute;
    top: -4px;
    right: -4px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    border-radius: 999px;
    background: #f97373;
    color: #fff;
    font-size: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.dropdown {
    position: absolute;
    right: 0;
    margin-top: 8px;
    width: 320px;
    max-height: 420px;
    background: var(--surface-overlay);
    border-radius: 12px;
    box-shadow: 0 4px 18px rgba(0, 0, 0, 0.18);
    border: 1px solid var(--surface-border);
    display: flex;
    flex-direction: column;
    z-index: 999;
}

.dropdown-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
    border-bottom: 1px solid var(--surface-border);
    font-size: 13px;
    font-weight: 600;
}

.mark-all-btn {
    border: none;
    background: transparent;
    font-size: 11px;
    color: var(--primary-color);
    cursor: pointer;
}
.mark-all-btn:disabled {
    color: #9ca3af;
    cursor: default;
}

.dropdown-loading {
    padding: 10px;
    font-size: 12px;
}

.dropdown-content {
    max-height: 330px;
    overflow-y: auto;
}

.dropdown-empty {
    padding: 12px;
    font-size: 12px;
    color: #6b7280;
    text-align: center;
}

.dropdown-item {
    width: 100%;
    border: none;
    background: transparent;
    padding: 8px 10px;
    display: flex;
    align-items: flex-start;
    gap: 8px;
    cursor: pointer;
    border-bottom: 1px solid var(--surface-border);
    text-align: left;
}
.dropdown-item:last-child {
    border-bottom: none;
}
.dropdown-item:hover {
    background: var(--surface-hover, rgba(0, 0, 0, 0.03));
}

.dropdown-item-unread {
    background: rgba(59, 130, 246, 0.04);
}

.dot {
    margin-top: 4px;
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: #d1d5db;
}
.dot-unread {
    background: #10b981;
}

.item-main {
    flex: 1;
}

.item-title {
    font-size: 12px;
    font-weight: 600;
    margin-bottom: 2px;
    color: #111827;
}

.item-message {
    font-size: 11px;
    color: #4b5563;
    margin-bottom: 2px;
}

.item-meta {
    font-size: 10px;
    color: #9ca3af;
}

.dropdown-footer {
    border-top: 1px solid var(--surface-border);
    padding: 6px 10px;
    display: flex;
    justify-content: center;
}

.view-all-btn {
    border: none;
    background: transparent;
    font-size: 11px;
    color: var(--primary-color);
    cursor: pointer;
}
</style>
