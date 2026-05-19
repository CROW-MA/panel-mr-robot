import api from "./client";

export const getDashboard = async (token: string) => {
  const res = await api.get("/dashboard", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

export const getBotQR = async (token: string, businessId: string) => {
  const res = await api.get(`/bot/qr/${businessId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};
