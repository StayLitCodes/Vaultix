import api from '../clients/client';

interface EscrowPayload {
  [key: string]: unknown;
}

interface EscrowResponse {
  [key: string]: unknown;
}

export const createEscrow = async (
  payload: EscrowPayload,
): Promise<EscrowResponse> => {
  const response = await api.post<EscrowResponse>('/escrow', payload);
  return response.data;
};

export const getEscrows = async (): Promise<EscrowResponse[]> => {
  const response = await api.get<EscrowResponse[]>('/escrow');
  return response.data;
};

export const getEscrowById = async (id: string): Promise<EscrowResponse> => {
  const response = await api.get<EscrowResponse>(`/escrow/${id}`);
  return response.data;
};

export const releaseEscrow = async (id: string): Promise<EscrowResponse> => {
  const response = await api.patch<EscrowResponse>(`/escrow/${id}/release`);
  return response.data;
};
