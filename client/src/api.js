import axios from 'axios';
import { DETAIL_LINES_ZH_EN } from './backendOfflineMessages';

const api = axios.create({
    baseURL: '/api', // Proxy will handle this in dev, relative path in prod
});

const REACH = 'wms-backend-reachable';
const UNREACH = 'wms-backend-unreachable';

api.interceptors.response.use(
    (response) => {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(REACH));
        }
        return response;
    },
    (error) => {
        const noResponse = !error.response;
        const canceled =
            error.code === 'ERR_CANCELED' ||
            error.name === 'CanceledError' ||
            (typeof error.message === 'string' && error.message.toLowerCase().includes('cancel'));
        if (noResponse && typeof window !== 'undefined' && !canceled) {
            window.dispatchEvent(
                new CustomEvent(UNREACH, {
                    detail: { hint: DETAIL_LINES_ZH_EN },
                })
            );
        }
        return Promise.reject(error);
    }
);

export const getLocations = () => api.get('/locations');
export const getLocationInventory = (code) => api.get(`/locations/${encodeURIComponent(code)}/inventory`);
export const getItems = (q, opts = {}) => {
    const params = {};
    if (q !== undefined && q !== null && String(q).trim() !== '') params.q = q;
    if (opts.summary) params.summary = '1';
    return api.get('/items', { params });
};
export const getItemDetails = (barcode) => api.get(`/items/${barcode}`);
export const submitTransaction = (data, token) => api.post('/transaction', data, { headers: { Authorization: `Bearer ${token}` } });
export const createItem = (data) => api.post('/items', data);
export const updateSafeStock = (barcode, safe_stock) => api.patch(`/items/${barcode}/safe-stock`, { safe_stock });
export const getInventoryReport = () => api.get('/reports/inventory');

// Admin APIs
export const adminLogin = (password) => api.post('/admin/login', { password }); // Kept for password-only flow
export const userLogin = (employee_id, password) => api.post('/admin/login', { employee_id, password });
export const importItems = (items, token) => api.post('/admin/import/items', { items }, { headers: { Authorization: `Bearer ${token}` } });
export const deleteItem = (barcode, password, token) => api.delete(`/admin/items/${barcode}`, { data: { password }, headers: { Authorization: `Bearer ${token}` } });
export const importInventory = (inventory, token) => api.post('/admin/import/inventory', { inventory }, { headers: { Authorization: `Bearer ${token}` } });
export const importLocations = (locations, floorName, token) => api.post('/admin/import/locations', { locations, floorName }, { headers: { Authorization: `Bearer ${token}` } });
export const renameFloor = (oldName, newName, token) => api.put('/admin/locations/floor', { oldName, newName }, { headers: { Authorization: `Bearer ${token}` } });
export const voidTransaction = (id, password, token) => api.post(`/admin/transactions/${id}/void`, { password }, { headers: { Authorization: `Bearer ${token}` } });
export const toggleLocationClose = (id, is_closed, closed_reason, token) => api.patch(`/admin/locations/${id}/toggle-close`, { is_closed, closed_reason }, { headers: { Authorization: `Bearer ${token}` } });

// User Management
export const getUsers = (token) => api.get('/users', { headers: { Authorization: `Bearer ${token}` } });
export const createUser = (data, token) => api.post('/users', data, { headers: { Authorization: `Bearer ${token}` } });
export const updateUser = (id, data, token) => api.put(`/users/${id}`, data, { headers: { Authorization: `Bearer ${token}` } });
export const deleteUser = (id, token) => api.delete(`/users/${id}`, { headers: { Authorization: `Bearer ${token}` } });

// BOM APIs
export const importBom = (bomData, token) => api.post('/admin/import/bom', { bomData }, { headers: { Authorization: `Bearer ${token}` } });
export const getBom = (main_barcode = '') => api.get(`/bom`, { params: { main_barcode } });
export const submitBomTransaction = (data, token) => api.post('/transactions/bom-out', data, { headers: { Authorization: `Bearer ${token}` } });

// Stock check onsite records（盤點紀錄）
export const postStockCheckRecords = (body, token) =>
    api.post('/stock-check/records', body, { headers: { Authorization: `Bearer ${token}` } });
export const getStockCheckRecords = (params, token) =>
    api.get('/stock-check/records', { params, headers: { Authorization: `Bearer ${token}` } });
export const exportStockCheckRecords = (params, token) =>
    api.get('/stock-check/records/export', {
        params,
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
    });

export default api;
