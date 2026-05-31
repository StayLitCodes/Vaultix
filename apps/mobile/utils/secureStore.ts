import * as SecureStore from 'expo-secure-store';

export const saveSecureItem = async (key: string, value: string) => {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch (error) {
    console.error('Error saving secure item:', error);
  }
};

export const getSecureItem = async (key: string) => {
  try {
    return await SecureStore.getItemAsync(key);
  } catch (error) {
    console.error('Error retrieving secure item:', error);
    return null;
  }
};

export const deleteSecureItem = async (key: string) => {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch (error) {
    console.error('Error deleting secure item:', error);
  }
};
