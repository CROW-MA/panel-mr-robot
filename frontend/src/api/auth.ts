import api from "./client";

export const loginApi = async (email: string, password: string) => {
  const res = await api.post("/auth/login", { email, password });
  return res.data;
};

export const registerApi = async (
  email: string,
  password: string,
  business_name: string
) => {
  const res = await api.post("/auth/register", { email, password, business_name });
  return res.data;
};

export const getMeApi = async (token: string) => {
  const res = await api.get("/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};
