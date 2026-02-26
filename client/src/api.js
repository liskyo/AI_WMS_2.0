import axios from 'axios';

const api = axios.create({
    baseURL: '/api', // Proxy will handle this in dev, relative path in prod
});

export const getLocations = () => api.get('/locations');
export const getItems = (q) => api.get('/items', { params: { q } });
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

// User Management
export const getUsers = (token) => api.get('/users', { headers: { Authorization: `Bearer ${token}` } });
export const createUser = (data, token) => api.post('/users', data, { headers: { Authorization: `Bearer ${token}` } });
export const updateUser = (id, data, token) => api.put(`/users/${id}`, data, { headers: { Authorization: `Bearer ${token}` } });
export const deleteUser = (id, token) => api.delete(`/users/${id}`, { headers: { Authorization: `Bearer ${token}` } });

// BOM APIs
export const importBom = (bomData, token) => api.post('/admin/import/bom', { bomData }, { headers: { Authorization: `Bearer ${token}` } });
export const getBom = (main_barcode = '') => api.get(`/bom`, { params: { main_barcode } });
export const submitBomTransaction = (data, token) => api.post('/transactions/bom-out', data, { headers: { Authorization: `Bearer ${token}` } });

export default api;
