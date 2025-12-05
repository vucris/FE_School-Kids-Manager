// src/service/http.js
import axios from 'axios';
import { getAuthStore } from '@/stores/storeRegistry.js';
import { useLoadingBarStore } from '@/stores/loadingBar';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api/v1';
const USE_CREDENTIALS = (import.meta.env.VITE_WITH_CREDENTIALS ?? 'false') === 'true';

export const http = axios.create({
    baseURL: BASE_URL,
    timeout: 15000,
    withCredentials: USE_CREDENTIALS,
    headers: {
        // ❌ KHÔNG ép Content-Type là JSON nữa
        // 'Content-Type': 'application/json',
        // ✅ Chỉ cần Accept, axios sẽ tự set Content-Type phù hợp (JSON / multipart...)
        Accept: 'application/json'
    }
});

// REQUEST INTERCEPTOR
http.interceptors.request.use(
    (config) => {
        const loadingBar = useLoadingBarStore();
        loadingBar.start();

        const auth = getAuthStore?.();
        const token = auth?.accessToken;
        if (token) {
            config.headers = config.headers || {};
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        const loadingBar = useLoadingBarStore();
        loadingBar.stop();
        return Promise.reject(error);
    }
);

let isRefreshing = false;
let queue = [];

// RESPONSE INTERCEPTOR
http.interceptors.response.use(
    (res) => {
        const loadingBar = useLoadingBarStore();
        loadingBar.stop();
        return res;
    },
    async (error) => {
        const loadingBar = useLoadingBarStore();
        loadingBar.stop();

        const original = error.config || {};
        // 401 -> refresh token
        if (error.response?.status === 401 && !original.__isRetryRequest) {
            const auth = getAuthStore?.();
            if (!auth?.refreshToken) {
                return Promise.reject(error);
            }

            if (!isRefreshing) {
                isRefreshing = true;
                try {
                    const newToken = await auth.refreshTokenOnce();
                    queue.forEach((cb) => cb(newToken));
                    queue = [];
                    isRefreshing = false;

                    original.__isRetryRequest = true;
                    original.headers = original.headers || {};
                    original.headers.Authorization = `Bearer ${newToken}`;
                    return http(original);
                } catch (e) {
                    isRefreshing = false;
                    queue = [];
                    try {
                        auth?.logout();
                    } catch {}
                    return Promise.reject(error);
                }
            }

            // Đang refresh -> đợi
            return new Promise((resolve) => {
                queue.push((newToken) => {
                    original.__isRetryRequest = true;
                    original.headers = original.headers || {};
                    original.headers.Authorization = `Bearer ${newToken}`;
                    resolve(http(original));
                });
            });
        }

        return Promise.reject(error);
    }
);

export async function httpDownload(url, config = {}) {
    const res = await http.request({
        url,
        method: 'GET',
        responseType: 'blob',
        ...config
    });
    return res.data;
}

export default http;
