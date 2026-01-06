import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";

export const axiosInstance = axios.create({
  baseURL,
  timeout: 30000, // Aumentado para 30s devido à API externa
  headers: {
    "Content-Type": "application/json",
  },
});

axiosInstance.interceptors.request.use(
  (config) => {
    // TODO: Adicionar token de autenticação se necessário
    // const token = localStorage.getItem("token");
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    // TODO: Implementar tratamento de erros global
    return Promise.reject(error);
  }
);
