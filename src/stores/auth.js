// src/stores/auth.js
import { defineStore } from 'pinia';
import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api/v1';
const WITH_CREDENTIALS = (import.meta.env.VITE_WITH_CREDENTIALS ?? 'true') === 'true';

function readJSON(key, fallback = null) {
    try {
        return JSON.parse(localStorage.getItem(key));
    } catch {
        return fallback;
    }
}

function getTokensFromResponse(data) {
    const access = data?.accessToken ?? data?.access_token ?? data?.token ?? '';
    const refresh = data?.refreshToken ?? data?.refresh_token ?? '';
    return { access, refresh };
}

export const useAuthStore = defineStore('auth', {
    state: () => ({
        accessToken: localStorage.getItem('access_token') || '',
        refreshToken: localStorage.getItem('refresh_token') || '',
        user: readJSON('auth_user', null),
        role: localStorage.getItem('role') || ''
    }),

    getters: {
        isAuthenticated: (s) => !!s.accessToken
    },

    actions: {
        initFromStorage() {
            this.accessToken = localStorage.getItem('access_token') || '';
            this.refreshToken = localStorage.getItem('refresh_token') || '';
            this.user = readJSON('auth_user', null);
            this.role = localStorage.getItem('role') || '';
        },

        setTokens(access, refresh) {
            this.accessToken = access || '';
            this.refreshToken = refresh || '';

            if (access) localStorage.setItem('access_token', access);
            else localStorage.removeItem('access_token');

            if (refresh) localStorage.setItem('refresh_token', refresh);
            else localStorage.removeItem('refresh_token');
        },

        setUser(user) {
            this.user = user || null;
            if (user) localStorage.setItem('auth_user', JSON.stringify(user));
            else localStorage.removeItem('auth_user');
        },

        // 🔐 LOGIN
        async login({ username, password }) {
            const { data } = await axios.post(
                `${BASE_URL}/auth/login`,
                { username, password },
                { withCredentials: WITH_CREDENTIALS }
            );

            const { access, refresh } = getTokensFromResponse(data);
            this.setTokens(access, refresh);

            // chuẩn hóa role: bỏ prefix "ROLE_"
            const rawRole = data.role || data.roleName || '';
            const normalizedRole = rawRole.startsWith('ROLE_') ? rawRole.substring(5) : rawRole;
            this.role = normalizedRole;
            localStorage.setItem('role', normalizedRole);

            // 🔹 Lưu đầy đủ thông tin user
            this.setUser({
                id: data.id || null,
                username: data.username,
                fullName: data.fullName || '',
                email: data.email || '',
                phone: data.phone || '',
                avatar: data.avatarUrl || data.avatar || '',
                role: normalizedRole,
                createdAt: data.createdAt || null,
                gender: data.gender || null,
                healthRecords: data.healthRecords || 0,
                activityDays: data.activityDays || 0
            });

            return data;
        },

        async refreshTokenOnce() {
            if (!this.refreshToken) throw new Error('No refresh token');

            const { data } = await axios.post(
                `${BASE_URL}/auth/refresh`,
                { refreshToken: this.refreshToken },
                { withCredentials: WITH_CREDENTIALS }
            );

            const { access, refresh } = getTokensFromResponse(data);
            this.setTokens(access, refresh || this.refreshToken);

            return access;
        },

        async logout() {
            try {
                await axios.get(`${BASE_URL}/auth/logout`, {
                    withCredentials: WITH_CREDENTIALS,
                    headers: this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}
                });
            } catch (e) {
                console.warn('[Logout error]', e?.response?.data || e.message);
            } finally {
                this.setTokens('', '');
                this.setUser(null);
                this.role = '';
                localStorage.removeItem('role');
            }
        },

        // ================== QUÊN MẬT KHẨU – OTP GMAIL ==================

        async requestChangePassword(email) {
            const cleanEmail = String(email).trim();

            const { data } = await axios.post(
                `${BASE_URL}/auth/request-change-password`,
                cleanEmail,
                {
                    withCredentials: WITH_CREDENTIALS,
                    headers: {
                        'Content-Type': 'text/plain'
                    }
                }
            );
            return data;
        },

        async changePassword({ email, code, newPassword }) {
            const { data } = await axios.post(
                `${BASE_URL}/auth/change-password`,
                { email, code, newPassword },
                { withCredentials: WITH_CREDENTIALS }
            );
            return data;
        },

        // ================== CẬP NHẬT HỒ SƠ CƠ BẢN ==================
        /**
         * payload: { fullName, email, phone, avatar }
         * NOTE: giả sử có API PUT /accounts/me để cập nhật.
         */
        async updateProfileBasic(payload) {
            // TODO: nếu BE dùng path khác thì đổi ở đây
            const { data } = await axios.put(
                `${BASE_URL}/accounts/me`,
                payload,
                { withCredentials: WITH_CREDENTIALS }
            );

            // BE có thể trả ApiResponse -> lấy data.data hoặc data
            const raw = data?.data || data;

            const merged = {
                ...(this.user || {}),
                ...{
                    fullName: raw.fullName ?? payload.fullName,
                    email: raw.email ?? payload.email,
                    phone: raw.phone ?? payload.phone,
                    avatar: raw.avatarUrl || raw.avatar || payload.avatar
                }
            };

            this.setUser(merged);
            return merged;
        }
    }
});
