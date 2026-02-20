import api from "src/clients/client";

export const createEscrow = async (payload: any) => {
  const response = await api.post('/escrow', payload);
  return response.data;
};

export const getEscrows = async () => {
  const response = await api.get('/escrow');
  return response.data;
};

export const getEscrowById = async (id: string) => {
  const response = await api.get(`/escrow/${id}`);
  return response.data;
};

export const releaseEscrow = async (id: string) => {
  const response = await api.patch(`/escrow/${id}/release`);
  return response.data;
};