import api from "./client";

export const createPayment = async (plan_id: string, token: string) => {
  const res = await api.post(
    "/payments/create",
    { plan_id },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return res.data;
};
